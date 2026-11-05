import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

load_dotenv()

from database import init_db
from routers import customer_orders


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    await init_db()
    yield


app = FastAPI(
    title="Customer Order Tracker API",
    description="نظام مستقل لمتابعة حالة طلب العميل لحظياً مع إشعارات صوتية و WebSocket و Web Push",
    version="1.0.0",
    lifespan=lifespan,
)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files for Customer Order Tracker UI
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(os.path.join(STATIC_DIR, "tracker"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Include Customer Order Tracker Router
app.include_router(
    customer_orders.router,
    prefix="/api/customer-orders",
    tags=["CustomerOrders"],
)


@app.get("/order/{identifier}", include_in_schema=False)
async def customer_order_tracker_page(identifier: str):
    """Serve the standalone mobile Customer Order Tracker page."""
    return FileResponse(os.path.join(STATIC_DIR, "tracker", "index.html"))


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Customer Order Tracker",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
