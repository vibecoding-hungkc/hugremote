# Technical Decisions: `claude-session-name-and-running-state`

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-11-05 | Pass `--name <session.name>` to `claude` CLI with automatic fallback retry (`omitNameFlag = true`) if older binary rejects `--name`, and persist custom names to `.hugremote-meta.json` + `.jsonl` `custom-title` | Ensures CLI session titles match HugRemote session names across drop menus and Workspace sidebar without breaking older Claude CLI binaries. |
| 2026-11-05 | Display ONLY the spinning indicator (`.dw-claude-running.status-indicator`) on running Claude sessions in Workspace sidebar (no Stop button on Workspace row) | Explicitly requested by user ("chỉ để icon loading thôi bỏ nút dừng đi") for a cleaner Workspace row layout. |
| 2026-11-05 | Scan nested Git repositories up to depth 5 (`0..5`) inside the active project (`GitService.discoverRepos`) and pass validated relative `repoPath` across all `/api/git/*` endpoints | Enables tracking and operating on nested sub-repositories (up to 5 directory levels deep) in both `QuickWorkspacePanel.vue` and `GitView.vue` while preventing path traversal outside `project.rootPath`. |
| 2026-11-05 | Use browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`, `lang = 'vi-VN'`) for the Claude Mic button (`#btn-claude-mic`) with strictly 2 visible states (`recording` and `transcribing`) | Approved by user ("oke dùng cách 1", "không cần hiển thị trạng thái đã điền chỉ cần hiện trạng thái đang thu và đang phân tích thôi") for zero-dependency Vietnamese speech recognition directly in code. |
