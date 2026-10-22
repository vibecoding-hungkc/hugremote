# Claude realtime protocol reference

## Verified artifact
- Official publisher namespace Anthropic, Claude Code VS Code extension 2.1.308 linux-x64.
- URL https://openvsx.eclipsecontent.org/Anthropic/claude-code/linux-x64/2.1.308/Anthropic.claude-code-2.1.308@linux-x64.vsix
- VSIX SHA256 59c875324e0d0cfcc0977896096ad36eb448d002e86bb54494d2a65fabf80df2 matched registry checksum. Separate package signature not verified.
- extension.js SHA256 f0e1eb4ca34b00edcaebba7544d67df31317aefee726698efa24a07083ebec81
- webview/index.js SHA256 c1f17b25dcc10e1d22290f2bbd960d7dd9016907adf50e12db1206a929d61f9c

## Static call flow
Offsets are zero-based UTF8 bytes in original minified bundles.
- extension.js 3438724: includePartialMessages:!D1.env.remoteName. This version enables partial on local VSCode; not universally on remote extension hosts.
- extension.js 2692176: if(y)a.push("--include-partial-messages"). stream-json format alone does not request token-level partial events.
- extension.js 2698532: line reader parses stdout JSON; 3129790 forwards each io_message; 3434314 webview.postMessage sends it to UI.
- webview/index.js 3850421 routes stream_event.event and parent_tool_use_id into assembler.
- webview/index.js 3673433 uses assembler per parent_tool_use_id. 3673842 handles message_start/content_block_start/delta/stop/message_stop; 3676247 appends text/thinking and assembles tool JSON input.
- webview/index.js 3869902 reconciles snapshot rows: UUID first, then partial message ID/block type; replace rather than append the same content twice. Preserves timing/blockIndex. 3799059 retires abandoned streamed attempts.

## Dynamic verification and limits
- Parent reran extracted unmodified assembler/delta implementation with stub UI signal: synthetic root and child stream frames PASS. This is not a VSCode live UI test.
- Installed CLI is 2.1.302, not extension 2.1.308. Live CLI probe returned 96 text deltas 46.860–64.210s before assistant text snapshot at 64.233s; result 64.509s. Thinking deltas also present.
- HugRemote baseline real browser: thinking and text arrived as two complete block snapshots; answer arrived in one update near completion. Existing parser ignored stream_event entirely.
- Preserve existing SSE transport, session persistence, tools, cancellation and snapshot-only fallback. Reconcile each message/block independently; never dedupe against the aggregate conversation text.
- Existing compact task mode hid a working assistant row even after text arrived. Reveal answer text while retaining compact thinking/tool behavior.
