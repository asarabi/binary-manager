#!/usr/bin/env python3
"""
Disk Agent - Binary Server
HTTP server that reports disk usage and manages files via FastAPI.
Install on each binary server.

Usage:
    # Development (auto-reload)
    uvicorn disk_agent:app --reload --host 0.0.0.0 --port 9090

    # Production
    uvicorn disk_agent:app --host 0.0.0.0 --port 9090

    # CLI mode
    python3 disk_agent.py --path /data/binaries --port 9090

Endpoints:
    GET  /disk-usage                → overall disk usage for the monitored path
    GET  /dir-size?path=sub/dir     → size of a subdirectory (relative to root)
    GET  /files/list?path=&depth=1  → list directories with mtime
    GET  /files/exists?path=sub/dir → check if a path exists
    DELETE /files?path=sub/dir      → delete a directory
    GET  /health                    → health check
"""

import argparse
import os
import shutil
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI, HTTPException, Query

ROOT_PATH = os.environ.get("DISK_AGENT_PATH", "/data/binaries")

app = FastAPI(title="Disk Agent", description="Binary Server Disk Usage & File Management Agent")


def _safe_full_path(rel_path: str) -> str:
    """Resolve relative path under ROOT_PATH, preventing path traversal."""
    full = os.path.normpath(os.path.join(ROOT_PATH, rel_path))
    if not full.startswith(os.path.normpath(ROOT_PATH)):
        raise HTTPException(status_code=403, detail="Invalid path")
    return full


# --- Disk usage endpoints ---

@app.get("/disk-usage")
def disk_usage():
    try:
        usage = shutil.disk_usage(ROOT_PATH)
        return {
            "total_bytes": usage.total,
            "used_bytes": usage.used,
            "free_bytes": usage.free,
            "usage_percent": round(usage.used / usage.total * 100, 1),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dir-size")
def dir_size(path: str = Query(..., description="Relative path to measure")):
    full_path = _safe_full_path(path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Path not found")

    try:
        total_size = 0
        for dirpath, _, filenames in os.walk(full_path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if os.path.isfile(fp):
                    total_size += os.path.getsize(fp)
        return {"path": path, "size_bytes": total_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- File management endpoints ---

@app.get("/files/list")
def list_files(
    path: str = Query("", description="Relative path (empty = root)"),
    depth: int = Query(1, ge=1, le=10, description="Directory depth to scan"),
):
    """List directories at a given depth with modification times."""
    base = ROOT_PATH if not path else _safe_full_path(path)
    if not os.path.isdir(base):
        raise HTTPException(status_code=404, detail="Path not found")

    try:
        entries = _list_dirs_at_depth(base, depth, prefix="")
        return {"path": path, "entries": entries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _list_dirs_at_depth(base: str, depth: int, prefix: str) -> list[dict]:
    """Recursively list directories at a given depth."""
    if depth <= 0:
        return []

    try:
        items = sorted(os.listdir(base))
    except PermissionError:
        return []

    if depth == 1:
        results = []
        for item in items:
            full = os.path.join(base, item)
            if os.path.isdir(full):
                stat = os.stat(full)
                mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
                rel = f"{prefix}{item}" if prefix else item
                results.append({
                    "name": rel,
                    "modified_at": mtime.isoformat(),
                })
        return results

    results = []
    for item in items:
        full = os.path.join(base, item)
        if os.path.isdir(full):
            sub_prefix = f"{prefix}{item}/" if prefix else f"{item}/"
            results.extend(_list_dirs_at_depth(full, depth - 1, sub_prefix))
    return results


@app.get("/files/exists")
def file_exists(path: str = Query(..., description="Relative path to check")):
    """Check if a directory exists."""
    full_path = _safe_full_path(path)
    return {"path": path, "exists": os.path.exists(full_path)}


@app.delete("/files")
def delete_file(path: str = Query(..., description="Relative path to delete")):
    """Delete a directory and all its contents."""
    full_path = _safe_full_path(path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Path not found")

    try:
        shutil.rmtree(full_path)
        return {"path": path, "deleted": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Health ---

@app.get("/health")
def health():
    return {"status": "ok"}


def main():
    global ROOT_PATH
    parser = argparse.ArgumentParser(description="Disk Agent for Binary Server")
    parser.add_argument("--path", default="/data/binaries", help="Path to monitor")
    parser.add_argument("--port", type=int, default=9090, help="HTTP port")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    args = parser.parse_args()

    ROOT_PATH = os.path.normpath(args.path)
    if not os.path.isdir(ROOT_PATH):
        print(f"Error: {ROOT_PATH} is not a directory")
        exit(1)

    print(f"Disk Agent monitoring: {ROOT_PATH}")
    uvicorn.run(
        "disk_agent:app",
        host="0.0.0.0",
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
