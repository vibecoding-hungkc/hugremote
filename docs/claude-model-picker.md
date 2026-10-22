# Claude model picker: nguồn dữ liệu native

## Nguyên nhân

Implementation cũ chạy `claude -p /model`, lấy chuỗi `Usage: ... Available: ...` rồi dựng model rows. Chuỗi đó liệt kê cú pháp alias parser chấp nhận, không phải picker có xét provider, settings, allowlist và entitlement. UI còn có fallback hardcode, khiến lỗi discovery cũng trông như có danh sách model hợp lệ.

## Hai nguồn đối chiếu

- Package Anthropic Claude Code VS Code `2.1.308 linux-x64`, cùng artifact đã ghi trong `claude-realtime-reference.md`.
- CLI thật tại target local: lúc kiểm tra ngày 22/10/2026 đã auto-update từ `2.1.302` lên `2.1.308`. Binary cài đặt khớp SHA-256 binary bundled VSIX: `356733f185fa988e6bf3aa9a555269fdd167982a2e2a80d3c8a78037bb92ad58`.

### Bằng chứng static

Các offset sau là byte UTF-8 zero-based trong artifact 2.1.308, không phải source line:

- `extension.js @2731645`: `supportedModels()` trả `(await this.initialization).models`.
- `extension.js @2729825`: request `control_request` có `request_id` và `request.subtype`.
- `extension.js @3153961`: `spawnConfigProbe()` mở CLI không có channel/user prompt, dùng `CLAUDE_CODE_CONFIG_PROBE=1`, chờ `initializationResult()` rồi đóng query.
- `extension.js @3125805`: cache config nhận `models` và `unavailable_models` từ initialization.
- `webview/index.js @5683427`: picker lấy availableModels và unavailableModels; unavailable không được chọn.
- `webview/index.js @5325778`: hàng có từ alias trong native label/description được xếp sau.
- `resources/native-binary/claude @243625300`: serializer model trả `value`, `resolvedModel`, `displayName`, `description`, capabilities và `disabled`.
- Binary `@276931287`: control response success chứa nested `response.request_id`, `response.response.models`.

Đây là static source trace; không có chạy VS Code editor live. `unavailable_models` bị gate theo entrypoint/provider; HugRemote không giả mạo entrypoint `claude-vscode` để mở gate.

### Bằng chứng CLI tương tác

Mở CLI tại workspace scratch, vào `/model`, không chọn hàng nào và không gửi model prompt. Menu có cùng 5 hàng và mô tả như initialize probe: `default`, `opus`, `fable`, `sonnet`, `haiku`.

Với settings hiện tại, Default/Opus/Sonnet/Haiku resolve cùng custom ID, nhưng native value khác nhau. Không được gộp theo `resolvedModel` hoặc tự loại Fable. Danh sách này là kết quả cấu hình và version hiện tại, không phải shortlist hardcode áp dụng mọi máy.

## Protocol discovery

```text
claude -p --input-format stream-json --output-format stream-json --verbose --no-session-persistence
```

Gửi đúng một control request, không gửi user message, không resume conversation:

```json
{"type":"control_request","request_id":"<unique-id>","request":{"subtype":"initialize"}}
```

Response JSONL có dạng:

```json
{"type":"control_response","response":{"subtype":"success","request_id":"<unique-id>","response":{"models":[{"value":"default","displayName":"<native-label>","description":"<native-description>","resolvedModel":"<native-id>"}]}}}
```

Ví dụ trên chỉ mô tả schema, không phải output tài khoản. Giữ stdin mở đến khi nhận đúng response. stdout có thể chứa hook/system event khác; không parse nguyên stdout thành một JSON object và không chờ sai field top-level `response_id`.

`CLAUDE_CODE_CONFIG_PROBE=1` có precedent từ extension nhưng là internal option, không bảo đảm mọi hook/plugin đều không có side effect. Không log raw control response vì có account metadata ngoài model list.

## Nguyên tắc thực thi

- Model discovery chạy đúng target và cwd; remote không được lấy settings hoặc list local.
- Chỉ map native fields sang schema giao diện: `value` → `id/prefix`, `displayName` → `title`, `description` → `desc`.
- Giữ `[1m]`, casing và custom identifier; không suy model từ substring `opus` hoặc `sonnet` trong ID tùy biến.
- `default` tương ứng bỏ `--model` khi gửi prompt; không thay bằng tên model resolved tại thời điểm cũ.
- Không suy luận model là có thể inference thành công chỉ vì xuất hiện trong picker; upstream/proxy vẫn có thể từ chối request.
- Discovery lỗi thì hiển thị lỗi/retry, không dựng danh sách fallback giả.
- Capability metadata được giữ nhưng effort control hiện vẫn là bốn mức Low/Medium/High/Max của HugRemote; chưa cam kết parity toàn bộ effort UI native, ví dụ xhigh.
- Discovery không thay thế registry slash command. `/clear`, `/compact`, permissions và command execution parity là scope riêng.

## Kiểm thử

```bash
npm run test:claude-models
npm run test:claude-stream
npm run test:ui
npm run test:git
npm run build
```

Suite model kiểm tra JSONL framing/correlation, local/SSH transport, target/context isolation, error không fallback và UI selection. Streaming suite kiểm tra `--model` giữ exact custom ID/suffix và Default omit flag. Các transport fixture có output tổng hợp chỉ dùng kiểm thử, không trình bày như dữ liệu live.

Bằng chứng nghiệm thu triển khai và browser được ghi append-only tại `.hermes-context/features/native-model-picker/STATE.md`.
