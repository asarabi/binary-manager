import logging
import re
from pathlib import PurePosixPath

import paramiko

from ..config import get_config

logger = logging.getLogger(__name__)

_client: paramiko.SSHClient | None = None


def _get_client() -> paramiko.SSHClient:
    global _client
    config = get_config().binary_server
    if _client is not None:
        transport = _client.get_transport()
        if transport and transport.is_active():
            return _client
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=config.ssh_host,
        port=config.ssh_port,
        username=config.ssh_username,
        key_filename=config.ssh_key_path,
        timeout=10,
    )
    _client = client
    return client


def close_connection():
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_disk_usage() -> dict:
    """Get disk usage for the binary root path using df."""
    config = get_config().binary_server
    client = _get_client()
    cmd = f"df -B1 {config.binary_root_path}"
    _, stdout, stderr = client.exec_command(cmd)
    output = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if err:
        logger.warning("df stderr: %s", err)

    lines = output.split("\n")
    if len(lines) < 2:
        raise RuntimeError(f"Unexpected df output: {output}")

    # Parse the second line: Filesystem 1B-blocks Used Available Use% Mounted
    parts = re.split(r"\s+", lines[1])
    total = int(parts[1])
    used = int(parts[2])
    free = int(parts[3])
    percent_str = parts[4].rstrip("%")
    usage_percent = float(percent_str)

    return {
        "total_bytes": total,
        "used_bytes": used,
        "free_bytes": free,
        "usage_percent": usage_percent,
    }


def get_directory_size(path: str) -> int:
    """Get size of a directory in bytes using du."""
    client = _get_client()
    cmd = f"du -sb {path}"
    _, stdout, stderr = client.exec_command(cmd)
    output = stdout.read().decode().strip()
    if not output:
        return 0
    return int(output.split()[0])


def delete_directory(path: str) -> bool:
    """Recursively delete a directory via SSH."""
    client = _get_client()
    cmd = f"rm -rf {path}"
    _, stdout, stderr = client.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    if exit_status != 0:
        err = stderr.read().decode()
        logger.error("Failed to delete %s: %s", path, err)
        return False
    logger.info("Deleted directory: %s", path)
    return True


def directory_exists(path: str) -> bool:
    """Check if a directory exists on the remote server."""
    client = _get_client()
    cmd = f"test -d {path} && echo yes || echo no"
    _, stdout, _ = client.exec_command(cmd)
    return stdout.read().decode().strip() == "yes"


def build_path(project: str, build: str) -> str:
    config = get_config().binary_server
    return str(PurePosixPath(config.binary_root_path) / project / build)
