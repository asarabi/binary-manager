from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class CleanupRun(Base):
    __tablename__ = "cleanup_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    trigger: Mapped[str] = mapped_column(String(50))  # "scheduled" | "manual"
    dry_run: Mapped[bool] = mapped_column(default=False)
    disk_usage_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_usage_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    builds_deleted: Mapped[int] = mapped_column(Integer, default=0)
    bytes_freed: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(String(20), default="running")  # running|completed|failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class CleanupLog(Base):
    __tablename__ = "cleanup_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(Integer, index=True)
    deleted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    project_name: Mapped[str] = mapped_column(String(255))
    build_number: Mapped[str] = mapped_column(String(50))
    retention_type: Mapped[str] = mapped_column(String(50))
    age_days: Mapped[float] = mapped_column(Float)
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    score: Mapped[float] = mapped_column(Float)
    dry_run: Mapped[bool] = mapped_column(default=False)
