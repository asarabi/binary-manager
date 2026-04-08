"""Disk Agent client - disk usage, directory sizes, file listing/deletion via HTTP API."""

import logging
import random
import time
from datetime import datetime, timedelta
from typing import Optional

import httpx

from ..config import BinaryServerConfig, get_config

logger = logging.getLogger(__name__)

_cache: dict = {}
_cache_time: float = 0
_CACHE_TTL = 60  # seconds

_DEMO_PROJECTS: dict[str, list[str]] = {
    "custom": ["automotive/dev", "automotive/release", "infotainment/dev"],
    "mobile": ["android", "ios", "flutter"],
}
_DEMO_BUILD_COUNT = 10


def _agent_url(server: BinaryServerConfig, path: str) -> str:
    return f"{server.disk_agent_url.rstrip('/')}{path}"


# --- Disk usage ---

def get_disk_usage(server: BinaryServerConfig) -> dict:
    """Get disk usage from the disk agent running on a binary server."""
    if get_config().demo_mode:
        total = 500 * 1024**3
        used = 425 * 1024**3
        free = total - used
        return {
            "total_bytes": total,
            "used_bytes": used,
            "free_bytes": free,
            "usage_percent": 85.0,
        }

    resp = httpx.get(_agent_url(server, "/disk-usage"), timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_directory_size(server: BinaryServerConfig, rel_path: str) -> int:
    """Get size of a directory via the disk agent."""
    if get_config().demo_mode:
        return random.randint(50, 500) * 1024 * 1024

    resp = httpx.get(_agent_url(server, "/dir-size"), params={"path": rel_path}, timeout=30)
    resp.raise_for_status()
    return resp.json()["size_bytes"]


# --- File listing ---

def _generate_demo_builds(project: str) -> list[dict]:
    now = datetime.utcnow()
    return [
        {"build_number": str(10000 + i), "modified_at": now - timedelta(days=i)}
        for i in range(1, _DEMO_BUILD_COUNT + 1)
    ]


def list_projects(server: BinaryServerConfig) -> list[str]:
    """List project directories under the binary root, scanning to project_depth levels."""
    if get_config().demo_mode:
        return sorted(_DEMO_PROJECTS.get(server.name, []))

    try:
        resp = httpx.get(
            _agent_url(server, "/files/list"),
            params={"path": "", "depth": server.project_depth},
            timeout=30,
        )
        resp.raise_for_status()
        entries = resp.json()["entries"]
        return sorted(e["name"] for e in entries)
    except Exception as e:
        logger.error("Failed to list projects on %s: %s", server.name, e)
        return []


def list_builds(server: BinaryServerConfig, project: str) -> list[dict]:
    """List all builds under a project with their modification times."""
    global _cache, _cache_time

    if get_config().demo_mode:
        return _generate_demo_builds(project)

    cache_key = f"{server.name}:builds:{project}"
    now = time.time()
    if cache_key in _cache and (now - _cache_time) < _CACHE_TTL:
        return _cache[cache_key]

    try:
        resp = httpx.get(
            _agent_url(server, "/files/list"),
            params={"path": project, "depth": 1},
            timeout=30,
        )
        resp.raise_for_status()
        entries = resp.json()["entries"]
    except Exception as e:
        logger.error("Failed to list builds for %s on %s: %s", project, server.name, e)
        return []

    builds = []
    for entry in entries:
        modified_str = entry["modified_at"]
        try:
            modified_dt = datetime.fromisoformat(modified_str.replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, AttributeError):
            modified_dt = datetime.utcnow()
        builds.append({"build_number": entry["name"], "modified_at": modified_dt})

    _cache[cache_key] = builds
    _cache_time = now
    return sorted(builds, key=lambda b: b["build_number"])


# --- File operations ---

def delete_build(server: BinaryServerConfig, project: str, build: str) -> bool:
    """Delete a build directory via disk agent."""
    if get_config().demo_mode:
        logger.info("[DEMO] Would delete: %s/%s", project, build)
        return True

    rel_path = f"{project}/{build}"
    try:
        resp = httpx.request("DELETE", _agent_url(server, "/files"), params={"path": rel_path}, timeout=30)
        resp.raise_for_status()
        logger.info("Deleted: %s/%s on %s", project, build, server.name)
        return True
    except Exception as e:
        logger.error("Failed to delete %s/%s on %s: %s", project, build, server.name, e)
        return False


def build_exists(server: BinaryServerConfig, project: str, build: str) -> bool:
    """Check if a build directory exists."""
    if get_config().demo_mode:
        return True

    rel_path = f"{project}/{build}"
    try:
        resp = httpx.get(_agent_url(server, "/files/exists"), params={"path": rel_path}, timeout=10)
        resp.raise_for_status()
        return resp.json()["exists"]
    except Exception:
        return False


def invalidate_cache():
    global _cache, _cache_time
    _cache = {}
    _cache_time = 0
