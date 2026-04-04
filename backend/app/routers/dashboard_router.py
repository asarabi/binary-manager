from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import get_config
from ..database import get_db
from ..models import CleanupRun
from ..schemas import DashboardStats, DiskUsage, ServerStats
from ..services import disk_agent_service, webdav_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    config = get_config()

    server_stats = []
    for server in config.binary_servers:
        disk_info = disk_agent_service.get_disk_usage(server)
        disk = DiskUsage(**disk_info)

        projects = webdav_service.list_projects(server)
        build_count = 0
        for project in projects:
            builds = webdav_service.list_builds(server, project)
            build_count += len(builds)

        server_stats.append(
            ServerStats(
                name=server.name,
                disk=disk,
                project_count=len(projects),
                build_count=build_count,
            )
        )

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
        servers=server_stats,
        cleanup_running=running_run is not None,
        last_cleanup_at=last_run.finished_at if last_run else None,
    )
