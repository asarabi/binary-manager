from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..schemas import CleanupLogResponse, CleanupRunResponse, PaginatedLogs
from ..services import cleanup_log_service

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("/runs", response_model=list[CleanupRunResponse])
def list_runs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    runs, _ = cleanup_log_service.get_runs(db, limit=limit, offset=offset)
    return [
        CleanupRunResponse(
            id=r.id,
            started_at=r.started_at,
            finished_at=r.finished_at,
            trigger=r.trigger,
            dry_run=r.dry_run,
            disk_usage_before=r.disk_usage_before,
            disk_usage_after=r.disk_usage_after,
            builds_deleted=r.builds_deleted,
            bytes_freed=r.bytes_freed,
            status=r.status,
            error_message=r.error_message,
        )
        for r in runs
    ]


@router.get("", response_model=PaginatedLogs)
def list_logs(
    run_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs, total = cleanup_log_service.get_logs(db, run_id=run_id, page=page, page_size=page_size)
    return PaginatedLogs(
        items=[
            CleanupLogResponse(
                id=log.id,
                run_id=log.run_id,
                deleted_at=log.deleted_at,
                project_name=log.project_name,
                build_number=log.build_number,
                retention_type=log.retention_type,
                age_days=log.age_days,
                size_bytes=log.size_bytes,
                score=log.score,
                dry_run=log.dry_run,
            )
            for log in logs
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
