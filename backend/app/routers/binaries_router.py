from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import get_config
from ..database import get_db
from ..models import CleanupLog
from ..schemas import BuildInfo, ProjectDetail, ProjectInfo
from ..services import disk_agent_service, webdav_service
from ..services.retention_engine import get_retention_days, is_custom_project

router = APIRouter(prefix="/api/binaries", tags=["binaries"])


@router.get("", response_model=list[ProjectInfo])
def list_projects(
    server: str = Query("", description="Filter by server name"),
    user: str = Depends(get_current_user),
):
    config = get_config()
    servers = config.binary_servers
    if server:
        servers = [s for s in servers if s.name == server]

    result = []
    for srv in servers:
        projects = webdav_service.list_projects(srv)
        for name in projects:
            retention = get_retention_days(srv, name)
            builds = webdav_service.list_builds(srv, name)
            build_numbers = [b["build_number"] for b in builds]
            result.append(
                ProjectInfo(
                    name=name,
                    retention_days=retention,
                    is_custom=is_custom_project(srv, name),
                    build_count=len(builds),
                    oldest_build=min(build_numbers) if build_numbers else None,
                    newest_build=max(build_numbers) if build_numbers else None,
                    server=srv.name,
                )
            )
    return result


@router.get("/detail/{project:path}", response_model=ProjectDetail)
def get_project_builds(
    project: str,
    server: str = Query("", alias="server"),
    user: str = Depends(get_current_user),
):
    config = get_config()
    srv = _find_server(config, server)

    retention = get_retention_days(srv, project)
    builds = webdav_service.list_builds(srv, project)

    now = datetime.utcnow()
    build_infos = []
    for b in builds:
        modified = b["modified_at"]
        age_days = (now - modified).total_seconds() / 86400
        remaining = retention - age_days
        build_infos.append(
            BuildInfo(
                build_number=b["build_number"],
                modified_at=modified,
                age_days=round(age_days, 1),
                retention_days=retention,
                remaining_days=round(remaining, 1),
                expired=age_days >= retention,
            )
        )

    build_infos.sort(key=lambda b: b.build_number)
    return ProjectDetail(
        name=project,
        retention_days=retention,
        is_custom=is_custom_project(srv, project),
        builds=build_infos,
    )


@router.delete("/detail/{project:path}/{build}", status_code=status.HTTP_200_OK)
def delete_build(
    project: str,
    build: str,
    server: str = Query("", alias="server"),
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = get_config()
    srv = _find_server(config, server)

    if not webdav_service.build_exists(srv, project, build):
        raise HTTPException(status_code=404, detail="Build not found")

    rel_path = f"{project}/{build}"
    size = disk_agent_service.get_directory_size(srv, rel_path)
    success = webdav_service.delete_build(srv, project, build)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete build")

    log = CleanupLog(
        run_id=0,
        project_name=project,
        build_number=build,
        retention_type="custom" if is_custom_project(srv, project) else "default",
        age_days=0,
        size_bytes=size,
        score=0,
        dry_run=False,
    )
    db.add(log)
    db.commit()

    webdav_service.invalidate_cache()
    return {"message": f"Deleted {project}/{build}", "size_bytes": size}


def _find_server(config, server_name: str):
    """Find server by name, or return first server."""
    if server_name:
        for s in config.binary_servers:
            if s.name == server_name:
                return s
    return config.binary_servers[0]
