# Claude realtime streaming
- [x] AC1: Actual VSCode package version/hash and streaming call path documented.
- [x] AC2: CLI partial events produce text/thinking before assistant snapshot; tests fail on old parser and pass on fix.
- [x] AC3: Final snapshots do not duplicate deltas; tools, multi-turn message blocks, cancellation and snapshot-only CLI remain supported by regression tests.
- [x] AC4: Isolated UI shows incremental text while isGenerating true, report final matches once, reload persists final.
- [ ] AC5: Real installed CLI invocation confirms partial event contract; full UI/Git regression/typecheck/build pass and deployed smoke verified.
