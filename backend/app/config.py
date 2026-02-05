import os
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel


class BinaryServerConfig(BaseModel):
    webdav_url: str = "http://binary-server:8080"
    ssh_host: str = "binary-server"
    ssh_port: int = 22
    ssh_username: str = "binmanager"
    ssh_key_path: str = "/home/app/.ssh/id_rsa"
    binary_root_path: str = "/data/binaries"


class DiskConfig(BaseModel):
    trigger_threshold_percent: int = 90
    target_threshold_percent: int = 80
    check_interval_minutes: int = 5


class RetentionType(BaseModel):
    name: str
    retention_days: int
    priority: int


class ProjectMapping(BaseModel):
    pattern: str
    type: str


class AuthConfig(BaseModel):
    shared_password: str = "changeme"
    jwt_secret: str = "change-this-to-a-random-secret-in-production"


class AppConfig(BaseModel):
    demo_mode: bool = False
    binary_server: BinaryServerConfig = BinaryServerConfig()
    disk: DiskConfig = DiskConfig()
    retention_types: list[RetentionType] = []
    project_mappings: list[ProjectMapping] = []
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
