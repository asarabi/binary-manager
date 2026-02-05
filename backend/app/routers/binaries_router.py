import fnmatch
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import get_config
from ..database import get_db
from ..models import CleanupLog
from ..schemas import BuildInfo, ProjectDetail, ProjectInfo
from ..services import ssh_service, webdav_service

router = APIRouter(prefix="/api/binaries", tags=["binaries"])


def _get_retention_type(project_name: str) -> tuple[str, int, int]:
    """Returns (type_name, retention_days, priority) for a project."""
    config = get_config()
    matched_type = "nightly"
    for mapping in config.project_mappings:
        if fnmatch.fnmatch(project_name, mapping.pattern):
            matched_type = mapping.type
            break

    for rt in config.retention_types:
        if rt.name == matched_type:
            return rt.name, rt.retention_days, rt.priority

    return matched_type, 3, 1


@router.get("", response_model=list[ProjectInfo])
def list_projects(user: str = Depends(get_current_user)):
    projects = webdav_service.list_projects()
    result = []
    for name in projects:
        type_name, _, _ = _get_retention_type(name)
        builds = webdav_service.list_builds(name)
        build_numbers = [b["build_number"] for b in builds]
        result.append(
            ProjectInfo(
                name=name,
                retention_type=type_name,
                build_count=len(builds),
                oldest_build=min(build_numbers) if build_numbers else None,
                newest_build=max(build_numbers) if build_numbers else None,
            )
        )
    return result


@router.get("/{project}", response_model=ProjectDetail)
def get_project_builds(project: str, user: str = Depends(get_current_user)):
    type_name, retention_days, priority = _get_retention_type(project)
    builds = webdav_service.list_builds(project)

    now = datetime.utcnow()
    build_infos = []
    for b in builds:
        modified = b["modified_at"]
        age_days = (now - modified).total_seconds() / 86400
        remaining = retention_days - age_days
        score = priority * 1000 + remaining * 10
        build_infos.append(
            BuildInfo(
                build_number=b["build_number"],
                modified_at=modified,
                age_days=round(age_days, 1),
                retention_type=type_name,
                retention_days=retention_days,
                expired=age_days >= retention_days,
                score=round(score, 1),
            )
        )

    build_infos.sort(key=lambda b: b.build_number)
    return ProjectDetail(name=project, retention_type=type_name, builds=build_infos)


@router.delete("/{project}/{build}", status_code=status.HTTP_200_OK)
def delete_build(
    project: str,
    build: str,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    path = ssh_service.build_path(project, build)
    if not ssh_service.directory_exists(path):
        raise HTTPException(status_code=404, detail="Build not found")

    size = ssh_service.get_directory_size(path)
    success = ssh_service.delete_directory(path)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete build")

    # Log the manual deletion
    type_name, retention_days, _ = _get_retention_type(project)
    log = CleanupLog(
        run_id=0,  # 0 = manual
        project_name=project,
        build_number=build,
        retention_type=type_name,
        age_days=0,
        size_bytes=size,
        score=0,
        dry_run=False,
    )
    db.add(log)
    db.commit()

    webdav_service.invalidate_cache()
    return {"message": f"Deleted {project}/{build}", "size_bytes": size}
