from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# Auth
class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Dashboard
class DiskUsage(BaseModel):
    total_bytes: int
    used_bytes: int
    free_bytes: int
    usage_percent: float


class DashboardStats(BaseModel):
    disk: DiskUsage
    total_projects: int
    total_builds: int
    cleanup_running: bool
    last_cleanup_at: Optional[datetime] = None


# Binaries
class BuildInfo(BaseModel):
    build_number: str
    modified_at: datetime
    age_days: float
    retention_type: str
    retention_days: int
    expired: bool
    score: float
    size_bytes: int = 0


class ProjectInfo(BaseModel):
    name: str
    retention_type: str
    build_count: int
    oldest_build: Optional[str] = None
    newest_build: Optional[str] = None


class ProjectDetail(BaseModel):
    name: str
    retention_type: str
    builds: list[BuildInfo]


# Config
class RetentionTypeSchema(BaseModel):
    name: str
    retention_days: int
    priority: int


class ProjectMappingSchema(BaseModel):
    pattern: str
    type: str


class ConfigUpdate(BaseModel):
    trigger_threshold_percent: Optional[int] = None
    target_threshold_percent: Optional[int] = None
    check_interval_minutes: Optional[int] = None
    retention_types: Optional[list[RetentionTypeSchema]] = None
    project_mappings: Optional[list[ProjectMappingSchema]] = None


class ConfigResponse(BaseModel):
    binary_server: dict
    disk: dict
    retention_types: list[RetentionTypeSchema]
    project_mappings: list[ProjectMappingSchema]


# Cleanup
class CleanupTriggerRequest(BaseModel):
    dry_run: bool = False


class CleanupStatusResponse(BaseModel):
    running: bool
    current_run_id: Optional[int] = None
    progress: Optional[str] = None


class CleanupRunResponse(BaseModel):
    id: int
    started_at: datetime
    finished_at: Optional[datetime]
    trigger: str
    dry_run: bool
    disk_usage_before: Optional[float]
    disk_usage_after: Optional[float]
    builds_deleted: int
    bytes_freed: int
    status: str
    error_message: Optional[str]


# Logs
class CleanupLogResponse(BaseModel):
    id: int
    run_id: int
    deleted_at: datetime
    project_name: str
    build_number: str
    retention_type: str
    age_days: float
    size_bytes: int
    score: float
    dry_run: bool


class PaginatedLogs(BaseModel):
    items: list[CleanupLogResponse]
    total: int
    page: int
    page_size: int
