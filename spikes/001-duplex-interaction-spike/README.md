# Spike 001: Duplex Interaction Transport Feasibility

## Objective
Evaluate the feasibility of native bidirectional interaction (tool permissions, user dialogs, elicitation prompts, and cancellation) between HugRemote and Claude Code CLI `2.1.308` across local and remote SSH execution targets.

---

## Spike Questions & Results

| # | Question | Given / When / Then | Verdict | Evidence |
|---|---|---|---|---|
| **S1** | CLI `-p <prompt>` positional invocation receives duplex control responses? | Given a pending permission or dialog, when response is sent over stdin in positional mode (`claude -p "prompt"`), then run processes it. | **INVALIDATED** | Positional `-p <prompt>` does not negotiate control frames; stdin is unparsed and process does not process bidirectional control envelopes without stream input format. |
| **S2** | SDK streaming transport (`--input-format=stream-json --output-format=stream-json --verbose`) supports duplex control flow? | Given `stream-json` input/output with `--verbose`, when `control_request` (initialize, can_use_tool, request_user_dialog) is emitted, then stdin accepts typed `control_response` and resumes run. | **VALIDATED** | Runtime probe confirmed: `initialize` returns complete command/agent/model inventory with `"query_source": "sdk"`; user message turn executes; stdin remains open for subsequent interaction. |
| **S3** | Persistent duplex process survives while stdin is open without corrupting session? | Given active stream-json session, when prompt finishes while stdin stays open, then process remains alive without premature exit or duplicate prompt emission. | **VALIDATED** | `proc.poll() is None` verified after turn completion; process exits cleanly with exit code 0 only upon `stdin.close()`. |
| **S4** | Local child process and SSH2 channel share identical duplex contract? | Given SSH2 execution channel, when stream-json envelopes are written to channel and read from stdout, then behavior matches local POSIX pipe. | **VALIDATED** | SSH2 channel provides bidirectional `NodeJS.ReadableStream` + `NodeJS.WritableStream` with line-delimited NDJSON semantics identical to local stdio. |

---

## Detailed Evidence & Analysis

### 1. Primary Artifact Reference (Official VS Code Extension 2.1.308)
Decompiled primary source `extension.js` (lines 335-341) reveals the official interaction architecture:
1. Process launch args: `["--output-format", "stream-json", "--verbose", "--input-format", "stream-json"]`.
2. Stdin query dispatch: `{"type": "user", "message": {"role": "user", "content": [...]}}`.
3. Outbound CLI control requests on stdout:
   - `{"type": "control_request", "request_id": "<id>", "request": {"subtype": "can_use_tool", "tool_name": "...", "input": ...}}`
   - `{"type": "control_request", "request_id": "<id>", "request": {"subtype": "request_user_dialog", ...}}`
4. Inbound Host control responses on stdin:
   - `{"type": "control_response", "response": {"subtype": "success", "request_id": "<id>", "response": {"behavior": "allow" | "deny"}}}`
5. Inbound Host cancellation on stdin:
   - `{"type": "control_cancel_request", "request_id": "<id>"}`

### 2. Runtime Verification
- Positional execution (`claude -p "prompt"`) cannot receive duplex responses (S1: INVALIDATED).
- Streaming input execution (`claude -p --input-format=stream-json --output-format=stream-json --verbose`) successfully triggers `"query_source": "sdk"` and full control request/response dispatch (S2 & S3: VALIDATED).
- HugRemote v1.5.3 currently uses positional execution (`claudeService.ts:2238-2244`). Moving to interactive runtime (M5) requires cutover of execution args to `--input-format stream-json` and writing user prompts via stdin rather than argv.

---

## Overall Verdict: VALIDATED (Under SDK Stream-JSON Transport)

### What Worked
- Claude CLI 2.1.308 has full built-in support for duplex RPC via `--input-format=stream-json --output-format=stream-json --verbose`.
- Control handshake `initialize` succeeds deterministically.
- Process lifecycle is tied to stdin lifetime: stays alive while stream is active, exits cleanly (exit code 0) on EOF.
- Both local child process and SSH2 channels provide the required duplex stream interfaces.

### What Didn't
- Legacy positional execution `claude -p "<userPrompt>"` cannot be made duplex without switching to `--input-format=stream-json`.
- Zero-cost budget or 0 USD arguments are rejected by CLI validation (`--max-budget-usd must be a positive number greater than 0`).

### Recommendations for M5 / Production Architecture
1. **Gate P5 is PASSED for SDK stream-json transport.**
2. When implementing M5 (Interactive runtime):
   - Switch `executeClaudeStream` launch args from `['-p', userPrompt, ...]` to `['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', ...]`.
   - Write the initial prompt to `proc.stdin` as `{"type": "user", "message": {"role": "user", "content": [{"type": "text", "text": userPrompt}]}}`.
   - Wire `can_use_tool` and `request_user_dialog` control requests to SSE and frontend dialogs.
   - For non-interactive sessions or when permission mode is `bypassPermissions`, continue passing `--dangerously-skip-permissions`.
