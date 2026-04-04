import logging

import httpx
from fastapi import APIRouter, Depends
from webdav3.client import Client as WebDAVClient

from ..auth import get_current_user, require_admin
from ..config import (
    BinaryServerConfig,
    CustomProject,
    RetentionConfig,
    get_config,
    save_config,
)
from ..schemas import ConfigResponse, ConfigUpdate, RetentionConfigSchema
from ..services.scheduler_service import reschedule

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=ConfigResponse)
def get_current_config(user: str = Depends(get_current_user)):
    config = get_config()
    return ConfigResponse(
        binary_servers=[s.model_dump() for s in config.binary_servers],
        retention=RetentionConfigSchema(
            default_days=config.retention.default_days,
            custom_default_days=config.retention.custom_default_days,
            log_retention_days=config.retention.log_retention_days,
        ),
    )


@router.put("")
def update_config(update: ConfigUpdate, user: str = Depends(require_admin)):
    config = get_config()

    if update.binary_servers is not None:
        config.binary_servers = [
            BinaryServerConfig(
                name=s.name,
                webdav_url=s.webdav_url,
                disk_agent_url=s.disk_agent_url,
                binary_root_path=s.binary_root_path,
                project_depth=s.project_depth,
                trigger_threshold_percent=s.trigger_threshold_percent,
                target_threshold_percent=s.target_threshold_percent,
                check_interval_minutes=s.check_interval_minutes,
                custom_projects=[
                    CustomProject(path=cp.path, retention_days=cp.retention_days)
                    for cp in s.custom_projects
                ],
            )
            for s in update.binary_servers
        ]
        # Reschedule with shortest interval
        intervals = [s.check_interval_minutes for s in config.binary_servers] or [5]
        reschedule(min(intervals))

    if update.retention is not None:
        config.retention = RetentionConfig(
            default_days=update.retention.default_days,
            custom_default_days=update.retention.custom_default_days,
            log_retention_days=update.retention.log_retention_days,
        )

    save_config(config)
    return {"message": "Configuration updated"}


@router.post("/test-connection")
def test_connection(user: str = Depends(require_admin)):
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
