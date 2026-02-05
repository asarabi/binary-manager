# Agent Instructions - Binary Retention Manager

## Role
You are working on a binary retention management system that monitors and cleans up Android build artifacts on a remote server.

## Quick Reference

### Architecture
```
[Browser] → [nginx:80] → [React SPA]
                       → /api/* → [FastAPI:8000] → [WebDAV] (read builds)
                                                  → [SSH]    (disk check, delete)
                                                  → [SQLite] (logs)
```

### Core Flow
1. User logs in with shared password → gets JWT token
2. Dashboard shows disk usage, project/build counts
3. Scheduled or manual cleanup:
   - Check disk via SSH `df`
   - If >= 90%, collect builds via WebDAV
   - Score each build: `priority * 1000 + remaining_days * 10`
   - Delete lowest-score builds first via SSH `rm -rf`
   - Stop when disk <= 80%

### File Locations

| What | Where |
|------|-------|
| FastAPI app | `backend/app/main.py` |
| Config loader | `backend/app/config.py` |
| Runtime config | `backend/config.yaml` |
| DB models | `backend/app/models.py` |
| API schemas | `backend/app/schemas.py` |
| Auth (JWT) | `backend/app/auth.py` |
| API routes | `backend/app/routers/*.py` |
| Business logic | `backend/app/services/*.py` |
| Cleanup algorithm | `backend/app/services/retention_engine.py` |
| Tests | `backend/tests/` |
| React entry | `frontend/src/main.tsx` |
| API client | `frontend/src/api/client.ts` |
| Pages | `frontend/src/pages/*.tsx` |
| Components | `frontend/src/components/*.tsx` |

### API Endpoints

```
POST /api/auth/login              # {password} → {access_token}
GET  /api/dashboard/stats         # Disk usage, project/build counts
GET  /api/binaries                # Project list with retention types
GET  /api/binaries/{project}      # Build list with scores
DELETE /api/binaries/{p}/{b}      # Manual delete
GET  /api/config                  # Current config
PUT  /api/config                  # Update config
POST /api/cleanup/trigger         # {dry_run: bool}
GET  /api/cleanup/status          # Running state
GET  /api/logs/runs               # Cleanup run history
GET  /api/logs                    # Deletion detail logs
GET  /api/health                  # Health check
```

## Development Guidelines

### Adding a New Retention Type
1. Add entry to `retention_types` in `config.yaml`
2. Add corresponding `project_mappings` pattern
3. Optionally add color mapping in `frontend/src/components/RetentionBadge.tsx`

### Adding a New API Endpoint
1. Create or extend a router in `backend/app/routers/`
2. Add Pydantic schemas in `backend/app/schemas.py`
3. Register router in `backend/app/main.py` if new file
4. Add API call in `frontend/src/api/client.ts`

### Adding a New Frontend Page
1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add sidebar link in `frontend/src/components/Sidebar.tsx`

### Testing
```bash
cd backend && python -m pytest tests/ -v
```
- Score computation tests are pure functions (no external deps)
- For service-level tests, mock `ssh_service` and `webdav_service`

## Important Constraints
- All timestamps UTC
- Builds modified < 10 min ago are never deleted (rsync protection)
- WebDAV cache TTL: 60 seconds
- JWT tokens expire after 24 hours
- Config changes via API are persisted to `config.yaml`
- Cleanup runs in background thread (non-blocking API response)
- Only one cleanup can run at a time (mutex via `_cleanup_running` flag)
