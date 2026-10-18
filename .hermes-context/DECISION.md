# DECISIONS — refactor-nodejs-fullstack-structure

<!-- Append-only. Number decisions sequentially: D1, D2, D3... -->

## D1 — 2026-10-18 — Refactor HugRemote to Monorepo Architecture
- Type: pattern
- Decision: Migrate HugRemote directory layout from `client/` and `server/` to `apps/web/`, `apps/api/`, and `packages/shared/` orchestrated via `pnpm-workspace.yaml`.
- Reason: Strict alignment with `nodejs-fullstack-structure` and `nodejs-backend-structure` standard, enabling shared types/validation schemas and clear domain layering.
- Alternatives considered: Keep flat client/server directories; rejected because cross-package sharing was unstandardized and backend was monolithic.
- Impact: Clean boundaries, universal contracts in `packages/shared`, improved modularity.
