# SecAssess v2 — DevOps & DevSecOps Assessment Platform

Full-stack security assessment platform with React, Express, PostgreSQL, and Docker.

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │───▶│   Backend    │───▶│  PostgreSQL  │
│ React+nginx  │    │  Express.js  │    │   16-alpine  │
│  :3000       │    │  :4000       │    │   :5432      │
└─────────────┘    └──────────────┘    └──────────────┘
  Multi-stage        Multi-stage         Persistent
  node → nginx       deps → runtime      pg-data volume
```

## Quick Start

```bash
docker compose up --build -d
# Open http://localhost:3000
```

## Services

| Service    | Image              | Port | Purpose           |
|------------|--------------------|------|-------------------|
| postgres   | postgres:16-alpine | 5432 | Database (JSONB)  |
| backend    | node:20-alpine     | 4000 | REST API          |
| frontend   | nginx:1.27-alpine  | 3000 | React SPA + proxy |

## Features

- **Dashboard** — Browse, search, duplicate, delete assessments
- **Configure** — Org metadata, custom templates with category builder
- **Assess** — 70+ security controls, floating collapse/scroll buttons
- **Pricing** — Multi-currency (ILS default), phase allocation
- **Gantt** — Drag-drop reorder, custom categories, timeline
- **Work Plan** — Milestones, team roles, risk register
- **Export** — JSON, Markdown, HTML, Excel

## Environment Variables

| Variable  | Default    | Description          |
|-----------|------------|----------------------|
| PORT      | 4000       | Backend port         |
| DB_HOST   | postgres   | PostgreSQL host      |
| DB_PORT   | 5432       | PostgreSQL port      |
| DB_NAME   | secassess  | Database name        |
| DB_USER   | secassess  | Database user        |
| DB_PASS   | secassess  | Database password    |

## Data Persistence

PostgreSQL data persists in Docker volume `pg-data`. To reset:

```bash
docker compose down -v  # removes volumes
docker compose up --build -d
```
