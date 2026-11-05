from datetime import datetime, timezone
import json
import logging
import os
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import CustomerOrder

# ── VAPID Configuration ────────────────────────────────────────────────────────
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "43X89MQnkbZsZ-98R0WeZVo7hogxXY8nSV6B4cVqk08")
VAPID_CLAIMS = {"sub": os.getenv("VAPID_SUBJECT", "mailto:admin@myrestaurant.com")}

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


# ── In-Memory WebSocket Manager for Live Customer Pages ───────────────────────
class OrderConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, order_id: int):
        await websocket.accept()
        if order_id not in self.active_connections:
            self.active_connections[order_id] = []
        self.active_connections[order_id].append(websocket)
        logger.info(f"WebSocket connected for order {order_id}. Total: {len(self.active_connections[order_id])}")

    def disconnect(self, websocket: WebSocket, order_id: int):
        if order_id in self.active_connections:
            if websocket in self.active_connections[order_id]:
                self.active_connections[order_id].remove(websocket)
            if not self.active_connections[order_id]:
                del self.active_connections[order_id]

    async def broadcast_order_ready(self, order_id: int, payload: dict):
        if order_id not in self.active_connections:
            return
        conns = list(self.active_connections[order_id])
        logger.info(f"Broadcasting READY to {len(conns)} clients for order {order_id}")
        msg = json.dumps(payload)
        for ws in conns:
            try:
                await ws.send_text(msg)
            except Exception as e:
                logger.warning(f"Error sending ws update for order {order_id}: {e}")
                self.disconnect(ws, order_id)


order_ws_manager = OrderConnectionManager()


# ── Background Web Push Dispatcher ───────────────────────────────────────────
def _send_web_push_background(subscriptions: list, payload: dict) -> None:
    """Fire-and-forget Web Push dispatch in a daemon thread."""
    import threading

    def _dispatch():
        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            logger.warning("pywebpush not installed — skipping Web Push dispatch")
            return

        data = json.dumps(payload)
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info=sub,
                    data=data,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims=VAPID_CLAIMS,
                )
                logger.info(f"Web Push sent to endpoint: {sub.get('endpoint', '')[:60]}...")
            except WebPushException as ex:
                logger.warning(f"Web Push failed: {ex}")
            except Exception as ex:
                logger.warning(f"Web Push unexpected error: {ex}")

    t = threading.Thread(target=_dispatch, daemon=True)
    t.start()


# ── Pydantic Schemas ──────────────────────────────────────────────────────────
class OrderItemSchema(BaseModel):
    name: str
    qty: float
    price: float = 0.0
    remark: Optional[str] = ""


class SyncOrderPayload(BaseModel):
    ih_id: int
    order_code: str
    branch_name: str = "ديفادو"
    customer_name: Optional[str] = ""
    customer_phone: Optional[str] = ""
    order_type: str = "Take Away"
    items: List[OrderItemSchema] = []
    total_amount: float = 0.0


class PushSubscriptionPayload(BaseModel):
    subscription: dict


# ── Helper to find an order by IH_SERIAL (stored in ih_id) ───────────────────
async def find_order_by_id_or_code(db: AsyncSession, identifier: str) -> Optional[CustomerOrder]:
    if identifier.isdigit():
        ih_val = int(identifier)
        res = await db.execute(
            select(CustomerOrder).where(CustomerOrder.ih_id == ih_val).order_by(CustomerOrder.id.desc()).limit(1)
        )
        return res.scalar_one_or_none()

    res = await db.execute(
        select(CustomerOrder).where(CustomerOrder.order_code == identifier).order_by(CustomerOrder.id.desc()).limit(1)
    )
    return res.scalar_one_or_none()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{identifier}")
