# KIT.md — VIPER trên provider khác Claude Code

Sinh bởi viper-kit — đừng sửa tay. Nguồn sự thật vẫn là `CLAUDE.md` + `.claude/` (Claude Code dùng y như cũ).
Sửa agent/skill/command ở `.claude/` hoặc luật ở `CLAUDE.md` → chạy lại `npx viper-kit init <provider>` để sinh lại.

## OpenAI Codex (≥ 0.169)

**Trust (bắt buộc, một lần mỗi máy):** Codex bỏ qua toàn bộ `.codex/` (config, hook, rules, agent, skill) của dự án chưa trust,
và bỏ qua **im lặng** hook chưa được duyệt (C-codex-002) — tức là chạy mà không có luật cứng nào.
1. Mở `viper-kit codex` (hoặc `scripts/kit/bin/viper-codex`, hoặc `codex` ở gốc dự án) → chấp nhận trust thư mục.
2. Codex hỏi "Hooks need review" → chọn Review hoặc Trust all (hoặc gõ `/hooks`, phím `t`) — 3 hook VIPER (PreToolUse, SessionStart:compact, Stop; C-codex-011). Mỗi lần kit sinh lại `.codex/hooks.json` phải duyệt lại.
3. Kiểm: sau một lệnh shell bất kỳ, `.viper/kit/hook-heartbeat/codex.json` phải có và `last` mới.

`codex exec` (không tương tác): trust dự án bằng `codex exec --trust …` một lần (Codex ghi vào `~/.codex/config.toml`;
từ 0.169 `-c projects.<path>.trust_level` không còn đủ — C-codex-006); hook chưa duyệt thì bị bỏ qua — kit không tự bật `--dangerously-bypass-hook-trust`.

Lệnh VIPER là skill: gõ `/viper-validate` hoặc `$viper-validate` (chỉ gọi tường minh — `agents/openai.yaml`).
Subagent: `.codex/agents/viper-*.toml`; yêu cầu model spawn agent theo tên (vd "spawn viper-reviewer").

| Luật / cơ chế VIPER | Trên Codex |
|---|---|
| #2 cấm hỏi sau pha V (`guard_ask`) | **thấp hơn** — Codex hỏi bằng cách kết thúc lượt bằng câu hỏi; hook `Stop` đoán câu hỏi (dòng cuối kết thúc bằng `?`) rồi ép chạy tiếp một lần (đã đo — C-codex-009); câu hỏi không kết thúc bằng `?` thì lọt. `request_user_input` (Plan mode) bị chặn như `AskUserQuestion` (C-codex-012) |
| chặn deploy khi nợ tương thích ngược (`guard_bc`) | ngang (lệnh shell nguyên văn — C-codex-004) |
| prototype lắp từ token (`guard_ds`) | ngang với `apply_patch` (đã đo chặn — C-codex-007, C-codex-010). Kit tự áp patch theo cách của Codex (đối chứng với applier thật của Codex trong test) để soi nội dung sau ghi; áp không được trên file guard_ds soi → chặn, ghi lại cả file. Ghi qua shell (`cat > f`, `sed -i`) lọt — như Bash trên Claude |
| nhồi luật sau compact | **thấp hơn** — `AGENTS.md` Codex tự chèn lại sau compact (đọc mã — C-codex-027); trạng thái pha (STATE) chỉ bơm lại qua `SessionStart:compact` ở **đầu lượt kế tiếp** (đo với `/compact` — C-codex-013). Tự compact giữa lượt chưa đo: phần còn lại của lượt đó có thể chạy thiếu STATE |
| `reanchor.py --audit` | không có |
| giới hạn tool của agent (reviewer chỉ đọc, khe không ghi file) | **thấp hơn** — Codex không có whitelist; `guard_agent` chặn theo `agent_type` — payload subagent có `agent_type` (đã đo — C-codex-008), đã đo chặn với role thử (S26); role VIPER thường tự từ chối trước khi hook phải chặn. Agent không có trong `.viper-kit/agent-policy.json` (vd `default`) không bị giới hạn |
| khe dogfood một trình duyệt | **thấp hơn** — mọi agent thấy cả `pw-slot-1..3` (file agent không mang MCP riêng); `guard_agent` chặn khe gọi server của khe khác (MCP khe chưa đo) |
| permission deny/ask | deny: ngang (`forbidden` — C-codex-005, hook `guard_policy`). ask (`git push`, `make deploy`, deploy CLI…): **chặt hơn** — chưa kiểm được Codex có tự hỏi Authority (S28) nên hook **luôn chặn** và model phải báo lệnh để Authority tự chạy |
| deny đọc `.env`, `~/.ssh` | **không có** — Codex đọc file qua shell; giống lỗ `cat .env` trên Claude |

**Lưu ý:** sandbox `workspace-write` + mạng bật (Playwright/npm cần); `.git/` chỉ đọc trong sandbox theo docs Codex nên `git commit` cần duyệt (chưa đo — S28; ở `codex exec` không có ai duyệt). Ở `codex exec` gọi tool MCP bị từ chối (C-codex-015).
Hook chạy `python3`; thiếu Python thì Codex cho qua (fail-open) — heartbeat là cách duy nhất biết hook có chạy.

## Antigravity CLI (agy ≥ 1.5.5)

**Mở phiên:** `viper-kit agy` từ bất kỳ thư mục nào trong dự án (cần lệnh `viper-kit` trên PATH), hoặc `scripts/kit/bin/viper-agy`; không gõ `agy` trần — launcher nạp `.agents/viper-settings.json`
(chế độ accept-edits + danh sách cấm). Lệnh `/viper-*` dùng như trên Claude Code.

| Luật / cơ chế VIPER | Trên agy |
|---|---|
| #2 cấm hỏi sau pha V (`guard_ask`) | ngang — hook chặn `ask_question` |
| chặn deploy khi nợ tương thích ngược (`guard_bc`) | ngang |
| prototype lắp từ token (`guard_ds`) | ngang |
| nhồi luật sau compact | **gần ngang** — luật tĩnh ở `AGENTS.md` đọc lại mỗi lượt; trạng thái pha bơm lại khi phát hiện compact qua transcript (gián tiếp; tự compact chưa đo) |
| `reanchor.py --audit` | không có |
| khe dogfood một trình duyệt | **gần ngang** — mỗi khe chỉ thấy server `pw-slot-k` của mình; agy tự thêm vài tool hệ thống (không có tool ghi file) |
| permission deny/ask | ngang khi chạy qua launcher; `git push`/`make deploy` hỏi qua `force_ask` (đo ở agy 1.5.5, chế độ `-p`; TUI chưa đo) |

**Lưu ý:**
- `.agents/viper-settings.json` **thay** permissions agy của bạn trong phiên chạy qua launcher.
- Hook lỗi (thiếu `python3`) thì agy **chặn mọi tool** — cài Python ≥3.9.
- Hook global của bạn (`~/.gemini/config/hooks.json`) vẫn chạy cùng; kit không đụng tới.
- Chế độ tương tác (TUI) và Antigravity 2.0/IDE chưa được kit đo.
