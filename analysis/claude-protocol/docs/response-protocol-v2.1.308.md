# Claude Code Response Protocol and HugRemote Parity — v2.1.308

## Purpose

Tài liệu này khóa baseline kỹ thuật cho việc mở rộng Claude UI của HugRemote từ root-chat pipeline sang semantic parity với Claude Code Extension. Mọi kết luận được giới hạn ở Claude Code CLI và Extension `2.1.308` trên `linux-x64`.

Semantic parity nghĩa là giữ đúng nội dung, identity, lifecycle, hierarchy và reconnect behavior. Nó không yêu cầu sao chép pixel/CSS của Extension.

Machine-readable companion: [`response-parity-matrix.json`](./response-parity-matrix.json).

## Evidence boundary

Ba nguồn được đối chiếu độc lập:

1. Official `Anthropic.claude-code` VSIX `2.1.308` cho `linux-x64`.
2. Claude Code CLI `2.1.308`, gồm static binary inspection và bounded no-user control probes.
3. HugRemote `v1.5.3` tại commit `d4c50e7`.

Các mức chắc chắn:

- **Verified artifact:** schema/control-flow branch tồn tại ở byte offset cụ thể trong artifact đã hash.
- **Verified runtime:** bounded probe hoặc hash/byte comparison đã được thực thi và quan sát.
- **Inferred:** thiết kế hợp lý suy ra từ nhiều evidence nhưng chưa có live interaction.
- **Unverified:** chưa được phép dùng làm release claim.

String presence đơn lẻ không được coi là control-flow proof. Static reducer branch không được mô tả thành live emission. Không có authenticated model prompt hay production conversation nào được dùng trong M0.

## Artifact identity

### Claude Code CLI

- Version: `2.1.308`
- Platform: `linux-x64`, ELF x86-64
- SHA-256: `356733f185fa988e6bf3aa9a555269fdd167982a2e2a80d3c8a78037bb92ad58`
- Build ID: `3ee8953d658715ba044a4619218835379e5136a4`

### Claude Code VSIX

- Extension: `Anthropic.claude-code`
- Version: `2.1.308`
- Platform: `linux-x64`
- SHA-256: `59c875324e0d0cfcc0977896096ad36eb448d002e86bb54494d2a65fabf80df2`
- Open VSX metadata: https://open-vsx.org/api/Anthropic/claude-code/linux-x64/2.1.308
- Microsoft Marketplace listing: https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code

Open VSX và Marketplace package downloads được kiểm tra byte-identical. Registry-published digests trùng computed digest. VSIX chứa native Claude binary có version, SHA-256, Build ID và toàn bộ bytes trùng CLI đang cài.

Registry `verified` flags và digest consistency đã được xác minh. Independent cryptographic verification của signature bundle chưa hoàn tất và không được claim.

## Verified

### Official execution path

Official Extension có execution path tĩnh được trace xuyên suốt:

```text
Extension option binding
→ SDK ProcessTransport options
→ native child argv/spawn
→ newline-delimited JSON + control transport
→ extension host io_message
→ webview channel
→ reducer
→ parent-scoped stream assembler
→ final assistant reconciliation
→ content renderer
```

Các anchor chính, là zero-based byte offsets trong artifact gốc:

- Extension binds `includePartialMessages` theo `!vscode.env.remoteName`: `extension.js` byte `3438724`.
- SDK tạo `stream-json` input/output argv: `extension.js` byte `2690041`.
- Conditional `--include-partial-messages`: `extension.js` byte `2692176`.
- NDJSON line parse: `extension.js` byte `2698729`.
- Control dispatch: `extension.js` byte `2707941`.
- Host `io_message` forwarding: `extension.js` byte `3129833`.
- Webview reducer ingress: `webview/index.js` byte `3843092`.
- Parent-tool-scoped assembler: `webview/index.js` byte `3850477`.
- Final assistant reconciliation: `webview/index.js` byte `3869902`.
- Conventional content renderer: `webview/index.js` byte `5232030`.

Điểm khác biệt quan trọng: official Extension chỉ bật partial messages khi VS Code host không phải remote host. HugRemote hiện yêu cầu partial messages cho cả local và SSH; đây là product difference cần test, không phải bằng chứng rằng HugRemote sai.

### Official top-level response surface

Official webview recognized table gồm:

- `assistant`
- `auth_status`
- `command_lifecycle`
- `conversation_reset`
- `prompt_suggestion`
- `rate_limit_event`
- `result`
- `stream_event`
- `system`
- `tool_progress`
- `tool_use_summary`
- `user`