async def get_customer_order(identifier: str, db: AsyncSession = Depends(get_db)):
    """
    Fetch order details and current status by unique IH_SERIAL (`identifier`),
    while returning `order_code` (`ih_code`) to be displayed to the customer.
    """
    order = await find_order_by_id_or_code(db, identifier)
    if not order:
        return {
            "ih_id": int(identifier) if identifier.isdigit() else 0,
            "order_code": "",
            "branch_name": "ديفادو",
            "customer_name": "",
            "order_type": "تيك أواي",
            "status": "PREPARING",
            "items": [],
            "total_amount": 0.0,
            "is_ready": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    return {
        "ih_id": order.ih_id,
        "order_code": order.order_code,
        "branch_name": order.branch_name,
        "customer_name": order.customer_name or "",
        "order_type": order.order_type,
        "status": order.status,
        "is_ready": (order.status == "READY"),
        "items": order.items_json or [],
        "total_amount": order.total_amount,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "ready_at": order.ready_at.isoformat() if order.ready_at else None,
    }


@router.post("/sync")
async def sync_customer_order(payload: SyncOrderPayload, db: AsyncSession = Depends(get_db)):
    """Called by KDS in real-time when orders appear or update."""
    res = await db.execute(select(CustomerOrder).where(CustomerOrder.ih_id == payload.ih_id))
    order = res.scalar_one_or_none()

    items_data = [item.model_dump() for item in payload.items]

    if not order:
        order = CustomerOrder(
            ih_id=payload.ih_id,
            order_code=payload.order_code,
            branch_name=payload.branch_name,
            customer_name=payload.customer_name or "",
            customer_phone=payload.customer_phone or "",
            order_type=payload.order_type,
            status="PREPARING",
            items_json=items_data,
            total_amount=payload.total_amount,
        )
        db.add(order)
    else:
        order.order_code = payload.order_code
        order.branch_name = payload.branch_name
        if payload.customer_name:
            order.customer_name = payload.customer_name
        if payload.customer_phone:
            order.customer_phone = payload.customer_phone
        order.order_type = payload.order_type
        order.items_json = items_data
        order.total_amount = payload.total_amount

    await db.commit()
    return {"status": "ok", "ih_id": payload.ih_id}


@router.post("/{identifier}/ready")
async def mark_order_ready(identifier: str, db: AsyncSession = Depends(get_db)):
    """
    Called when KDS presses Confirm Delivery.
    Updates status to READY, triggers WebSocket broadcast and sends Web Push.
    """
    order = await find_order_by_id_or_code(db, identifier)

    ih_val = int(identifier) if identifier.isdigit() else 0
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    if not order:
        order = CustomerOrder(
            ih_id=ih_val,
            order_code="",
            status="READY",
            ready_at=now_utc
        )
        db.add(order)
    else:
        order.status = "READY"
        order.ready_at = now_utc

    await db.commit()

    display_code = order.order_code or str(order.ih_id)
    ready_payload = {
        "event": "ORDER_READY",
        "order_id": order.ih_id,
        "order_code": order.order_code,
        "status": "READY",
        "message": f"طلبك رقم #{display_code} جاهز للاستلام الآن! 🔔",
        "ready_at": now_utc.isoformat()
    }
    await order_ws_manager.broadcast_order_ready(order.ih_id, ready_payload)

    if order.push_subscriptions and VAPID_PRIVATE_KEY:
        logger.info(f"Sending Web Push to {len(order.push_subscriptions)} subscriptions for order {order.ih_id}")
        _send_web_push_background(order.push_subscriptions, ready_payload)

    return {"status": "ok", "message": "Order marked READY and notifications triggered", "ih_id": order.ih_id}


@router.post("/{identifier}/push-subscribe")
async def subscribe_push_notification(identifier: str, payload: PushSubscriptionPayload, db: AsyncSession = Depends(get_db)):
    """Save customer's browser PushSubscription."""
    order = await find_order_by_id_or_code(db, identifier)
    if not order:
        ih_val = int(identifier) if identifier.isdigit() else 0
        order = CustomerOrder(ih_id=ih_val, order_code="", status="PREPARING", push_subscriptions=[payload.subscription])
        db.add(order)
    else:
        subs = list(order.push_subscriptions or [])
        existing_endpoints = {s.get("endpoint") for s in subs if isinstance(s, dict)}
        new_endpoint = payload.subscription.get("endpoint")
        if new_endpoint and new_endpoint not in existing_endpoints:
            subs.append(payload.subscription)
            order.push_subscriptions = subs

    await db.commit()
    logger.info(f"Registered Web Push subscription for order {identifier}")
    return {"status": "ok", "subscribed": True}


@router.websocket("/ws/{order_id}")
async def customer_order_ws(websocket: WebSocket, order_id: int):
    """Real-time WebSocket endpoint for the customer tracking page."""
    await order_ws_manager.connect(websocket, order_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        order_ws_manager.disconnect(websocket, order_id)
    except Exception as e:
        logger.warning(f"WebSocket error on order {order_id}: {e}")
        order_ws_manager.disconnect(websocket, order_id)
