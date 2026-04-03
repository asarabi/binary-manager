from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import get_config
from ..database import get_db
from ..models import CleanupRun
from ..schemas import DashboardStats, DiskUsage
from ..services import disk_agent_service, webdav_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    config = get_config()

    # Aggregate disk info from first server (primary)
    first_server = config.binary_servers[0] if config.binary_servers else None
    disk_info = disk_agent_service.get_disk_usage(first_server) if first_server else {
        "total_bytes": 0, "used_bytes": 0, "free_bytes": 0, "usage_percent": 0,
    }
    disk = DiskUsage(**disk_info)

    # Count projects and builds across all servers
    total_projects = 0
    total_builds = 0
    for server in config.binary_servers:
        projects = webdav_service.list_projects(server)
        total_projects += len(projects)
        for project in projects:
            builds = webdav_service.list_builds(server, project)
            total_builds += len(builds)

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
        total_projects=total_projects,
        total_builds=total_builds,
        cleanup_running=running_run is not None,
        last_cleanup_at=last_run.finished_at if last_run else None,
    )