SDK transport còn xử lý `control_response`, `control_request`, `control_cancel_request`, `keep_alive`, `transcript_mirror`, `active_goal` và `autocompact_state`.

HugRemote `v1.5.3` primary parser chỉ có semantic branches cho một subset hẹp: `system/init`, `system/thinking_tokens`, `stream_event`, `assistant`, `user/tool_result`, và `result` tại `apps/api/src/services/claudeService.ts:2331-2534`.

### Stream event lifecycle

Official assembler xử lý:

- `message_start` — byte `3674438`
- `message_delta` — byte `3674622`
- `content_block_start` — byte `3674706`
- `content_block_delta` — byte `3674903`
- `content_block_stop` — byte `3675270`
- `message_stop` — byte `3675486`

HugRemote xử lý tất cả ngoại trừ `message_delta` tại `apps/api/src/services/claudeService.ts:2354-2381`. Existing text/thinking reconciliation đã được test cho equal, shorter, non-prefix, split snapshots và replacement attempts.

### Delta surface

Official reducer có branches cho:

- `text_delta`
- `citations_delta`
- `input_json_delta`
- `thinking_delta`
- `signature_delta`
- `compaction_delta`

HugRemote chỉ mutate `text_delta` và `thinking_delta` tại `apps/api/src/services/claudeService.ts:2369-2375`. `input_json_delta` bị giữ kín có chủ đích cho tới final assistant snapshot. Citations, signatures và compaction delta chưa có normalized representation.

### Content blocks

Official artifact có concrete paths cho:

- `text`
- `thinking`
- `tool_use`
- `server_tool_use`
- `tool_reference`
- `image`
- `document`
- `tool_result`
- `redacted_thinking`
- `fallback`

Ngoài ra có specialized nested results như web search/fetch, code execution, tool search và container upload. Unknown content có fallback UI thay vì silent drop.

HugRemote shared message/tool model tại `packages/shared/src/types/claude.ts:1-22` chỉ giữ text, thinking và flattened `read | edit | bash` tools. Image, document, citation, redacted thinking, server tool và unknown block không round-trip được.

### Tools

Official stream assembler tích lũy `input_json_delta` cho `tool_use`/`server_tool_use`, parse canonical JSON tại block stop và gắn `tool_result` bằng `tool_use_id`.

HugRemote chỉ tạo tool card từ complete assistant snapshot tại `apps/api/src/services/claudeService.ts:2420-2467`. Tool lifecycle hiện là `running | done | error`; structured result bị stringify, unknown tools bị presentation-map về nhóm bash. Đây là partial support, không phải protocol parity.

### Agents

Official assembler tách stream bằng `parent_tool_use_id ?? "root"`; reducer còn xử lý:

- `task_started`
- `task_progress`
- `task_updated`
- `task_notification`
- `background_tasks_changed`

HugRemote chủ động bỏ mọi frame có `parent_tool_use_id` tại `apps/api/src/services/claudeService.ts:2351-2353`. Điều này bảo vệ root response khỏi contamination nhưng mất child-agent output, tools, progress và history.

### Interaction boundary

Official static path chứng minh duplex ownership model:

- SDK `can_use_tool` dispatch: `extension.js` byte `2712752`.
- SDK `request_user_dialog` dispatch: `extension.js` byte `2715476`.
- Tool permission UI lifecycle: `webview/index.js` byte `3477305`.
- User dialog UI lifecycle: `webview/index.js` byte `3478369`.
- Cancellation đi qua `control_cancel_request`.

No-user CLI `initialize` runtime fixture `CLI-CTRL-INIT-001` trả về empty `pending_permission_requests` và `pending_user_dialog_requests`, xác nhận reconnect payload fields trong fresh process. Nó không chứng minh live answer/timeout/replay semantics.

HugRemote hiện chỉ cấu hình `--permission-mode` và optional bypass ở `apps/api/src/services/claudeService.ts:2202-2228`. Không có pending interaction type, UI, API response route hoặc writable live stdin channel. Vì vậy permission mode configuration là khác với interactive permission parity.

### Safe runtime controls

Bounded, isolated, no-user probes đã verify:

- `initialize` — fixture `CLI-CTRL-INIT-001`
- `get_context_usage(detail="summary")` — `CLI-CTRL-CONTEXT-001`
- `get_usage(skip_behaviors=true)` shape — `CLI-CTRL-USAGE-001`
- `list_models` — `CLI-CTRL-MODELS-001`
- `get_session_cost` shape — `CLI-CTRL-COST-001`

