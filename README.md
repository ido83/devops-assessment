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
│   │   │   ├── diagramCapture.js    # SVG→PNG capture (3× scale, rounded corners)
│   │   │   ├── exporters.js         # Client-side HTML/Markdown/JSON export
│   │   │   └── graphEngine.js       # Shared: layout, export SVG/PNG, import
│   │   └── styles/
│   │       └── App.css              # Dark theme, responsive, print styles
│   └── public/
│       └── index.html
├── docker-compose.yml          # 3-service stack + 7 scan services (gitleaks, semgrep, trivy, dive) via `scan` profile
├── Makefile                    # make up / down / build / logs — injects git branch+SHA automatically
├── secrets/
│   └── db_pass.txt.example     # Copy to db_pass.txt — set a strong password (gitignored)
├── images/
│   ├── devops-2.svg            # DevOps circular-arrows logo source (inline in header)
│   └── SecAssess_logo.png      # Reference logo asset
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

# 4. Build and start — the Makefile injects the current git branch + SHA automatically
make up

# 5. Open browser
open http://localhost:3000
```

### Makefile targets

| Command | Description |
|---------|-------------|
| `make up` | Build images and start all services (injects current `GIT_BRANCH` + `GIT_SHA`) |
| `make build` | Build images without starting containers |
| `make down` | Stop and remove all containers |
| `make logs` | Follow logs for all services |
| `make scan` | Run all source-level scans: Gitleaks + Semgrep SAST + Trivy FS |
| `make scan-secrets` | Gitleaks — detect secrets in git history |
| `make scan-sast` | Semgrep — SAST static analysis of source code |
| `make scan-vulns` | Trivy fs — CVE + secret + misconfiguration scan of the repo |
| `make scan-images` | Trivy image — CVE scan of built Docker images (run `make build` first) |
| `make scan-dive` | Dive — Docker image layer efficiency analysis (run `make build` first) |

> **Why inject `GIT_BRANCH` and `GIT_SHA`?**
> The UI header displays `v<version> · <branch> · <sha>` (e.g. `v2.1.0 · v21 · 3cc00e3`).
> These are baked into the React bundle at build time — not read at runtime — so the container
> must be rebuilt with `--build` whenever the values should update.
> The version is read automatically from `frontend/package.json`.
> `make up` handles all of this; without it they default to `main` / `dev`.

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
| Excel | Server-side | Multi-sheet workbook (one sheet per tab + All_Diagrams); each workflow row has its diagram image embedded inline, rounded corners, correct aspect ratio |
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

## 🛡️ Security Scanning (Local)

All scanners run as Docker Compose services under the `scan` profile — no local tool installation needed.

```bash
# Run all source-level scans in one command
make scan

# Individual scans
make scan-secrets   # Gitleaks   — secrets in git history
make scan-sast      # Semgrep    — SAST (backend + frontend source)
make scan-vulns     # Trivy fs   — CVEs, secrets, misconfigs in repo files

# Image scans (build images first with: make build)
make scan-images    # Trivy image — CVE scan of secassess-api + secassess-app
make scan-dive      # Dive        — layer efficiency analysis of both images
```

### Scanner details

| Scanner | Tool | What it checks |
|---------|------|----------------|
| **Secret scan** | [Gitleaks](https://github.com/gitleaks/gitleaks) | Hardcoded secrets, API keys, tokens in git history |
| **SAST** | [Semgrep](https://semgrep.dev) | Code vulnerabilities, injection flaws, insecure patterns |
| **Filesystem vulns** | [Trivy fs](https://aquasecurity.github.io/trivy) | CVEs in dependencies, secrets in files, IaC misconfigurations |
| **Image CVEs** | [Trivy image](https://aquasecurity.github.io/trivy) | OS + library CVEs in built Docker images |
| **Image layers** | [Dive](https://github.com/wagoodman/dive) | Layer efficiency, wasted space, image optimization |

> **Docker socket note:** `scan-images` and `scan-dive` require access to `/var/run/docker.sock` (standard on Linux/macOS and Docker Desktop on Windows).

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

- **v23** — Local security scanning: Gitleaks, Semgrep SAST, Trivy (fs + image), Dive — all as Docker Compose `scan` profile services; `make scan` / `scan-secrets` / `scan-sast` / `scan-vulns` / `scan-images` / `scan-dive` Makefile targets
- **v22** — DevOps circular-arrows logo (devops-2.svg inline, 8-stage multi-color: violet→indigo→lavender→sky-blue→cyan→mint→green→teal), logo scaled to 104×55 px, Dashboard auto-refresh after Truncate DB, logo proportions and spacing fix
- **v21** — Promotion Workflows tab (8 templates, 10 node types), Excel inline diagram images per workflow row (rounded corners, correct aspect ratio), All_Diagrams sheet includes all 5 diagram sections, Makefile (`make up/down/build/logs`), always-mounted diagram tabs for reliable image capture, DevOps infinity logo, transparent header, branch+SHA in version line, ZIP includes PDF+XLSX+images/
- **v15** — Versioning tab, server-side PDF/SQL/XML/ZIP exports, GitHub Actions CI/CD, SBOM, SemVer, enhanced Excel export, input validation, secrets management
- **v14** — Deployment Strategies (18 templates), hybrid cloud CI/CD, truncate, export section selection
- **v13** — CI/CD expansion (11 templates), Git Flow (6 templates), Artifact Registry, shared graph engine
- **v2** — Full-stack: PostgreSQL, Docker, 126 controls, Gantt, CI/CD diagrams, pricing, import/export

## 📄 License

MIT
