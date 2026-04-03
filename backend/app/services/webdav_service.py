"""WebDAV client - file listing, deletion, and cache management."""

import logging
import time
from datetime import datetime, timedelta
from typing import Optional

from webdav3.client import Client

from ..config import BinaryServerConfig, get_config

logger = logging.getLogger(__name__)

_cache: dict = {}
_cache_time: float = 0
_CACHE_TTL = 60  # seconds

_DEMO_PROJECTS = ["ProjectA", "ProjectB", "Temp"]
_DEMO_BUILD_COUNTS = {"ProjectA": 10, "ProjectB": 10, "Temp": 10}


def _get_client(server: BinaryServerConfig) -> Client:
    options = {
        "webdav_hostname": server.webdav_url,
        "webdav_timeout": 30,
    }
    return Client(options)


def _generate_demo_builds(project: str) -> list[dict]:
    count = _DEMO_BUILD_COUNTS.get(project, 10)
    now = datetime.utcnow()
    return [
        {"build_number": f"B{i:04d}", "modified_at": now - timedelta(days=i)}
        for i in range(1, count + 1)
    ]


def list_projects(server: BinaryServerConfig) -> list[str]:
    """List all project directories under the binary root."""
    if get_config().demo_mode:
        return sorted(_DEMO_PROJECTS)

    client = _get_client(server)
    root = server.binary_root_path.rstrip("/") + "/"
    try:
        items = client.list(root)
        projects = [
            item.strip("/").split("/")[-1]
            for item in items
            if item.strip("/") and item.strip("/") != root.strip("/")
        ]
        return sorted(projects)
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

    client = _get_client(server)
    project_path = f"{server.binary_root_path.rstrip('/')}/{project}/"

    try:
        items = client.list(project_path)
    except Exception as e:
        logger.error("Failed to list builds for %s on %s: %s", project, server.name, e)
        return []

    builds = []
    for item in items:
        name = item.strip("/").split("/")[-1]
        if not name or name == project:
            continue
        info = _get_build_info(client, project_path, name)
        if info:
            builds.append(info)

    _cache[cache_key] = builds
    _cache_time = now
    return sorted(builds, key=lambda b: b["build_number"])


def _get_build_info(client: Client, project_path: str, build_name: str) -> Optional[dict]:
    build_path = f"{project_path}{build_name}/"
    try:
        info = client.info(build_path)
        modified = info.get("modified")
        if modified:
            if isinstance(modified, str):
                for fmt in [
                    "%a, %d %b %Y %H:%M:%S %Z",
                    "%Y-%m-%dT%H:%M:%SZ",
                    "%Y-%m-%dT%H:%M:%S",
                ]:
                    try:
                        modified_dt = datetime.strptime(modified, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    modified_dt = datetime.utcnow()
            else:
                modified_dt = modified
        else:
            modified_dt = datetime.utcnow()

        return {"build_number": build_name, "modified_at": modified_dt}
    except Exception as e:
        logger.warning("Failed to get info for %s%s: %s", project_path, build_name, e)
        return {"build_number": build_name, "modified_at": datetime.utcnow()}


def delete_build(server: BinaryServerConfig, project: str, build: str) -> bool:
    """Delete a build directory via WebDAV."""
    if get_config().demo_mode:
        logger.info("[DEMO] Would delete: %s/%s", project, build)
        return True

    client = _get_client(server)
    build_path = f"{server.binary_root_path.rstrip('/')}/{project}/{build}/"
    try:
        client.clean(build_path)
        logger.info("Deleted via WebDAV: %s/%s on %s", project, build, server.name)
        return True
    except Exception as e:
        logger.error("Failed to delete %s/%s on %s: %s", project, build, server.name, e)
        return False


def build_exists(server: BinaryServerConfig, project: str, build: str) -> bool:
    """Check if a build directory exists."""
    if get_config().demo_mode:
        return True

    client = _get_client(server)
    build_path = f"{server.binary_root_path.rstrip('/')}/{project}/{build}/"
    try:
        return client.check(build_path)
    except Exception:
        return False


def invalidate_cache():
    global _cache, _cache_time
    _cache = {}
    _cache_time = 0
