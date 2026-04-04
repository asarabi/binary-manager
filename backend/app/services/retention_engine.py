import logging
from datetime import datetime

from sqlalchemy.orm import Session

from ..config import BinaryServerConfig, get_config
from ..models import CleanupLog, CleanupRun
from . import disk_agent_service, webdav_service

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


def get_retention_days(server: BinaryServerConfig, project_path: str) -> int:
    """Returns retention_days for a project. Custom override or global default."""
    for cp in server.custom_projects:
        if cp.path == project_path:
            return cp.retention_days
    return get_config().retention.default_days


def is_custom_project(server: BinaryServerConfig, project_path: str) -> bool:
    """Check if a project has a custom retention override."""
    return any(cp.path == project_path for cp in server.custom_projects)


def compute_score(retention_days: int, age_days: float) -> float:
    """Compute deletion score. Lower score = delete first.
    Score is simply remaining_days: negative means expired."""
    return retention_days - age_days


def _collect_all_builds(server: BinaryServerConfig) -> list[dict]:
    """Collect all builds from all projects on a server with scoring info."""
    now = datetime.utcnow()
    projects = webdav_service.list_projects(server)
    all_builds = []

    for project in projects:
        retention_days = get_retention_days(server, project)
        builds = webdav_service.list_builds(server, project)

        for build in builds:
            modified = build["modified_at"]
            age_days = (now - modified).total_seconds() / 86400

            # Skip builds modified within last 10 minutes (may be in-progress upload)
            age_minutes = (now - modified).total_seconds() / 60
            if age_minutes < 10:
                logger.info("Skipping %s/%s (modified %d min ago, possibly in-progress)",
                            project, build["build_number"], int(age_minutes))
                continue

            score = compute_score(retention_days, age_days)
            all_builds.append({
                "server": server.name,
                "project": project,
                "build_number": build["build_number"],
                "modified_at": modified,
                "age_days": age_days,
                "retention_days": retention_days,
                "is_custom": is_custom_project(server, project),
                "score": score,
            })

    all_builds.sort(key=lambda b: b["score"])
    return all_builds


def _run_cleanup_for_server(
    server: BinaryServerConfig, db: Session, run: CleanupRun, dry_run: bool
) -> tuple[int, int]:
    """Run cleanup for a single server. Returns (builds_deleted, bytes_freed)."""
    global _progress

    trigger_threshold = server.trigger_threshold_percent
    target_threshold = server.target_threshold_percent

    disk_info = disk_agent_service.get_disk_usage(server)
    current_usage = disk_info["usage_percent"]

    if current_usage < trigger_threshold and not dry_run:
        _progress = f"[{server.name}] Disk {current_usage}% < trigger {trigger_threshold}%, skipping"
        logger.info(_progress)
        return 0, 0

    _progress = f"[{server.name}] Collecting build list..."
    all_builds = _collect_all_builds(server)
    logger.info("[%s] Found %d deletable builds", server.name, len(all_builds))

    builds_deleted = 0
    bytes_freed = 0

    if dry_run and len(all_builds) > 0:
        total_bytes = disk_info["total_bytes"]
        simulated_usage = current_usage
        estimated_size_per_build = total_bytes * (current_usage - target_threshold) / 100 / len(all_builds) * 2
    else:
        simulated_usage = current_usage
        estimated_size_per_build = 0

    for i, build in enumerate(all_builds):
        if dry_run:
            if simulated_usage <= target_threshold:
                _progress = f"[{server.name}] Target reached (simulated): {simulated_usage:.1f}% <= {target_threshold}%"
                logger.info(_progress)
                break
        else:
            disk_info = disk_agent_service.get_disk_usage(server)
            current_usage = disk_info["usage_percent"]
            if current_usage <= target_threshold:
                _progress = f"[{server.name}] Target reached: {current_usage}% <= {target_threshold}%"
                logger.info(_progress)
                break

        rel_path = f"{build['project']}/{build['build_number']}"
        size = disk_agent_service.get_directory_size(server, rel_path) if not dry_run else 0
        remaining = build["score"]

        _progress = f"{'[DRY RUN] ' if dry_run else ''}[{server.name}] Deleting {build['project']}/{build['build_number']} (remaining: {remaining:.1f}d) [{i+1}/{len(all_builds)}]"
        logger.info(_progress)

        if not dry_run:
            success = webdav_service.delete_build(server, build["project"], build["build_number"])
            if not success:
                logger.error("Failed to delete %s/%s on %s", build["project"], build["build_number"], server.name)
                continue

        log = CleanupLog(
            run_id=run.id,
            project_name=build["project"],
            build_number=build["build_number"],
            retention_type="custom" if build["is_custom"] else "default",
            age_days=build["age_days"],
            size_bytes=size,
            score=remaining,
            dry_run=dry_run,
        )
        db.add(log)
        builds_deleted += 1
        bytes_freed += size

        if dry_run:
            simulated_usage -= estimated_size_per_build / disk_info["total_bytes"] * 100

    return builds_deleted, bytes_freed


def run_cleanup(db: Session, trigger: str = "manual", dry_run: bool = False) -> CleanupRun:
    """Execute the cleanup algorithm across all servers."""
    global _cleanup_running, _current_run_id, _progress

    if _cleanup_running:
        raise RuntimeError("Cleanup already in progress")

    _cleanup_running = True
    _progress = "Starting..."

    config = get_config()
    first_server = config.binary_servers[0] if config.binary_servers else None
    disk_info = disk_agent_service.get_disk_usage(first_server) if first_server else {
        "usage_percent": 0, "total_bytes": 0, "used_bytes": 0, "free_bytes": 0
    }

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
        total_deleted = 0
        total_freed = 0

        for server in config.binary_servers:
            deleted, freed = _run_cleanup_for_server(server, db, run, dry_run)
            total_deleted += deleted
            total_freed += freed

        run.builds_deleted = total_deleted
        run.bytes_freed = total_freed
        run.finished_at = datetime.utcnow()
        run.status = "completed"

        if not dry_run and first_server:
            final_disk = disk_agent_service.get_disk_usage(first_server)
            run.disk_usage_after = final_disk["usage_percent"]
            webdav_service.invalidate_cache()
        else:
            run.disk_usage_after = disk_info["usage_percent"]

        db.commit()
        _progress = f"Completed: {total_deleted} builds deleted, {total_freed} bytes freed"
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
