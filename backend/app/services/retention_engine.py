import fnmatch
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from ..config import get_config
from ..models import CleanupLog, CleanupRun
from . import ssh_service, webdav_service

logger = logging.getLogger(__name__)

# Module-level state for cleanup status
_cleanup_running = False
_current_run_id: int | None = None
_progress: str | None = None


def is_running() -> bool:
    return _cleanup_running


def get_status() -> dict:
    return {
        "running": _cleanup_running,
        "current_run_id": _current_run_id,
        "progress": _progress,
    }


def _get_retention_info(project_name: str) -> tuple[str, int, int]:
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


def compute_score(priority: int, retention_days: int, age_days: float) -> float:
    """Compute deletion score. Lower score = delete first."""
    remaining_days = retention_days - age_days
    return priority * 1000 + remaining_days * 10


def _collect_all_builds() -> list[dict]:
    """Collect all builds from all projects with scoring info."""
    now = datetime.utcnow()
    projects = webdav_service.list_projects()
    all_builds = []

    for project in projects:
        type_name, retention_days, priority = _get_retention_info(project)
        builds = webdav_service.list_builds(project)

        for build in builds:
            modified = build["modified_at"]
            age_days = (now - modified).total_seconds() / 86400

            # Skip builds modified within last 10 minutes (may be in-progress rsync)
            age_minutes = (now - modified).total_seconds() / 60
            if age_minutes < 10:
                logger.info("Skipping %s/%s (modified %d min ago, possibly in-progress)",
                            project, build["build_number"], int(age_minutes))
                continue

            score = compute_score(priority, retention_days, age_days)
            all_builds.append({
                "project": project,
                "build_number": build["build_number"],
                "modified_at": modified,
                "age_days": age_days,
                "retention_type": type_name,
                "retention_days": retention_days,
                "priority": priority,
                "score": score,
            })

    # Sort by score ascending (lower score = delete first)
    all_builds.sort(key=lambda b: b["score"])
    return all_builds


def run_cleanup(db: Session, trigger: str = "manual", dry_run: bool = False) -> CleanupRun:
    """Execute the cleanup algorithm."""
    global _cleanup_running, _current_run_id, _progress

    if _cleanup_running:
        raise RuntimeError("Cleanup already in progress")

    _cleanup_running = True
    _progress = "Starting..."

    config = get_config()
    trigger_threshold = config.disk.trigger_threshold_percent
    target_threshold = config.disk.target_threshold_percent

    # Create run record
    disk_info = ssh_service.get_disk_usage()
    run = CleanupRun(
        trigger=trigger,
        dry_run=dry_run,
        disk_usage_before=disk_info["usage_percent"],
        status="running",
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    _current_run_id = run.id

    try:
        current_usage = disk_info["usage_percent"]
        if current_usage < trigger_threshold and not dry_run:
            _progress = f"Disk usage {current_usage}% is below trigger threshold {trigger_threshold}%"
            logger.info(_progress)
            run.disk_usage_after = current_usage
            run.finished_at = datetime.utcnow()
            run.status = "completed"
            db.commit()
            return run

        _progress = "Collecting build list..."
        all_builds = _collect_all_builds()
        logger.info("Found %d deletable builds", len(all_builds))

        builds_deleted = 0
        bytes_freed = 0

        for i, build in enumerate(all_builds):
            # Check if we've reached target
            if not dry_run:
                disk_info = ssh_service.get_disk_usage()
                current_usage = disk_info["usage_percent"]
                if current_usage <= target_threshold:
                    _progress = f"Target reached: {current_usage}% <= {target_threshold}%"
                    logger.info(_progress)
                    break

            path = ssh_service.build_path(build["project"], build["build_number"])
            size = ssh_service.get_directory_size(path) if not dry_run else 0

            _progress = f"Deleting {build['project']}/{build['build_number']} (score: {build['score']:.1f}) [{i+1}/{len(all_builds)}]"
            logger.info(_progress)

            if not dry_run:
                success = ssh_service.delete_directory(path)
                if not success:
                    logger.error("Failed to delete %s", path)
                    continue

            # Log the deletion
            log = CleanupLog(
                run_id=run.id,
                project_name=build["project"],
                build_number=build["build_number"],
                retention_type=build["retention_type"],
                age_days=build["age_days"],
                size_bytes=size,
                score=build["score"],
                dry_run=dry_run,
            )
            db.add(log)
            builds_deleted += 1
            bytes_freed += size

        # Finalize
        run.builds_deleted = builds_deleted
        run.bytes_freed = bytes_freed
        run.finished_at = datetime.utcnow()
        run.status = "completed"

        if not dry_run:
            final_disk = ssh_service.get_disk_usage()
            run.disk_usage_after = final_disk["usage_percent"]
            webdav_service.invalidate_cache()
        else:
            run.disk_usage_after = run.disk_usage_before

        db.commit()
        _progress = f"Completed: {builds_deleted} builds deleted, {bytes_freed} bytes freed"
        logger.info(_progress)
        return run

    except Exception as e:
        logger.exception("Cleanup failed")
        run.status = "failed"
        run.error_message = str(e)
        run.finished_at = datetime.utcnow()
        db.commit()
        raise
    finally:
        _cleanup_running = False
        _current_run_id = None
