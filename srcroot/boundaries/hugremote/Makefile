# Target hugremote — root Makefile của repo gọi xuống đây (make -C srcroot/boundaries/hugremote …)
SHELL := /bin/bash
ENV_FILE ?= ../../../deployment/local/.env
LOAD_ENV = set -a; [ -f $(ENV_FILE) ] && . $(ENV_FILE); set +a;

.PHONY: install dev check test migrate build doctor

install:
	pnpm install --frozen-lockfile

dev: install
	$(LOAD_ENV) pnpm dev

check:
	pnpm install --frozen-lockfile
	pnpm --filter @app/shared build
	pnpm --filter @app/api build
	pnpm --filter @app/api lint
	pnpm --filter @app/web build

test:
	pnpm --filter @app/shared build
	pnpm --filter @app/api test

migrate:
	pnpm --filter @app/shared build
	pnpm --filter @app/api build
	$(LOAD_ENV) pnpm --filter @app/api migrate

build: check

doctor:
	@$(LOAD_ENV) node bin/hugremote.cjs doctor
