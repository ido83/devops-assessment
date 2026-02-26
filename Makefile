# SecAssess — convenience targets
# Usage: make up | make down | make logs | make build
#
# GIT_BRANCH and GIT_SHA are baked into the React bundle at build time.
# These targets inject the current values automatically.

GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)
GIT_SHA    := $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)

.PHONY: up down build logs

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
