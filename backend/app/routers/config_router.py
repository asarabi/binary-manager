import logging

import httpx
from fastapi import APIRouter, Depends
from webdav3.client import Client as WebDAVClient

from ..auth import get_current_user
from ..config import BinaryServerConfig, get_config, save_config
from ..schemas import (
    BinaryServerSchema,
    ConfigResponse,
    ConfigUpdate,
    ProjectMappingSchema,
    RetentionTypeSchema,
)
from ..services.scheduler_service import reschedule

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=ConfigResponse)
def get_current_config(user: str = Depends(get_current_user)):
    config = get_config()
    return ConfigResponse(
        binary_servers=[s.model_dump() for s in config.binary_servers],
        retention_types=[
            RetentionTypeSchema(name=rt.name, retention_days=rt.retention_days, priority=rt.priority)
            for rt in config.retention_types
        ],
        project_mappings=[
            ProjectMappingSchema(pattern=pm.pattern, type=pm.type)
            for pm in config.project_mappings
        ],
    )


@router.put("")
def update_config(update: ConfigUpdate, user: str = Depends(get_current_user)):
    config = get_config()

    if update.binary_servers is not None:
        config.binary_servers = [
            BinaryServerConfig(**s.model_dump())
            for s in update.binary_servers
        ]
        # Reschedule with shortest interval
        intervals = [s.check_interval_minutes for s in config.binary_servers] or [5]
        reschedule(min(intervals))

    if update.retention_types is not None:
        from ..config import RetentionType
        config.retention_types = [
            RetentionType(name=rt.name, retention_days=rt.retention_days, priority=rt.priority)
            for rt in update.retention_types
        ]
    if update.project_mappings is not None:
        from ..config import ProjectMapping
        config.project_mappings = [
            ProjectMapping(pattern=pm.pattern, type=pm.type)
            for pm in update.project_mappings
        ]

    save_config(config)
    return {"message": "Configuration updated"}


@router.post("/test-connection")
def test_connection(user: str = Depends(get_current_user)):
    """Test WebDAV and Disk Agent connectivity for all servers."""
    config = get_config()
    results = []

    for server in config.binary_servers:
        result = {"name": server.name, "webdav": {"ok": False, "message": ""}, "disk_agent": {"ok": False, "message": ""}}

        # Test WebDAV
        try:
            wc = WebDAVClient({
                "webdav_hostname": server.webdav_url,
                "webdav_timeout": 10,
            })
            wc.list(server.binary_root_path.rstrip("/") + "/")
            result["webdav"] = {"ok": True, "message": "Connected"}
        except Exception as e:
            result["webdav"] = {"ok": False, "message": str(e)}

        # Test Disk Agent
        try:
            resp = httpx.get(f"{server.disk_agent_url.rstrip('/')}/health", timeout=10)
            resp.raise_for_status()
            result["disk_agent"] = {"ok": True, "message": "Connected"}
        except Exception as e:
            result["disk_agent"] = {"ok": False, "message": str(e)}

        results.append(result)

    return results
