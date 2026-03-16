# SecAssess — convenience targets
# Usage: make up | make down | make logs | make build
#
# GIT_BRANCH and GIT_SHA are baked into the React bundle at build time.
# These targets inject the current values automatically.

GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)
GIT_SHA    := $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)

.PHONY: up down build logs scan scan-secrets scan-sast scan-vulns scan-images scan-dive

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
