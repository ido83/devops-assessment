# 🛡️ SecAssess v2 — DevOps & DevSecOps Assessment Platform

Full-stack application for creating, managing, and exporting DevOps/DevSecOps security assessments with project planning tools.

## Features

- **Dashboard** — List, search, duplicate, delete all assessments
- **CRUD** — Full create/read/update/delete with SQLite persistence
- **Import/Export** — JSON, Markdown, HTML, and Excel formats
- **70+ Security Controls** across 8 categories
- **5 Assessment Templates** — Full, DevSecOps, DevOps, Critical, Supply Chain
- **Pricing Estimator** — Engineers, duration, hourly rate, phase allocation
- **Gantt Chart** — Visual remediation timeline with editable tasks
- **Work Plan** — Milestones, team structure, risk register
- **Dark Elegant UI**

## Quick Start

```bash
docker compose up --build -d
```

Open **http://localhost:3000**

## Architecture

```
├── docker-compose.yml
├── backend/          # Express + SQLite API
│   ├── server.js     # REST endpoints, import/export
│   └── Dockerfile
└── frontend/         # React SPA
    ├── src/
    │   ├── components/
    │   │   ├── Dashboard.js      # Assessment list + CRUD
    │   │   ├── ConfigStep.js     # Metadata & template
    │   │   ├── AssessmentStep.js # Security checklist
    │   │   ├── PricingStep.js    # Cost estimation
    │   │   ├── GanttChart.js     # Timeline planner
    │   │   ├── WorkPlan.js       # Milestones & risks
    │   │   └── ReviewStep.js     # Summary & export
    │   ├── utils/
    │   │   ├── api.js            # API client
    │   │   └── exporters.js      # JSON/MD/HTML export
    │   └── data/
    │       └── assessmentData.js # Controls & templates
    ├── nginx.conf
    └── Dockerfile
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/assessments | List all |
| GET | /api/assessments/:id | Get one |
| POST | /api/assessments | Create |
| PUT | /api/assessments/:id | Update |
| DELETE | /api/assessments/:id | Delete |
| POST | /api/import/json | Import JSON file/data |
| GET | /api/export/excel/:id | Download as Excel |

## Data Persistence

SQLite database stored in a Docker volume (`db-data`). Data survives container restarts.