Mọi probe dùng isolated home/cwd, không resume, `--no-session-persistence`, deadline 15 giây, output cap 1 MiB và producer-boundary sanitization. Không model prompt nào được gửi.

### HugRemote baseline

Audit `v1.5.3` phân loại 34 current capabilities:

- 11 fully supported
- 12 partial
- 7 unsupported
- 2 intentionally dropped
- 2 unverified

Các phần mạnh nhất hiện nay:

- Root text/thinking streaming.
- Authoritative snapshot correction.
- Tool terminal cleanup.
- Background SSE lifecycle.
- Browser reconnect while API process survives.
- Native model/context controls.
- Final HugRemote session history.
- Shared primary parser cho local và SSH.

Các thiếu hụt cốt lõi:

- Narrow normalized union tại `apps/api/src/services/claudeService.ts:37-45`.
- Child frames deliberately dropped.
- Tool input delta deliberately hidden.
- Không interactive round-trip.
- Không event cursor replay.
- Running task không durable qua API restart.
- Local/SSH imported history bị lossy.

## Inferred

Các thiết kế sau được xem là inferred và phải được chứng minh bằng RED/GREEN tests trước khi thành production claim:

1. Normalized identity phải giữ session/run/message/block/tool/parent-tool/agent scope theo field thực sự có trong từng frame.
2. Child agent cần assembler riêng; flatten vào root sẽ sai semantic, drop hoàn toàn sẽ mất capability.
3. Tool input cần trạng thái `receiving-input`, nhưng partial JSON không được xem là canonical hoặc executable.
4. Permission/dialog cần exact session/run/request ownership, cancellation và reconnect hydration.
5. Reconnect cần monotonic sequence cùng canonical snapshot fallback để tránh duplicate/loss; không được replay POST prompt.
6. Unknown frame/block phải tạo bounded diagnostic thay vì silent drop hoặc raw forwarding.

Các inference này là target cho M1–M6, không phải mô tả feature đã hoàn thành.

## Unverified

Những mục sau cố ý chưa được claim:

- Authenticated live-model emission của toàn bộ frame/event/block/delta.
- Full VS Code end-to-end UI session.
- Live answer, timeout, cancellation và replay semantics của permission/user dialog.
- Runtime compaction, hooks, MCP, rate-limit transitions và prompt suggestions.
- API-process restart recovery cho active native run.
- Independent cryptographic verification của VSIX signature bundle.
- Dedicated visible UI branch cho mọi recognized top-level type.
- SSH live interaction round-trip.

Các mục interaction/runtime chưa verify có `releaseScope=false` trong matrix. Chúng phải qua duplex spike trước khi được đưa vào release claim.

## HugRemote gap

Machine-readable matrix có 50 rows, trong đó 48 rows thuộc initial response-parity scope. Không row scoped nào mang trạng thái `unverified`; thiếu hụt đã chứng minh được ghi `unsupported` hoặc `partially-supported`, còn runtime semantics chưa chứng minh được loại khỏi scope.

Các tranche ưu tiên:

1. Frame classification và unknown diagnostics.
2. Full stream/delta/content normalized model.
3. Tool input/lifecycle và safe generic renderer.
4. Parent-scoped child agents.
5. Duplex interaction spike.
6. Sequenced replay và durable canonical snapshot.
7. System/status channel placement.

## Test and release rules

Mỗi production slice phải tuân thủ:

- Test mới phải RED trên baseline behavior trước implementation.
- Existing streaming/context/model/resume/UI tests phải tiếp tục pass.
- Golden fixtures phải sanitize credentials, real home paths, production session IDs và real prompts.
- Differential tests so semantic state, không so CSS/pixel.
- Unknown event không crash và không silent drop.
- Browser E2E chạy trên isolated sessions; không mutate production conversations.
- Production restart chỉ khi không có Claude generation đang chạy.
- Release notes chỉ claim capability có artifact/runtime evidence và end-to-end proof.

## References

- Official Open VSX metadata: https://open-vsx.org/api/Anthropic/claude-code/linux-x64/2.1.308
- Visual Studio Marketplace: https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code
- Matrix: [`response-parity-matrix.json`](./response-parity-matrix.json)
- HugRemote parser: `apps/api/src/services/claudeService.ts:2274-2534`
- Shared Claude types: `packages/shared/src/types/claude.ts:1-72`
- SSE routes: `apps/api/src/routes/api.ts:601-753`
- Frontend Claude store: `apps/web/src/stores/claudeStore.ts:300-887`
- Existing stream tests: `scripts/test_claude_streaming.ts:53-309`
