from sqlalchemy.orm import Session

from ..models import CleanupLog, CleanupRun


def get_runs(db: Session, limit: int = 20, offset: int = 0) -> tuple[list[CleanupRun], int]:
    total = db.query(CleanupRun).count()
    runs = (
        db.query(CleanupRun)
        .order_by(CleanupRun.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return runs, total


def get_logs(
    db: Session,
    run_id: int | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[CleanupLog], int]:
    query = db.query(CleanupLog)
    if run_id is not None:
        query = query.filter(CleanupLog.run_id == run_id)

    total = query.count()
    logs = (
        query.order_by(CleanupLog.deleted_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return logs, total
