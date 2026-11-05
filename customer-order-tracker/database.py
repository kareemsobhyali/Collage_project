import os
import uuid
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# ── Database URL resolution ───────────────────────────────────────────────────
# Uses DATABASE_URL if set (e.g. PostgreSQL on AWS / Railway),
# otherwise defaults to a local standalone SQLite database file.

_raw_url = os.getenv("DATABASE_URL", "").strip()

if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql://") and "+asyncpg" not in _raw_url:
    _raw_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL = _raw_url if _raw_url else "sqlite+aiosqlite:///./customer_tracker.db"

kwargs = {}
if "postgresql" in DATABASE_URL:
    kwargs["connect_args"] = {
        "statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4().hex}__",
    }
    kwargs["poolclass"] = pool.NullPool
    if "?" in DATABASE_URL:
        DATABASE_URL += "&prepared_statement_cache_size=0"
    else:
        DATABASE_URL += "?prepared_statement_cache_size=0"
elif "sqlite" in DATABASE_URL:
    kwargs["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    **kwargs
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    from models import CustomerOrder  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
