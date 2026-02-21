# 🛡️ SecAssess v15

**Comprehensive DevOps & DevSecOps Platform Assessment Tool**

SecAssess is a full-stack assessment platform for evaluating, documenting, and exporting DevSecOps practices across organizations. It features graph-based diagram editors, template-driven assessments, and multi-format export capabilities.

## 📁 Project Structure

```
secassess/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions: lint, SAST, SCA, gitleaks, SBOM, semver
├── backend/
│   ├── Dockerfile              # Multi-stage Node.js 20 Alpine image
│   ├── package.json            # Express, pg, exceljs, multer
│   └── server.js               # REST API — CRUD, import/export, input validation
├── frontend/
│   ├── Dockerfile              # Multi-stage: React build → nginx
│   ├── nginx.conf              # Reverse proxy to backend /api
│   ├── src/
│   │   ├── App.js              # Main app — 11 tabs, routing, state management
│   │   ├── components/
│   │   │   ├── AssessmentStep.js   # 126-control checklist with severity filters
│   │   │   ├── ArtifactRegistry.js # JFrog/Harbor/Nexus tree editor
│   │   │   ├── CiCdDiagram.js      # 11 CI/CD pipeline templates + graph editor
│   │   │   ├── ConfigStep.js        # Organization config + custom templates
│   │   │   ├── Dashboard.js         # Assessment list + import + truncate
│   │   │   ├── DeploymentStrategies.js # 18 deployment strategy templates
│   │   │   ├── GanttChart.js        # Drag-drop Gantt timeline
│   │   │   ├── GitFlowDiagram.js    # 6 branching strategy templates
│   │   │   ├── PricingStep.js       # Cost estimation with phases
│   │   │   ├── ReviewStep.js        # Score summary + 8-format export
│   │   │   ├── VersioningDiagram.js # 6 versioning scheme templates
│   │   │   └── WorkPlan.js          # Task breakdown with assignments
│   │   ├── data/
│   │   │   ├── assessmentData.js    # 126 controls across 11 categories
│   │   │   ├── cicdTemplates.js     # 11 CI/CD pipeline templates
│   │   │   ├── deploymentTemplates.js # 18 deployment strategies
│   │   │   ├── gitflowTemplates.js  # 6 Git branching templates
│   │   │   └── versioningTemplates.js # 6 versioning scheme templates
│   │   ├── utils/
│   │   │   ├── api.js               # REST client with all endpoints
│   │   │   ├── exporters.js         # Client-side HTML/Markdown/JSON export
│   │   │   └── graphEngine.js       # Shared: layout, export SVG/PNG, import
│   │   └── styles/
│   │       └── App.css              # Dark theme, responsive, print styles
│   └── public/
│       └── index.html
├── docker-compose.yml          # 3-service stack (postgres, backend, frontend)
├── .env.example                # Template for secrets — copy to .env
├── .gitignore                  # Excludes .env, node_modules, build
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose (v2+)
- OR Node.js 20+ and PostgreSQL 16+

### Docker (recommended)

```bash
# 1. Clone and configure
git clone <repo-url> && cd secassess
cp .env.example .env
# Edit .env — set DB_PASS to a strong password

# 2. Start all services
docker compose up -d

# 3. Open browser
open http://localhost:3000
```

### Local Development

```bash
# Backend
cd backend && npm install
DB_HOST=localhost DB_PASS=yourpassword node server.js

