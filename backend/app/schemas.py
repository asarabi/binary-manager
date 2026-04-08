from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# Auth
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "user"


# Dashboard
class DiskUsage(BaseModel):
    total_bytes: int
    used_bytes: int
    free_bytes: int
    usage_percent: float


class ServerStats(BaseModel):
    name: str
    disk: DiskUsage
    project_count: int
    build_count: int


class DashboardStats(BaseModel):
    servers: list[ServerStats]
    cleanup_running: bool
    last_cleanup_at: Optional[datetime] = None


# Binaries
class BuildInfo(BaseModel):
    build_number: str
    modified_at: datetime
    age_days: float
    retention_days: int
    remaining_days: float
    expired: bool
    size_bytes: int = 0


class ProjectInfo(BaseModel):
    name: str
    retention_days: int
    is_custom: bool
    build_count: int
    oldest_build: Optional[str] = None
    newest_build: Optional[str] = None
    server: str = ""


class ProjectDetail(BaseModel):
    name: str
    retention_days: int
    is_custom: bool
    builds: list[BuildInfo]


# Config
class CustomProjectSchema(BaseModel):
    path: str
    retention_days: int


class BinaryServerSchema(BaseModel):
    name: str = "default"
    disk_agent_url: str = ""
    binary_root_path: str = "/data/binaries"
    project_depth: int = 1
    trigger_threshold_percent: int = 90
    target_threshold_percent: int = 80
    check_interval_minutes: int = 5
    custom_projects: list[CustomProjectSchema] = []


class RetentionConfigSchema(BaseModel):
    default_days: int = 7
    custom_default_days: int = 30
    log_retention_days: int = 30


class ConfigUpdate(BaseModel):
    binary_servers: Optional[list[BinaryServerSchema]] = None
    retention: Optional[RetentionConfigSchema] = None


class ConfigResponse(BaseModel):
    binary_servers: list[dict]
    retention: RetentionConfigSchema


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
    server_name: str = ""
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
