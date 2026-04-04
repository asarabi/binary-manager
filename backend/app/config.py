import os
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel


class CustomProject(BaseModel):
    path: str
    retention_days: int


class BinaryServerConfig(BaseModel):
    name: str = "default"
    webdav_url: str = "http://binary-server:8080"
    disk_agent_url: str = "http://binary-server:9090"
    binary_root_path: str = "/data/binaries"
    project_depth: int = 1
    trigger_threshold_percent: int = 90
    target_threshold_percent: int = 80
    check_interval_minutes: int = 5
    custom_projects: list[CustomProject] = []


class RetentionConfig(BaseModel):
    default_days: int = 7
    custom_default_days: int = 30
    log_retention_days: int = 30


class UserAccount(BaseModel):
    username: str
    password: str
    role: str = "user"  # "admin" or "user"


class AuthConfig(BaseModel):
    users: list[UserAccount] = []
    jwt_secret: str = "change-this-to-a-random-secret-in-production"


class AppConfig(BaseModel):
    demo_mode: bool = False
    binary_servers: list[BinaryServerConfig] = [BinaryServerConfig()]
    retention: RetentionConfig = RetentionConfig()
    auth: AuthConfig = AuthConfig()


_config: Optional[AppConfig] = None
_config_path: Optional[Path] = None


def get_config_path() -> Path:
    global _config_path
    if _config_path:
        return _config_path
    env_path = os.environ.get("CONFIG_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).parent.parent / "config.yaml"


def load_config(path: Optional[Path] = None) -> AppConfig:
    global _config, _config_path
    if path:
        _config_path = path
    config_path = get_config_path()
    if config_path.exists():
        with open(config_path) as f:
            data = yaml.safe_load(f) or {}
        _config = AppConfig(**data)
    else:
        _config = AppConfig()
    return _config


def get_config() -> AppConfig:
    global _config
    if _config is None:
        return load_config()
    return _config


def save_config(config: AppConfig) -> None:
    global _config
    _config = config
    config_path = get_config_path()
    data = config.model_dump()
    with open(config_path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True)
