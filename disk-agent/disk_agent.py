#!/usr/bin/env python3
"""
Disk Agent - Binary Server
Lightweight HTTP server that reports disk usage.
Install on each binary server. No dependencies required (stdlib only).

Usage:
    python3 disk_agent.py --path /data/binaries --port 9090

Endpoints:
    GET /disk-usage              → overall disk usage for the monitored path
    GET /dir-size?path=sub/dir   → size of a subdirectory (relative to root)
    GET /health                  → health check
"""

import argparse
import json
import os
import shutil
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


ROOT_PATH = "/data/binaries"


class DiskAgentHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/disk-usage":
            self._handle_disk_usage()
        elif path == "/dir-size":
            params = parse_qs(parsed.query)
            rel_path = params.get("path", [""])[0]
            self._handle_dir_size(rel_path)
        elif path == "/health":
            self._json_response({"status": "ok"})
        else:
            self._json_response({"error": "Not found"}, 404)

    def _handle_disk_usage(self):
        try:
            usage = shutil.disk_usage(ROOT_PATH)
            self._json_response({
                "total_bytes": usage.total,
                "used_bytes": usage.used,
                "free_bytes": usage.free,
                "usage_percent": round(usage.used / usage.total * 100, 1),
            })
        except Exception as e:
            self._json_response({"error": str(e)}, 500)

    def _handle_dir_size(self, rel_path: str):
        if not rel_path:
            self._json_response({"error": "path parameter required"}, 400)
            return

        # Prevent path traversal
        full_path = os.path.normpath(os.path.join(ROOT_PATH, rel_path))
        if not full_path.startswith(os.path.normpath(ROOT_PATH)):
            self._json_response({"error": "Invalid path"}, 403)
            return

        if not os.path.exists(full_path):
            self._json_response({"error": "Path not found"}, 404)
            return

        try:
            total_size = 0
            for dirpath, _, filenames in os.walk(full_path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if os.path.isfile(fp):
                        total_size += os.path.getsize(fp)
            self._json_response({"path": rel_path, "size_bytes": total_size})
        except Exception as e:
            self._json_response({"error": str(e)}, 500)

    def _json_response(self, data: dict, status: int = 200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Compact log format
        print(f"[disk-agent] {args[0]}")


def main():
    global ROOT_PATH
    parser = argparse.ArgumentParser(description="Disk Agent for Binary Server")
    parser.add_argument("--path", default="/data/binaries", help="Path to monitor")
    parser.add_argument("--port", type=int, default=9090, help="HTTP port")
    args = parser.parse_args()

    ROOT_PATH = os.path.normpath(args.path)
    if not os.path.isdir(ROOT_PATH):
        print(f"Error: {ROOT_PATH} is not a directory")
        exit(1)

    server = HTTPServer(("0.0.0.0", args.port), DiskAgentHandler)
    print(f"Disk Agent listening on :{args.port}, monitoring: {ROOT_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
