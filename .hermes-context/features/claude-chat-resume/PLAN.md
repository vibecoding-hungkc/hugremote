# Claude chat resume
- [x] AC1 Deterministic regression: refresh sessions while stream active must continue updating visible reactive row.
- [x] AC5 Repeated navigation/reload has canonical, stable final history; overlapping stale snapshots must not undo newer history; no duplicate assistant/user rows.
- [x] AC2 Resume after navigation/visibility/stalled stream via bounded recovery, deduped transport and explicit loading; no duplicate prompt.
- [x] AC3 Completion/error/cancel clear Stop; context switches do not leak stream state; tests/build pass.
- [x] AC4 Isolated browser replay background+return shows new text and terminal state; production smoke after review/deploy.
