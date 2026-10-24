import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "Chưa cấu hình DATABASE_URL. Hãy tạo backend/.env từ backend/.env.example "
        "và điền thông tin Oracle trước khi chạy backend."
    )
if not DATABASE_URL.startswith("oracle+oracledb://"):
    raise RuntimeError("Smart HR yêu cầu kết nối Oracle: DATABASE_URL phải bắt đầu bằng oracle+oracledb://")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        # Oracle sessions are pooled. Clear VPD state before returning one to the pool.
        vpd_enabled = os.getenv("VPD_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
        if vpd_enabled and engine.dialect.name == "oracle":
            try:
                db.rollback()
                db.execute(text("BEGIN HR_APP.SMART_HR_VPD_CTX_PKG.CLEAR_CONTEXT; END;"))
                db.rollback()
            except Exception:
                db.rollback()
                db.invalidate()
        db.close()
