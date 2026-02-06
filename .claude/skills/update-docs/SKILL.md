---
name: update-docs
description: Update all project documentation (README.md, CLAUDE.md) to match current codebase
user-invocable: true
allowed-tools: Read, Edit, Glob, Grep, Bash
---

# Update Documentation

Scan the codebase and update all documentation files to reflect the current state.

## Files to Update

1. **README.md** - User-facing documentation (Korean)
2. **CLAUDE.md** - Claude Code instructions (English)

## Steps

### 1. Gather Current State

Read these files to understand the current implementation:

```
backend/app/database.py          # DB type (SQLite/MySQL/PostgreSQL)
backend/app/main.py              # API structure, routers
backend/requirements.txt         # Dependencies
docker-compose.yml               # Services, volumes, ports
backend/config.yaml              # Config structure
frontend/package.json            # Frontend dependencies
```

Also run:
```bash
ls backend/app/routers/          # List all routers
ls backend/app/services/         # List all services
```

### 2. Check for Inconsistencies

Compare gathered info against current docs. Common issues:
- Database type mismatch (SQLite vs MySQL)
- Missing or renamed API routes
- Outdated docker-compose structure
- Changed dependencies
- New/removed services or routers

### 3. Update Documentation

For each doc file, update:
- Tech stack section (database, dependencies)
- Architecture diagram
- Project structure (if files added/removed)
- Docker commands (if compose structure changed)
- API endpoints (if routes changed)

### 4. Report Changes

Output a summary of what was updated:
```
## Documentation Updated

### README.md
- Updated database type: SQLite → MySQL
- Added setup.sh instructions

### CLAUDE.md
- Updated Tech Stack section
- Updated Project Structure

No changes needed for: [list unchanged files]
```

## Rules

- Keep README.md in Korean
- Keep CLAUDE.md in English
- Preserve existing formatting and structure
- Only update factually incorrect information
- Do not add new sections unless necessary
- Do not change coding conventions unless they no longer apply
