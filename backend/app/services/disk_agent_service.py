"""Disk Agent client - gets disk usage and directory sizes via HTTP API."""

import logging
import random

import httpx

from ..config import BinaryServerConfig, get_config

logger = logging.getLogger(__name__)


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

    url = f"{server.disk_agent_url.rstrip('/')}/disk-usage"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_directory_size(server: BinaryServerConfig, rel_path: str) -> int:
    """Get size of a directory via the disk agent."""
    if get_config().demo_mode:
        return random.randint(50, 500) * 1024 * 1024

    url = f"{server.disk_agent_url.rstrip('/')}/dir-size"
    resp = httpx.get(url, params={"path": rel_path}, timeout=30)
    resp.raise_for_status()
    return resp.json()["size_bytes"]
