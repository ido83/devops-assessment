# SecAssess — convenience targets
# Usage: make up | make down | make logs | make build
#
# GIT_BRANCH and GIT_SHA are baked into the React bundle at build time.
# These targets inject the current values automatically.

GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)
GIT_SHA    := $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)

.PHONY: up down build logs scan scan-secrets scan-sast scan-vulns scan-images scan-dive \
        db-reset-pass db-reset-data db-fresh

## Build and start all services (injects current branch + SHA into the UI header)
up:
	GIT_BRANCH=$(GIT_BRANCH) GIT_SHA=$(GIT_SHA) docker compose up --build -d

## Build images without starting
build:
	GIT_BRANCH=$(GIT_BRANCH) GIT_SHA=$(GIT_SHA) docker compose build

## Stop and remove containers
down:
	docker compose down

## Follow logs for all services
logs:
	docker compose logs -f

## Run all source-level scans: secrets + SAST + filesystem vulns (no Docker socket required)
scan: scan-secrets scan-sast scan-vulns

## Gitleaks — detect secrets committed to git history
scan-secrets:
	docker compose --profile scan run --rm gitleaks

## Semgrep — SAST static analysis of backend + frontend source
scan-sast:
	docker compose --profile scan run --rm semgrep

## Trivy fs — vulnerability, secret, and misconfiguration scan of the repo filesystem
scan-vulns:
	docker compose --profile scan run --rm trivy-fs

## Trivy image — CVE scan of built container images (run 'make build' first)
scan-images:
	docker compose --profile scan run --rm trivy-backend
	docker compose --profile scan run --rm trivy-frontend

## Dive — Docker image layer efficiency analysis (run 'make build' first)
scan-dive:
	docker compose --profile scan run --rm dive-backend
	docker compose --profile scan run --rm dive-frontend

## ── DB maintenance ──────────────────────────────────────────────────────────

## Recreate secrets/db_pass.txt without Windows line endings (prompts for password)
db-reset-pass:
	@read -rp "New DB password: " pass; printf '%s' "$$pass" > secrets/db_pass.txt
	@printf 'secrets/db_pass.txt written (%d bytes, no trailing newline)\n' "$$(wc -c < secrets/db_pass.txt)"

## Wipe the Postgres data volume (data loss!) — forces clean re-init on next 'make up'
db-reset-data:
	docker compose down -v --remove-orphans
	docker volume rm $$(docker volume ls -q | grep secassess) 2>/dev/null || true
	@echo "All secassess volumes removed. Run 'make up' to reinitialise."

## Full fresh setup: wipe volumes + fix password file + bring stack up clean
db-fresh:
	$(MAKE) db-reset-data
	@read -rp "Set DB password (no spaces): " pass; printf '%s' "$$pass" > secrets/db_pass.txt
	@echo "Password written to secrets/db_pass.txt"
	GIT_BRANCH=$(GIT_BRANCH) GIT_SHA=$(GIT_SHA) docker compose up --build -d
	@echo "Waiting 15 s for Postgres to initialise..."
	@sleep 15
	docker compose logs secassess-db | tail -20
	docker compose logs secassess-api | tail -20
