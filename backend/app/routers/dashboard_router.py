from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import CleanupRun
from ..schemas import DashboardStats, DiskUsage
from ..services import ssh_service, webdav_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    disk_info = ssh_service.get_disk_usage()
    disk = DiskUsage(**disk_info)

    projects = webdav_service.list_projects()
    total_builds = 0
    for project in projects:
        builds = webdav_service.list_builds(project)
        total_builds += len(builds)

    # Check if cleanup is running
    running_run = (
        db.query(CleanupRun)
        .filter(CleanupRun.status == "running")
        .first()
    )

    last_run = (
        db.query(CleanupRun)
        .filter(CleanupRun.status == "completed")
        .order_by(CleanupRun.finished_at.desc())
        .first()
    )

    return DashboardStats(
        disk=disk,
        total_projects=len(projects),
        total_builds=total_builds,
        cleanup_running=running_run is not None,
        last_cleanup_at=last_run.finished_at if last_run else None,
    )
