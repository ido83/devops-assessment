# 🛡️ SecAssess — DevOps & DevSecOps Assessment Generator

A React application for generating comprehensive DevOps and DevSecOps security assessment documents. Containerized with Docker Compose and built with security best practices.

## Features

- **8 Assessment Categories** covering CI/CD, Container Security, Kubernetes, IaC, Observability, IAM, Compliance, and Supply Chain Security
- **70+ Security Controls** mapped to DevOps and DevSecOps practices
- **Severity-weighted scoring** (Critical, High, Medium, Low)
- **5 Assessment Templates**: Full, DevSecOps Focus, DevOps Maturity, Critical Controls, Supply Chain
- **Multi-format export**: HTML Report, Markdown, JSON
- **Dark elegant UI** with responsive design

## Quick Start

### Docker Compose (Recommended)

```bash
docker compose up --build -d
```

Open [http://localhost:3000](http://localhost:3000)

### Local Development

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Container Security Features

The Docker setup follows security best practices:

- **Multi-stage build** — minimal production image using nginx:alpine
- **Non-root execution** — runs as unprivileged `appuser`
- **Read-only filesystem** — `read_only: true` with explicit tmpfs mounts
- **Dropped capabilities** — `cap_drop: ALL` with only `NET_BIND_SERVICE`
- **No privilege escalation** — `no-new-privileges:true`
- **Resource limits** — CPU and memory constraints defined
- **Security headers** — CSP, X-Frame-Options, X-Content-Type-Options, etc.
- **Health checks** — container-level health monitoring
- **Log rotation** — prevents unbounded log growth

## Project Structure

```
├── docker-compose.yml      # Container orchestration
├── Dockerfile              # Multi-stage build
├── nginx.conf              # Production server with security headers
├── package.json
├── public/
│   └── index.html
└── src/
    ├── App.js              # Main application with step navigation
    ├── index.js
    ├── components/
    │   ├── ConfigStep.js   # Assessment configuration
    │   ├── AssessmentStep.js # Checklist evaluation
    │   └── ReviewStep.js   # Summary, breakdown, and export
    ├── data/
    │   └── assessmentData.js # Categories, controls, templates
    └── styles/
        └── App.css         # Dark elegant theme
```

## Export Formats

| Format   | Use Case                                  |
|----------|-------------------------------------------|
| HTML     | Styled report for printing or sharing     |
| Markdown | Documentation, wikis, Git repositories    |
| JSON     | Automation, CI/CD integration, dashboards |

## License

MIT
