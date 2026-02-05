# Binary Retention Manager - Claude Code Instructions

## Project Overview
Android build binary retention manager with FastAPI backend and React frontend.
Monitors disk usage on a remote binary server via WebDAV/SSH, auto-deletes builds based on retention policies.

## Tech Stack
- **Backend**: Python 3.12, FastAPI, SQLAlchemy (SQLite), paramiko (SSH), webdavclient3
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, lucide-react icons
- **Deploy**: Docker Compose (backend + nginx frontend)

## Project Structure
```
backend/app/           # FastAPI application
  main.py              # Entry point, CORS, lifespan
  config.py            # YAML config loader (Pydantic models)
  auth.py              # JWT auth (shared password)
  database.py          # SQLite engine + session
  models.py            # SQLAlchemy models (CleanupRun, CleanupLog)
  schemas.py           # Pydantic request/response schemas
  routers/             # API route handlers
  services/            # Business logic (ssh, webdav, retention engine, scheduler)
backend/tests/         # pytest tests
backend/config.yaml    # Runtime configuration
frontend/src/          # React SPA
  api/client.ts        # Axios API client with JWT interceptor
  context/             # React contexts (AuthContext)
  pages/               # Page components
  components/          # Shared UI components
```

## Commands

### Backend
```bash
# Run tests
cd backend && python -m pytest tests/ -v

# Run dev server
cd backend && uvicorn app.main:app --reload --port 8000

# Install dependencies
pip install -r backend/requirements.txt
```

### Frontend
```bash
# Install dependencies
cd frontend && npm install

# Run dev server (proxies /api to localhost:8000)
cd frontend && npm run dev

# Build for production
cd frontend && npm run build
```

### Docker
```bash
docker-compose up --build        # Full stack
docker-compose up -d             # Detached
docker-compose down              # Stop
```

## Key Design Decisions

### Retention Score Algorithm
`score = priority * 1000 + remaining_days * 10`
- Lower score = deleted first
- Priority groups builds by type (nightly=1, release=3)
- Within same priority, more-expired builds deleted first

### Hysteresis Cleanup
- Trigger cleanup at 90% disk usage
- Stop cleanup at 80% disk usage
- Prevents rapid on/off cycling

### Safety Guards
- Builds modified < 10 minutes ago are skipped (rsync protection)
- WebDAV results cached for 60 seconds
- SSH connection pooling (single persistent connection)

## Coding Conventions

### Backend
- All API routes under `/api/` prefix
- Router files: `{domain}_router.py`
- Service files: `{domain}_service.py`
- All timestamps in UTC
- Use Pydantic models for all request/response schemas
- SQLAlchemy mapped_column style for models

### Frontend
- Functional components with hooks
- API calls via `src/api/client.ts` (centralized Axios instance)
- Tailwind utility classes for styling (no CSS modules)
- lucide-react for icons
- react-router-dom v7 for routing

## Config File (`backend/config.yaml`)
- `binary_server`: WebDAV URL, SSH credentials, binary root path
- `disk`: trigger/target thresholds, check interval
- `retention_types`: list of {name, retention_days, priority}
- `project_mappings`: glob pattern → retention type mapping
- `auth`: shared_password, jwt_secret

## Testing
- Unit tests focus on `retention_engine.py` score computation
- Tests are pure functions, no mocking needed for score tests
- Run from `backend/` directory: `python -m pytest tests/ -v`
