from datetime import datetime
from sqlalchemy import BigInteger, DateTime, Float, Index, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class CustomerOrder(Base):
    """
    Live customer order for real-time tracking via QR Code on receipt.
    """
    __tablename__ = "customer_orders"
    __table_args__ = (
        Index("ix_cust_order_ih_id", "ih_id", unique=True),
        Index("ix_cust_order_code", "order_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ih_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    order_code: Mapped[str] = mapped_column(String(50), nullable=False)
    branch_name: Mapped[str] = mapped_column(String(100), nullable=False, default="ديفادو")
    customer_name: Mapped[str] = mapped_column(String(100), nullable=True, default="")
    customer_phone: Mapped[str] = mapped_column(String(50), nullable=True, default="")
    order_type: Mapped[str] = mapped_column(String(50), nullable=False, default="Take Away")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PREPARING")
    items_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    push_subscriptions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ready_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
