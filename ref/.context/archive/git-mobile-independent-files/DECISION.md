# Decisions
- 2026-11-05 Use explicit fsScope=server on Files tab operations while retaining project scope as API default for other features; avoids changing existing project-bound callers and prevents active-project fallback.
- 2026-11-05 Persist relative directory per server in localStorage, validate each revisit by querying API; only successful list updates storage; scoped generation guard blocks stale responses after navigation/server switch. Server configured workspace remains root.
- 2026-11-05 Keep desktop Git UI and its original file-row presentation; mobile/tablet flow follows approved prototype breakpoint <=860px.
