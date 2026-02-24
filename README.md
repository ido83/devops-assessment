# SecAssess v2.1.0

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
│   │   ├── App.js              # Main app — 12 tabs, routing, state management
│   │   ├── components/
│   │   │   ├── AssessmentStep.js   # 126-control checklist with severity filters
│   │   │   ├── ArtifactRegistry.js # JFrog/Harbor/Nexus tree editor
│   │   │   ├── CiCdDiagram.js      # 11 CI/CD pipeline templates + graph editor
│   │   │   ├── ConfigStep.js        # Organization config + custom templates
│   │   │   ├── Dashboard.js         # Assessment list + import + truncate
│   │   │   ├── DeploymentStrategies.js # 18 deployment strategy templates
│   │   │   ├── GanttChart.js        # Drag-drop Gantt timeline
│   │   │   ├── GitFlowDiagram.js    # 6 branching strategy templates
│   │   │   ├── PromotionDiagram.js  # 8 promotion workflow templates
│   │   │   ├── PricingStep.js       # Cost estimation with phases
│   │   │   ├── ReviewStep.js        # Score summary + 8-format export
│   │   │   ├── VersioningDiagram.js # 6 versioning scheme templates
│   │   │   └── WorkPlan.js          # Task breakdown with assignments
│   │   ├── data/
│   │   │   ├── assessmentData.js    # 126 controls across 11 categories
│   │   │   ├── cicdTemplates.js     # 11 CI/CD pipeline templates
│   │   │   ├── deploymentTemplates.js # 18 deployment strategies
│   │   │   ├── gitflowTemplates.js  # 6 Git branching templates
│   │   │   ├── promotionTemplates.js  # 8 promotion workflow templates
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
├── secrets/
│   └── db_pass.txt.example     # Copy to db_pass.txt — set a strong password (gitignored)
├── .gitignore                  # Excludes .env, secrets/*.txt, node_modules, build
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose (v2+)
- OR Node.js 20+ and PostgreSQL 16+

### Docker (recommended)

```bash
# 1. Clone
git clone <repo-url> && cd secassess

# 2. Create .env with non-sensitive config
cat > .env <<EOF
DB_HOST=postgres
DB_PORT=5432
DB_NAME=<your_db_name>
DB_USER=<your_db_user>
PORT=4000
EOF

# 3. Create the DB password secret (never committed)
cp secrets/db_pass.txt.example secrets/db_pass.txt
# Edit secrets/db_pass.txt — replace placeholder with a strong password
# Tip: openssl rand -base64 24

# 4. Start all services — pass branch + SHA so they appear in the UI header
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build

# 5. Open browser
open http://localhost:3000
```

> **Why `GIT_BRANCH` and `GIT_SHA`?**
> The UI header displays `v<version> · <branch> · <sha>` (e.g. `v2.1.0 · main · 3cc00e3`).
> These are baked into the React bundle at build time — not read at runtime — so the container must be
> rebuilt with `--build` whenever the values should update.
> The version is read automatically from `frontend/package.json`.
> Without these env vars, they default to `main` and `dev` respectively.

### Local Development (without Docker)

```bash
# Backend
cd backend && npm install
DB_HOST=localhost DB_NAME=<your_db_name> DB_USER=<your_db_user> DB_PASS=<your_password> node server.js

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

## 📊 Features — 12 Assessment Tabs

| Tab | Description |
|-----|-------------|
| ⚙️ Configure | Organization name, assessor, environment, custom templates |
| 🔍 Assess | 126 security controls across 11 categories with severity filters |
| 🔄 CI/CD | 11 pipeline templates (MLOps, AIOps, AWS, air-gapped, hybrid cloud) |
| 🌿 Git Flow | 6 branching strategies (feature branch, trunk, GitHub/GitLab flow) |
| 🚀 Deploy Strategy | 18 deployment templates (blue-green, canary, air-gapped, edge) |
| 🎯 Promotion | 8 promotion workflow templates (artifact, env, hotfix, GitOps, feature flag, multi-region) |
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
| Excel | Server-side | Multi-sheet workbook (one sheet per tab + All_Diagrams) with embedded diagram images |
| PDF | Server-side | Full report with all sections + embedded diagram images |
| XML | Server-side | Structured XML with CDATA sections |
| SQL | Server-side | INSERT statement for PostgreSQL |
| ZIP Bundle | Server-side | PDF + XLSX + images/ + HTML + JSON + SQL + XML |

## 🔒 Security

- **Docker secrets** — DB password loaded from `secrets/db_pass.txt` mounted at `/run/secrets/db_pass`; never exposed via environment variables or `docker inspect`
- **No hardcoded fallbacks** — missing credentials cause a hard failure, not silent use of a default
- **Gitignored secrets** — `.env` and `secrets/*.txt` are excluded from version control; only `secrets/db_pass.txt.example` (placeholder) is committed
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

All diagram tabs (CI/CD, Git Flow, Deploy, Promotion, Versioning) share `graphEngine.js`:

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
  promotion_workflows JSONB,    -- Promotion workflow graphs
  versioning_diagrams JSONB,    -- Version scheme graphs
  artifact_repos JSONB,         -- Artifact registry trees
  custom_templates JSONB,       -- User-defined assessment templates
  score INTEGER, status TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);
```

## 📝 Version History

- **v21** — Promotion Workflows tab (8 templates, 10 node types), ZIP includes PDF+XLSX+images/, Excel All_Diagrams sheet + Gantt/WorkPlan sheets, PDF Gantt/WorkPlan sections, DevOps infinity logo, header redesign, branch+SHA in version line
- **v15** — Versioning tab, server-side PDF/SQL/XML/ZIP exports, GitHub Actions CI/CD, SBOM, SemVer, enhanced Excel export, input validation, secrets management
- **v14** — Deployment Strategies (18 templates), hybrid cloud CI/CD, truncate, export section selection
- **v13** — CI/CD expansion (11 templates), Git Flow (6 templates), Artifact Registry, shared graph engine
- **v2** — Full-stack: PostgreSQL, Docker, 126 controls, Gantt, CI/CD diagrams, pricing, import/export

## 📄 License

MIT
