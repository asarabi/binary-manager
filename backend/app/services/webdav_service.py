import logging
import time
from datetime import datetime
from typing import Optional

from webdav3.client import Client

from ..config import get_config

logger = logging.getLogger(__name__)

_cache: dict = {}
_cache_time: float = 0
CACHE_TTL = 60  # seconds


def _get_client() -> Client:
    config = get_config().binary_server
    options = {
        "webdav_hostname": config.webdav_url,
        "webdav_timeout": 30,
    }
    return Client(options)


def _invalidate_cache():
    global _cache, _cache_time
    _cache = {}
    _cache_time = 0


def list_projects() -> list[str]:
    """List all project directories under the binary root."""
    config = get_config().binary_server
    client = _get_client()
    root = config.binary_root_path.rstrip("/") + "/"
    try:
        items = client.list(root)
        # Filter out the root itself and non-directory items
        projects = [
            item.strip("/").split("/")[-1]
            for item in items
            if item.strip("/") and item.strip("/") != root.strip("/")
        ]
        return sorted(projects)
    except Exception as e:
        logger.error("Failed to list projects: %s", e)
        return []


def list_builds(project: str) -> list[dict]:
    """List all builds under a project with their modification times."""
    global _cache, _cache_time

    cache_key = f"builds:{project}"
    now = time.time()
    if cache_key in _cache and (now - _cache_time) < CACHE_TTL:
        return _cache[cache_key]

    config = get_config().binary_server
    client = _get_client()
    project_path = f"{config.binary_root_path.rstrip('/')}/{project}/"

    try:
        items = client.list(project_path)
    except Exception as e:
        logger.error("Failed to list builds for %s: %s", project, e)
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
                # Try common WebDAV date formats
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

        return {
            "build_number": build_name,
            "modified_at": modified_dt,
        }
    except Exception as e:
        logger.warning("Failed to get info for %s%s: %s", project_path, build_name, e)
        return {
            "build_number": build_name,
            "modified_at": datetime.utcnow(),
        }


def invalidate_cache():
    _invalidate_cache()
