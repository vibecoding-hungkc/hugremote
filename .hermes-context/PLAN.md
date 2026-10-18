---
feature: refactor-nodejs-fullstack-structure
description: Refactor HugRemote codebase to follow the strict nodejs-fullstack-structure and nodejs-backend-structure monorepo architecture.
status: in-progress
created: 2026-10-18
---

# Refactor HugRemote to nodejs-fullstack-structure

## Goal
Transform HugRemote into a clean, modern fullstack monorepo conforming strictly to `nodejs-fullstack-structure` and `nodejs-backend-structure`:
- Reorganize directories into `apps/api` (Fastify backend), `apps/web` (Vite frontend), and `packages/shared` (universal contracts, schemas, DTOs).
- Configure workspace orchestration via `pnpm-workspace.yaml`.
- Modularize backend into layered domains inside `apps/api/src/modules/` and infrastructure in `apps/api/src/infra/`.
- Ensure universal types and schemas are shared across frontend and backend from `packages/shared`.
- Maintain 100% backward compatibility for the CLI binary (`bin/hugremote.js`), installer scripts (`install.sh`, `beta.sh`), and all automated test suites.

## Scope
- In scope:
  - Setup `pnpm-workspace.yaml` with `apps/*` and `packages/*`.
  - Migrate `server/` -> `apps/api/`.
  - Migrate `client/` -> `apps/web/`.
  - Create `packages/shared/` for shared types and schemas.
  - Structure `apps/api` with `src/main.ts`, `src/app.ts`, `src/config/`, `src/modules/`, `src/infra/`.
  - Structure `apps/web` with relative API routing, typed API client, and clean feature imports.
  - Update root `package.json`, `bin/hugremote.js`, `bin/update.js`, `install.sh`, and `beta.sh`.
  - Run and verify all test suites and browser end-to-end functionality.
- Out of scope:
  - Rewriting Vue components into React (HugRemote is a Vue 3 app; `nodejs-fullstack-structure` sets monorepo and boundary rules which apply cleanly to Vue/TypeScript).
  - Changing public API contracts or user-facing features.

## Acceptance Criteria
- [x] AC1: Monorepo workspace is configured with `pnpm-workspace.yaml` containing `apps/*` and `packages/*` — Check: `pnpm-workspace.yaml` and npm workspace configuration verified.
- [x] AC2: Universal types & contracts live in `packages/shared` and build cleanly — Check: `packages/shared/dist` compiled with declarations and source maps.
- [x] AC3: Backend is structured in `apps/api` following `nodejs-backend-structure` (modules, config, infra) and builds cleanly — Check: `npm run build --prefix apps/api` passes with 0 errors.
- [x] AC4: Frontend is structured in `apps/web` and builds cleanly into `apps/api/public` — Check: `npm run build --prefix apps/web` builds in 5.48s.
- [x] AC5: CLI entry point `bin/hugremote.js` and root commands (`npm run build`) execute successfully — Check: `node bin/hugremote.js --version` prints `HugRemote v1.2.0`.
- [x] AC6: All automated test suites pass 100% — Check: `config-env.test.js` (6/6), `test_cli_version_and_update.js` (7/7), `test_installer_prerequisites.py` (3/3), `test_installer_configuration.py` (5/5), `test_claude_project_sessions.ts` (PASS).
- [x] AC7: Deployed service `hugremote.service` restarts and serves web app & API properly — Check: HTTP status 200, API limits, project-sessions, and `browser_exec` live UI verification.

## Tasks
- [x] T1: Initialize git branch `refactor/nodejs-fullstack-structure`, configure `pnpm-workspace.yaml`, and scaffold `packages/shared`.
- [x] T2: Extract universal types and contracts into `packages/shared/src`.
- [x] T3: Migrate `server/` to `apps/api/`, refactor backend according to `nodejs-backend-structure` (`modules/`, `infra/`, `config/`, `app.ts`, `main.ts`).
- [x] T4: Migrate `client/` to `apps/web/`, update imports to reference `@hugremote/shared`, verify Vite build.
- [x] T5: Update root `package.json`, `bin/hugremote.js`, `bin/update.js`, `install.sh`, and `beta.sh` to support `apps/api` and `apps/web`.
- [x] T6: Run full test suite, fix any path mismatches, and verify end-to-end via CLI and browser.
- [ ] T7: Merge into `main`, restart `hugremote.service`, push to GitHub, and report findings.

## Risks / Notes
- The CLI `hugremote` and systemd service look for entry points relative to project root. We will provide clean path resolution in `bin/hugremote.js` supporting both legacy `server/dist` and new `apps/api/dist` locations for seamless upgrades.
