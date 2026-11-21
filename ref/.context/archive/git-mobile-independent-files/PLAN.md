---
feature: git-mobile-independent-files
description: Implement approved Git mobile/tablet prototype in app, decouple bottom Files tab from selected Project, preserve current directory per server across tabs/projects/reload.
status: in-progress
created: 2026-11-05
---
# Git mobile flow and independent Files tab

## Scope
- Production GitView responsive navigation <=860px; desktop layout preserved.
- Bottom Files and editor operations use server workspace scope regardless of project; current directory persisted per server.
- Server API explicit fsScope=server option for all Files operations; existing project-scoped clients unchanged.

## Acceptance Criteria
- [x] AC1: At 390px and 820px Git opens list, repo click opens detail with back; file rows have status, stage labels and +/- counts, file click opens diff. Desktop keeps old layout — verified via `node scripts/test_ui_git_mobile_list_details.mjs` (4 PASS) and live browser at `http://127.0.0.1:8099/remote/` (390px, 820px, 1280px).
- [x] AC2: Files root is server workspace regardless of active project, navigation preserves current directory on project switch/tab switch/page reload and returns to per-server saved directory on server switch — verified via `node scripts/test_file_tab_server_scope.mjs` (8 PASS) and live browser at `http://127.0.0.1:8099/remote/`.
- [x] AC3: Files read/write/create/rename/delete/upload/download and Open as Project follow server workspace scope, while other API callers remain project scoped — verified via `npx tsx scripts/test_fs_server_scope.ts` (PASS, including symlink/sibling containment) and live HTTP `/api/fs?serverId=server-local&fsScope=server`.
- [x] AC4: Build/typecheck, focused tests and full UI regression pass; deployed app renders real Files and Git navigation, 390px viewport no document overflow — verified via `npm run build`, `npm run test:ui`, `npx tsx scripts/test_ssh_config_include.ts`, rollout to `~/.local/share/hugremote/current` (`1.6.6-c4345acc216e`), and live browser check (`noOverflow: true`).

## Tasks
- [x] T1: Git UI implementation and test.
- [x] T2: Server-scoped API and test.
- [x] T3: File store + app bootstrap and tests.
- [x] T4: Full regression, deploy, real browser verification, Git merge/push.

## Notes
- Existing uncommitted prototype Git work is on feat/prototype-compact-git-repos and part of approved design.
- Never navigate outside configured server workspace/ALLOWED_ROOT; existing API defaults must remain project-scoped.
