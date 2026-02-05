from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..config import get_config, save_config
from ..schemas import (
    ConfigResponse,
    ConfigUpdate,
    ProjectMappingSchema,
    RetentionTypeSchema,
)
from ..services.scheduler_service import reschedule

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=ConfigResponse)
def get_current_config(user: str = Depends(get_current_user)):
    config = get_config()
    return ConfigResponse(
        binary_server=config.binary_server.model_dump(),
        disk=config.disk.model_dump(),
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

    if update.trigger_threshold_percent is not None:
        config.disk.trigger_threshold_percent = update.trigger_threshold_percent
    if update.target_threshold_percent is not None:
        config.disk.target_threshold_percent = update.target_threshold_percent
    if update.check_interval_minutes is not None:
        config.disk.check_interval_minutes = update.check_interval_minutes
        reschedule(update.check_interval_minutes)
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