# Frontend (separate terminal)
cd frontend && npm install --legacy-peer-deps
REACT_APP_API_URL=http://localhost:4000/api npm start
```

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL  │
│  React SPA   │     │  Express API │     │   JSONB      │
│  nginx:8080  │     │  port:4000   │     │  port:5432   │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Data Flow:**
1. Frontend React components manage state via `useState` hooks
2. Save/Load triggers REST calls to Express backend
3. Backend uses parameterized queries (SQL injection safe) with PostgreSQL
4. JSONB columns store complex nested data (diagrams, workflows, etc.)
5. All input is sanitized via `san()` helper — strips null bytes, trims, limits length

## 📊 Features — 11 Assessment Tabs

| Tab | Description |
|-----|-------------|
| ⚙️ Configure | Organization name, assessor, environment, custom templates |
| 🔍 Assess | 126 security controls across 11 categories with severity filters |
| 🔄 CI/CD | 11 pipeline templates (MLOps, AIOps, AWS, air-gapped, hybrid cloud) |
| 🌿 Git Flow | 6 branching strategies (feature branch, trunk, GitHub/GitLab flow) |
| 🚀 Deploy Strategy | 18 deployment templates (blue-green, canary, air-gapped, edge) |
| 🏷️ Versioning | 6 versioning schemes (SemVer, CalVer, hash-based, monorepo) |
| 📦 Artifacts | JFrog Artifactory, Harbor, Nexus registry tree editors |
| 💰 Pricing | Cost estimation with engineer count, phases, currency |
| 📅 Gantt | Drag-drop timeline with task dependencies |
| 📋 Work Plan | Task breakdown with assignees and milestones |
| 📊 Review & Export | Score summary + export to 8 formats |

## 📤 Export Formats

| Format | Method | Notes |
|--------|--------|-------|
| HTML | Client-side | Styled dark-theme report |
| Markdown | Client-side | For wikis, Git, documentation |
| JSON | Client-side | Full structured data with all tabs |
| Excel | Server-side | Multi-sheet workbook (all tabs) |
| PDF | Server-side | HTML page with print styles — use Ctrl+P |
| XML | Server-side | Structured XML with CDATA sections |
| SQL | Server-side | INSERT statement for PostgreSQL |
| ZIP Bundle | Server-side | Complete assessment as portable JSON |

## 🔒 Security

- **No hardcoded secrets** — all credentials via `.env` file
- **Input validation** — `san()` sanitizes all text inputs
- **Parameterized queries** — prevents SQL injection (uses `$1, $2...` placeholders)
- **CI/CD gates** — Gitleaks (secret scanning), Semgrep (SAST), npm audit (SCA)
- **SBOM generation** — CycloneDX format for supply chain transparency
- **Docker non-root** — backend runs as `secassess` user (UID 1001)

## 🔄 CI/CD Pipeline (GitHub Actions)

Triggered on push to `main` and all PRs:

```
┌─────────────┐  ┌────────┐  ┌───────────┐  ┌─────────┐
│ Secret Scan │  │  SAST  │  │ Lint+Test │  │   SCA   │
│  Gitleaks   │  │Semgrep │  │  Build    │  │npm audit│
└──────┬──────┘  └───┬────┘  └─────┬─────┘  └────┬────┘
       └─────────────┴─────────────┴──────────────┘
                           │
                    ┌──────▼──────┐
                    │  SBOM Gen   │
                    │ CycloneDX   │
                    └──────┬──────┘
                           │ (main only)
                    ┌──────▼──────┐
                    │ SemVer Bump │
                    │  Auto-tag   │
                    └─────────────┘
```

## 📐 Graph Engine

All diagram tabs (CI/CD, Git Flow, Deploy, Versioning) share `graphEngine.js`:

```javascript
// Topological layout — longest-path column assignment
layoutGraph(nodes, edges) → { columns, positions }

// Export helpers
exportAsJSON(data, filename)       // Download as .json
exportSVGElement(svgEl, filename)  // Download as .svg
exportSVGAsPNG(svgEl, filename)    // Download as .png (2x resolution)

// Import with collision avoidance
remapPipeline(pipeline)            // Remap all node IDs to avoid duplicates
```

## 🗄️ Database Schema

```sql
CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  org_name TEXT, assessor_name TEXT, assessment_date TEXT,
  environment TEXT, scope TEXT, template TEXT,
  responses JSONB,              -- Assessment control responses
  pricing JSONB,                -- Cost estimation data
  gantt JSONB,                  -- Gantt chart tasks
  workplan JSONB,               -- Work plan items
  cicd_diagrams JSONB,          -- CI/CD workflow graphs
  gitflow_diagrams JSONB,       -- Git branching strategy graphs
  deployment_strategies JSONB,  -- Deployment pattern graphs
  versioning_diagrams JSONB,    -- Version scheme graphs
  artifact_repos JSONB,         -- Artifact registry trees
  custom_templates JSONB,       -- User-defined assessment templates
  score INTEGER, status TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);
```

## 📝 Version History

- **v15** — Versioning tab, server-side PDF/SQL/XML/ZIP exports, GitHub Actions CI/CD, SBOM, SemVer, enhanced Excel export, input validation, secrets management
- **v14** — Deployment Strategies (18 templates), hybrid cloud CI/CD, truncate, export section selection
- **v13** — CI/CD expansion (11 templates), Git Flow (6 templates), Artifact Registry, shared graph engine
- **v2** — Full-stack: PostgreSQL, Docker, 126 controls, Gantt, CI/CD diagrams, pricing, import/export

## 📄 License

MIT
