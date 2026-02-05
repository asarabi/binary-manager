---
name: docker-stack
description: Manage the Docker Compose stack (start, stop, logs, status)
argument-hint: [up|down|logs|status|rebuild]
user-invocable: true
allowed-tools: Bash
---

# Docker Stack Management

Manage the binary-manager Docker Compose stack.

## Commands

Based on the argument provided:

| Argument | Command | Description |
|---|---|---|
| `up` | `docker compose up -d` | Start in detached mode |
| `down` | `docker compose down` | Stop and remove containers |
| `logs` | `docker compose logs --tail=50` | Show recent logs |
| `status` | `docker compose ps` | Show container status |
| `rebuild` | `docker compose up --build -d` | Rebuild and start |

If no argument is given, run `docker compose ps` to show current status.

## Working Directory

Always run from: `/home/ck21im/dev/binary-manager`

## After Actions

- After `up` or `rebuild`: verify containers are running with `docker compose ps`
- After `down`: confirm all containers stopped
- After `logs`: summarize any errors found
