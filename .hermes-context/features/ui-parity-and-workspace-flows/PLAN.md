# UI parity and workspace flows
User approved fixes to QA-01..QA-09. Scope: existing flows only; no release version bump.

## Acceptance criteria
- [ ] AC1 Terminal create/edit form renders; browser creates test PTY, edits name/CWD, cancellation close preserves session, confirmed close removes backend PTY.
- [ ] AC2 Dirty editor Close prompts Save/Discard/Cancel; Cancel retains buffer, Save persists, Discard drops buffer. Navigation/open/scope changes protected too. Browser isolated fixture.
- [ ] AC3 Claude Add context opens file/folder picker, inserts @path into draft without changing session cwd; /status uses actual server. Browser checks.
- [ ] AC4 Git initial refresh binds upstream, ahead/behind correctly; regression test and browser UI vs API.
- [ ] AC5 Both ServerDrawer and ServerModal use same full scope refresh incl project loading, file reset, terminal/Claude/Git context. Store/component tests and browser two isolated targets.
- [ ] AC6 Editor touch Undo/arrows/expanded snippets work on mobile; browser.
- [ ] AC7 Project rename reachable, validates empty input, persists after reload; isolated browser fixture.
- [ ] AC8 vue-tsc, build, regression tests and existing safe suites pass; new regressions show RED on previous implementation.
- [ ] AC9 Code review/security diff, deployment browser smoke, merge main/push clean. No real data mutations in QA.

## Tasks
1. Parallel disjoint fixes with RED→GREEN tests.
2. Integrate and exercise isolated backend + browser.
3. Review, build, ship and verify live non-mutating smoke.
