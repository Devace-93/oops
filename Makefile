# oops — developer convenience wrapper around docker compose.
# All compose files live in ./deploy. Local entrypoint: http://localhost:8084
# (8080 belongs to the 3m4 shortener stack, 8081 to exp, 8082 to retro, on the
# same machine).

# --env-file makes the repo-root .env drive build-arg interpolation (VITE_* are
# inlined into the web bundle at build time), not just runtime container env.
COMPOSE      := docker compose --env-file .env -f deploy/docker-compose.yml
COMPOSE_SH   := docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.selfhost.yml
BASE_URL     ?= http://localhost:8084

.PHONY: help up up-selfhost down build rebuild logs ps migrate prune shell-api shell-db clean e2e tracker smoke geoip

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Build + start the full stack (hosted edition)
	$(COMPOSE) up -d --build

up-selfhost: ## Start without billing (BILLING_ENABLED=false)
	$(COMPOSE_SH) up -d --build

down: ## Stop the stack
	$(COMPOSE) down

build: ## Rebuild all images
	$(COMPOSE) build

rebuild: ## Rebuild from scratch (no cache)
	$(COMPOSE) build --no-cache

logs: ## Tail logs from all services
	$(COMPOSE) logs -f --tail=100

ps: ## Show service status
	$(COMPOSE) ps

migrate: ## Run create-all + alembic upgrade
	$(COMPOSE) run --rm migrate python -m dbcore.cli upgrade

prune: ## Delete events older than each plan's retention window
	$(COMPOSE) run --rm migrate python -m dbcore.cli prune-events

shell-api: ## Shell into the api container
	$(COMPOSE) exec api sh

shell-db: ## psql into Postgres
	$(COMPOSE) exec postgres psql -U oops -d oops

clean: ## Stop and remove volumes (DESTRUCTIVE: wipes the database)
	$(COMPOSE) down -v

tracker: ## Build the tracker script into apps/web/public (m.js + m/v1.js)
	cd packages/tracker && bun install && bun run build

geoip: ## Fetch the shortener's GeoLite2 database from the server into deploy/geoip (dev only; ~50 MB)
	mkdir -p deploy/geoip && scp root@46.225.62.18:/opt/3m4/deploy/geoip/GeoLite2-City.mmdb deploy/geoip/ && ls -la deploy/geoip

smoke: ## Curl the running stack: health, tracker headers, collect round-trip (BASE_URL)
	BASE_URL=$(BASE_URL) sh deploy/smoke.sh

e2e: ## Run the Playwright end-to-end suite against the running stack (E2E_BASE_URL)
	cd e2e && bun install && bunx playwright install chromium && bun run test
