# Target hugremote — root Makefile của repo gọi xuống đây (make -C srcroot/boundaries/hugremote …)
SHELL := /bin/bash
ENV_FILE ?= ../../../deployment/local/.env
LOAD_ENV = set -a; [ -f $(ENV_FILE) ] && . $(ENV_FILE); set +a;

.PHONY: install dev check test migrate build deploy doctor desktop-build

install:
	pnpm install --frozen-lockfile

dev: install
	@../../../deployment/local/setup.sh
	@if docker info >/dev/null 2>&1; then docker compose -f ../../../deployment/local/docker-compose.yml up -d --build; else echo "(Docker chưa chạy — bỏ qua máy SSH thử)"; fi
	$(LOAD_ENV) pnpm dev

check:
	pnpm install --frozen-lockfile
	pnpm --filter @app/shared build
	pnpm --filter @app/api build
	pnpm --filter @app/api lint
	pnpm --filter @app/web build
	pnpm --filter @app/desktop build

desktop-build: check
	pnpm --filter @app/desktop build:dmg

test:
	pnpm --filter @app/shared build
	pnpm --filter @app/api test
	pnpm --filter @app/web test
	pnpm --filter @app/api build
	pnpm --filter @app/api test:security
	pnpm --filter @app/api test:core
	pnpm --filter @app/api test:desktop

migrate:
	pnpm --filter @app/shared build
	pnpm --filter @app/api build
	$(LOAD_ENV) pnpm --filter @app/api migrate

build: check

deploy: check
	$(LOAD_ENV) bash bin/lib/cut-release.sh

doctor:
	@$(LOAD_ENV) node bin/hugremote.cjs doctor
