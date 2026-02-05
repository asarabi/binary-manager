---
name: atomic-commit
description: Break staged/unstaged changes into logically isolated, atomic commits. Each commit represents one complete unit of work.
argument-hint: [description of changes]
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# Atomic Commit

Create logically isolated, atomic commits from the current working tree changes.

## Process

1. **Analyze**: Run `git status` and `git diff --stat` to understand all changes.
2. **Classify**: Group changed files into logical units based on these categories (in commit order):
   - `backend:` Python/FastAPI code changes (`backend/app/`)
   - `test:` Test additions or modifications (`backend/tests/`)
   - `frontend:` React/TypeScript changes (`frontend/src/`)
   - `config:` Configuration files (`config.yaml`, `docker-compose.yml`, Dockerfiles)
   - `docs:` Documentation (`README.md`, `CLAUDE.md`, etc.)
   - `chore:` Dependencies, tooling, CI (`requirements.txt`, `package.json`)
3. **Split within category if needed**: If a category contains unrelated changes (e.g., two independent bug fixes in backend), split further.
4. **Stage and commit** each group separately using `git add <specific files>`. Never use `git add .` or `git add -A`.
5. **Verify** with `git log --oneline -10` after all commits.

## Commit Message Format

```
<type>: <concise summary in imperative mood>

- Bullet point explaining what changed
- Another bullet if needed

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Use HEREDOC for multi-line messages:
```bash
git commit -m "$(cat <<'EOF'
backend: Add retention score caching

- Cache computed scores for 60s to reduce CPU usage
- Invalidate cache on config change

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

## Rules

- One logical concern per commit
- Each commit should ideally pass tests independently
- Each commit should be independently revertable
- Keep commits small: 50-300 lines is ideal
- If a single file has changes belonging to different concerns, use `git add -p` to stage hunks separately
- Never commit files that contain secrets (`.env`, credentials)
- Verify each commit with `git diff --cached --stat` before committing

## Ordering

Commit in dependency order:
1. Data layer / models first
2. Business logic / services
3. API routes
4. Frontend components
5. Configuration
6. Documentation
