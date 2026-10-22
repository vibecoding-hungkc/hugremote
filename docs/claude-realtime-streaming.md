# Thiết kế kỹ thuật: Claude Chat Realtime Streaming

**Dự án:** HugRemote  
**Mốc source:** `6ca0bdf` — `fix(claude): stream partial responses and reconcile snapshots in realtime`  
**Ngày xác minh:** 22/10/2026  
**Phạm vi:** Luồng phản hồi Claude CLI → parser backend → background task → SSE → Pinia/Vue UI.  
**Đối tượng:** Backend/frontend engineer, QA và người vận hành.

> Đây là tài liệu mô tả implementation hiện tại, không phải đề xuất thay thế kiến trúc. Các tham chiếu source gắn với commit cố định; line number có thể thay đổi ở commit mới. Số đo live là kết quả một lượt kiểm thử, không phải SLA.

## 1. Mục tiêu và phạm vi

Claude Chat phải hiển thị nội dung trong khi model vẫn đang sinh phản hồi, thay vì chờ một content block hoặc toàn bộ câu trả lời hoàn tất. Yêu cầu này áp dụng cho text và thinking mà CLI thực sự phát ra. Delta không nhất thiết tương ứng một token, một từ hay một ký tự.[1]

Bản sửa giữ nguyên kiến trúc gọi Claude Code CLI, session hiện có và HTTP SSE. Không chuyển sang Anthropic API trực tiếp, không thêm SDK mới, không dùng polling để tạo hiệu ứng gõ chữ.[1][2]

Các yêu cầu chính:

- Hiển thị text/thinking ngay khi nhận delta hợp lệ.
- Không nhân đôi nội dung khi assistant snapshot đến sau delta.
- Cho phép snapshot authoritative sửa nội dung đã hiển thị.
- Không trộn phản hồi child agent vào câu trả lời root.
- Giữ tool result, usage, Stop và khả năng kết nối lại sau reload.
- Compact mode không được che câu trả lời đang stream.[4]

**Ngoài phạm vi:** UI phân cấp subagent, durable job queue xuyên restart backend, nâng cấp Claude CLI và tạo release mới.

## 2. Hiện tượng và nguyên nhân gốc

### 2.1 Trước bản sửa

Backend dùng `--output-format stream-json --verbose`, nhưng chưa bật `--include-partial-messages` và chỉ đọc `assistant.message.content`. Vì vậy tên định dạng có chữ “stream” không đồng nghĩa ứng dụng đã xử lý incremental content. Backend nhận content block hoàn chỉnh rồi mới phát `text_delta` chứa cả block.[6]

Có một lỗi độc lập ở Vue: điều kiện `v-show` ẩn toàn bộ assistant row còn `isWorking` khi bật compact mode, kể cả row đã có text.[4]

### 2.2 Sau bản sửa

- CLI được yêu cầu phát partial message.
- Parser xử lý envelope `stream_event.event` theo message/block.
- Snapshot được reconcile, không append nguyên văn lần hai.
- Assistant row trong compact mode được hiện ngay khi có text.[1][4]

### 2.3 Đối chiếu Claude Code VS Code

Đã tải và kiểm tra artifact **Anthropic.claude-code 2.1.308 linux-x64**. Bundle extension truyền option partial xuống CLI, forward từng frame đến webview; webview có assembler xử lý message/block event, cập nhật revision và reconcile final snapshot.[6][7]

Các điểm neo trong bundle gốc, tính theo **byte UTF-8 zero-based**:

| File | Offset | Bằng chứng |
|---|---:|---|
| `extension.js` | 3438724 | `includePartialMessages:!D1.env.remoteName` |
| `extension.js` | 2692176 | `if(y)a.push("--include-partial-messages")` |
| `extension.js` | 2698532 | Đọc stdout JSON theo dòng |
| `extension.js` | 3129790 | Forward `io_message` |
| `webview/index.js` | 3850421 | Route `stream_event.event` và `parent_tool_use_id` |
| `webview/index.js` | 3673433 | Assembler phân theo parent tool |
| `webview/index.js` | 3676247 | Nối text/thinking delta |
| `webview/index.js` | 3869902 | Reconcile snapshot với row partial |

**Không sao chép nguyên kiến trúc VS Code.** HugRemote giữ SSE và flat chat UI, chỉ áp dụng nguyên tắc partial processing và canonical reconciliation phù hợp. Extension 2.1.308 bật partial khi `remoteName` falsy; không khẳng định nó bật ở mọi remote environment. CLI dùng trong live test là **2.1.302**, khác phiên bản reference.[6]

VSIX SHA-256:

```text
59c875324e0d0cfcc0977896096ad36eb448d002e86bb54494d2a65fabf80df2
```

Checksum khớp registry; chữ ký package riêng chưa được xác minh. Việc đọc bundle và chạy assembler trích xuất không tương đương chạy VS Code UI end-to-end.[6]

## 3. Kiến trúc tổng thể

```text
Browser / ClaudeView
    │ POST prompt
    ▼
Fastify: /api/claude/sessions/:id/messages/stream
    │ startBackgroundPrompt(session, prompt)
    ▼
ClaudeService.activeTasks[sessionId]
    ├── liveMessage + event buffer + listeners
    └── streamClaudePrompt
             │
             ├── Local: spawn(binary, argv)
             └── SSH: sshPool.executeCommand(remote command)
                         │ stdout JSONL / stderr
                         ▼
                StringDecoder + lineBuffer
                         ▼
                message/block assembler
                         ▼
          text_delta / thinking / content_sync / tool / done
                         │
                         ├── cập nhật task.liveMessage
                         └── broadcast tới SSE listeners
                                      ▼
                              fetch ReadableStream
                                      ▼
                              Pinia applyStreamEvent
                                      ▼
                           Vue render text/thinking/tools
```

Cùng một parser xử lý output local và SSH. Khác biệt nằm ở process adapter, không phải thuật toán ghép text. `activeTasks` và `activeProcesses` là state trong process backend.[1]

**Source:** `claudeService.ts:170–188, 1364–1445, 1448–1587`; `api.ts:599–719`.[1][2]

## 4. Khởi chạy CLI và quản lý session

### 4.1 Arguments

Dạng lệnh dưới đây chỉ mô tả cấu trúc; các giá trị trong dấu `<...>` là placeholder:

```text
claude -p <prompt>
  [--model <model>]
  --effort <effort>
  --permission-mode <mode>
  --output-format stream-json
  --include-partial-messages
  --verbose
  [--resume <cli-session-id>]
  [--dangerously-skip-permissions]
```

Cờ partial nằm trong argv chung cho local/SSH. Model, effort, permissions và resume giữ cách resolve hiện có; không phải mọi session đều có toàn bộ optional flags.[1]

### 4.2 Local và SSH

- **Local:** `spawn()` với argv riêng, cwd của session và stdout/stderr dạng pipe. Binary có thể được chỉ định bằng `CLAUDE_BIN_PATH`.
- **SSH:** quote từng argument; dựng remote cwd với `$HOME` khi cần; gọi `claude` trên target. Process handle ánh xạ SSH `exit`/`close`, stdout, stderr và signal về interface chung.
- Sự kiện `system/init` cập nhật `session.cliSessionId` phục vụ lượt resume sau.[1]

**Source:** `claudeService.ts:80–85, 1364–1445, 1742–1783, 1870–1873`.[1]

## 5. JSONL framing và UTF-8

Không được coi mỗi callback stdout `data` là một JSON object. Một chunk có thể chứa nhiều dòng hoặc chỉ một phần dòng; byte UTF-8 của tiếng Việt/emoji cũng có thể bị chia giữa hai chunk.[1][5]

Implementation hiện tại:

1. Dùng `StringDecoder('utf8')` riêng cho stdout và stderr.
2. Nối chuỗi đã decode vào `lineBuffer`.
3. Split theo `\n`, chỉ parse các dòng đã hoàn chỉnh.
4. Giữ phần đuôi chưa đủ dòng.
5. Khi process close, flush decoder và parse phần đuôi, kể cả không có newline cuối.
6. Dòng không bắt đầu bằng `{` hoặc JSON không parse được bị bỏ qua.[1]

Không đưa raw stdout/stderr vào log chẩn đoán mặc định: chúng có thể chứa prompt, nội dung file hoặc dữ liệu nhạy cảm. Lưu ý implementation lỗi hiện tại vẫn có thể đưa tối đa 500 ký tự stderr/stdout vào thông báo chat; cần rà soát thêm trước khi mở hệ thống cho nhiều người dùng.[1]

**Source:** `claudeService.ts:1803–1807, 1860–1867, 2065–2075, 2093–2096, 2111–2124`.[1]

## 6. Assembler và canonical reconciliation

### 6.1 State nội bộ

```typescript
// Rút gọn từ implementation để giải thích dữ liệu.
type ContentBlock = {
  type: string;
  value: string;
  committed: boolean;
};

type StreamMessage = {
  blocks: Map<number, ContentBlock>;
};

messages: Map<string, StreamMessage>;
snapshotBlocks: Map<string, number[]>;
toolBlocks: Set<string>;
currentMessageId: string | undefined;
```

`messages` giữ thứ tự message xuất hiện. Mỗi message có blocks theo stream index. `committed` nghĩa block đã có assistant snapshot, **không phải** đã flush vào disk và cũng không phải chỉ cần nhận `content_block_stop`.[1]

`snapshotBlocks` ánh xạ `messageId:uuid` sang block indices, giúp snapshot lặp có cùng UUID quay về đúng block. `toolBlocks` ngăn phát tool card nhiều lần cho cùng message/block.[1]

### 6.2 Xử lý event từ CLI

| Event | Hành vi |
|---|---|
| `message_start` | Chọn message hiện hành; retire block chưa commit ở attempt cũ |
| `content_block_start` | Tạo block theo index; khởi tạo text/thinking; phát thinking start nếu phù hợp |
| `content_block_delta/text_delta` | Nối text vào block chưa committed |
| `content_block_delta/thinking_delta` | Nối thinking vào block chưa committed |
| `content_block_stop` | Không tự phát tool input đang dang dở |
| `message_stop` | Xóa con trỏ message hiện hành |
| `assistant` | Commit/reconcile snapshot và đọc tool input/usage đầy đủ |
| `user` có `tool_result` | Ghép kết quả theo `tool_use_id` |
| `result` | Dùng result text nếu có, cập nhật usage và phát `done` |

`parent_tool_use_id != null` bị loại khỏi flat root content. Bản này chưa render child-agent message riêng; đây là giới hạn có chủ ý, không phải đã hỗ trợ đầy đủ UI subagent như VS Code.[1]

### 6.3 Tính nội dung canonical

`syncContent()` duyệt các message theo thứ tự trong Map, blocks theo index tăng dần, rồi tạo hai chuỗi: text và thinking.[1]

- Nếu cả hai chuỗi mới tiếp tục bằng prefix cũ: chỉ phát phần nối thêm dưới dạng `text_delta`/`thinking`.
- Nếu có correction, rút ngắn, đổi thứ tự hoặc retirement khiến nội dung không còn prefix cũ: phát `content_sync` chứa toàn bộ text/thinking mới.
- Nếu nội dung không đổi: không phát event thừa.[1]

Ví dụ minh họa, **không phải output model thực tế**:

```text
delta: "Hel"             → UI "Hel"
delta: "lo"              → UI "Hello"
snapshot: "Hello"        → UI "Hello", không append lần hai
snapshot: "Hi"           → content_sync → UI "Hi"
```

Không dùng phép so sánh độ dài đơn thuần. Snapshot `wrong` → `right` có cùng độ dài nhưng vẫn phải thay; snapshot ngắn hơn cũng phải loại text cũ.[1][5]

### 6.4 Snapshot một block và nhiều block

Một assistant record có thể chứa duy nhất một block hoàn tất. Ví dụ thinking ở stream index 0, text ở index 1, nhưng text snapshot lại nằm ở phần tử đầu của mảng `content`. Vì vậy index trong snapshot không luôn bằng stream index.[1][5]

Thuật toán hiện tại ưu tiên mapping UUID đã biết; với snapshot một block chưa có mapping, tìm block cùng type chưa committed. Nhánh fallback dùng thông tin UUID, giá trị và block type; snapshot nhiều block sử dụng content index. Đây là heuristic tương thích contract đã kiểm thử, không phải schema version negotiation với mọi bản CLI tương lai.[1]

**Source:** `claudeService.ts:1811–1858, 1880–1910, 1927–1998`.[1]

### 6.5 Abandoned attempt

Khi message mới thay thế attempt đang dang dở, parser loại **từng block chưa committed** của message cũ, giữ các block đã committed và xóa message nếu không còn block. Sau đó recompute canonical content.[1]

Ca hồi quy quan trọng: message A đã commit thinking nhưng text `DISCARD` chưa commit; message B bắt đầu với text `replacement`. Kết quả phải là `replacement`, không phải `DISCARDreplacement`. Thinking đã committed được giữ.[5]

## 7. Hợp đồng SSE backend → frontend

### 7.1 Endpoints

Các đường dẫn dưới đây là route logic; khi triển khai dưới `/remote`, thêm prefix qua cấu hình base path.[2]

| Method | Route | Mục đích |
|---|---|---|
| POST | `/api/claude/sessions/:id/messages/stream` | Gửi prompt, tạo/attach task và subscribe |
| GET | `/api/claude/sessions/:id/stream` | Nhận snapshot hiện tại rồi tiếp tục nghe task |
| GET | `/api/claude/sessions/:id/task` | Kiểm tra task đang chạy và liveMessage |
| POST | `/api/claude/sessions/:id/cancel` | Yêu cầu dừng CLI |

POST prompt kiểm tra prompt rỗng và session không tồn tại trước khi mở SSE. Cancel trả `{ success: true, cancelled }`; `success: true` không đồng nghĩa luôn có process đang chạy, phải đọc `cancelled`.[2]

### 7.2 Headers và framing

```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

Backend flush headers và viết mỗi event theo dạng một dòng JSON, kết thúc bằng dòng trống. Reverse proxy cần tôn trọng đường truyền không buffering; header này không tự chứng minh mọi tầng proxy đều đã cấu hình đúng.[2]

Ví dụ tổng hợp để mô tả protocol:

```text
data: {"type":"text_delta","text":"Xin "}

data: {"type":"text_delta","text":"chào"}

data: {"type":"content_sync","text":"Xin chào!","thinking":""}

data: {"type":"done","text":"Xin chào!"}

```

### 7.3 Event contract

| Type | Payload chính | Cách frontend xử lý |
|---|---|---|
| `sync` | `status`, `liveMessage`, `contextTokens` | Hydrate message hiện tại khi attach |
| `thinking_start` | Không có text | Bật thinking và mở panel |
| `thinking` | `text` | Append thinking |
| `text_delta` | `text` | Append answer, tắt thinking indicator |
| `content_sync` | `text`, `thinking` | Replace hai trường, kể cả chuỗi rỗng; không xóa tools |
| `tool_use` | `tool` | Thêm tool card |
| `tool_result` | `tool_use_id`, `output`, `status` | Cập nhật card theo ID |
| `done` | `text`, `usage?`, `contextTokens?` | Nhận kết quả từ CLI result/cancel |
| `finish` | `assistantMessage`, `contextTokens` | Nhận message canonical khi task promise kết thúc |
| `error` | `error` | Hiển thị lỗi, kết thúc trạng thái làm việc phía client |

`[DONE]` là sentinel SSE, không phải `ClaudeStreamEvent` JSON. Backend có thể phát `done` trước process close; `finish` xuất hiện khi background promise đã settle và session được lưu. Frontend hiện coi `done`, `finish` hoặc `error` là điều kiện kết thúc đọc và fetch lại sessions.[1][2][3]

**Source:** `claudeService.ts:37–45, 1484–1557`; `api.ts:609–718`; `claudeStore.ts:247–331, 356–387, 462–491`.[1][2][3]

## 8. Background task, persistence và reconnect

### 8.1 Task không phụ thuộc kết nối browser

`startBackgroundPrompt()` tạo một assistant message ngay khi bắt đầu, đánh dấu `isWorking=true`, lưu session rồi chạy CLI. Mỗi delta cập nhật `task.liveMessage` trong RAM và broadcast đến listeners. Event buffer giữ tối đa 1.000 event; task hoàn tất được dọn khỏi Map sau khoảng 10 phút.[1]

Khi HTTP connection đóng, route chỉ gỡ listener, không kill process. GET reconnect gửi `sync` với snapshot mới nhất rồi subscribe event mới. Buffer không được sử dụng như durable replay log có sequence number hoặc `Last-Event-ID`.[1][2]

### 8.2 Persistence thực tế

Session lưu ở `~/.ssh/hugcode_claude_sessions.json`; file limits riêng ở cùng thư mục. Backend lưu placeholder lúc bắt đầu và kết quả cuối; không có ghi disk bắt buộc cho từng delta. GET sessions có thể đọc live state trong RAM, vì vậy reload browser vẫn lấy được partial khi backend còn sống.[1]

**Không suy ra crash recovery:** restart/crash backend làm mất process handle và task state trong RAM; thiết kế này chưa có worker queue/journal để tiếp tục task đang chạy sau restart.

### 8.3 Client reconnect

- Sau bootstrap/fetch sessions: nếu session có `isRunning` và assistant cuối đang `isWorking`, client attach `/stream`.
- Khi fetch stream ném lỗi: vào `isReconnecting` và thử attach lại.
- Cấu hình mặc định tối đa 15 lỗi retry; delay `min(5000, 1000 + retryCount * 800)` ms. Đây là capped linear backoff, không phải exponential.
- Sau completion hoặc hết vòng retry: clear working flags và fetch sessions.[3]

**Caveat hiện tại:** EOF sạch mà không có terminal event không đi cùng nhánh `catch` như network exception; không coi mọi kiểu mất stream đều đã được test hoặc recovery hoàn hảo. Không có heartbeat SSE định kỳ trong các route này.[2][3]

## 9. UI rendering và compact mode

Frontend dùng `fetch()` + `ReadableStream.getReader()` + `TextDecoder` dạng streaming, tách SSE block theo `\n\n`, parse dòng `data: ` và gọi `applyStreamEvent()`.[3]

Khi gửi prompt, store push user message và live assistant message; sau đó lấy lại reactive proxy từ mảng Pinia để mutate. Mutate object gốc trước khi được Vue proxy hóa có thể không kích hoạt UI như mong muốn, nên không thay đổi pattern này tùy tiện.[3]

Điều kiện hiện assistant row:

```vue
v-show="!claudeStore.compactTaskMode || !msg.isWorking || !!msg.text"
```

Trong compact mode, câu trả lời text vẫn hiện khi đang chạy; thinking/tool có quy tắc thu gọn riêng. Rendering text dùng `formatMarkdown(msg.text)` qua `v-html`; bản sửa này không phải một cuộc audit Markdown/XSS.[4]

**Source:** `claudeStore.ts:422–441, 457–491`; `ClaudeView.vue:45–78, 134–145`.[3][4]

## 10. Tool, usage, error và cancellation

### 10.1 Tool và usage

Tool card được tạo từ assistant snapshot có input hoàn chỉnh, không render JSON tool input chưa đủ. Tool result ghép theo ID và có trạng thái `done`/`error`. Partial JSON tool input không có UI incremental riêng trong bản này.[1]

Usage được đọc từ assistant/result, gồm input, output, cache read và cache creation. Nếu `result.usage` không có tổng dương, parser thử `modelUsage` theo cách implementation hiện có. Con số context UI là chỉ số hiện tại của wrapper, không tự khẳng định là phép đo chính xác toàn bộ context window của mọi model.[1]

### 10.2 Process failure

Spawn error phát `error`. Khi close, parser không còn coi text partial là bằng chứng thành công nếu exit code khác 0. Nhánh hiện tại chấp nhận `code === 0 || code === null` khi có text; exit status null vì transport thiếu thông tin vẫn là giới hạn, không phải xác nhận CLI đã exit 0.[1]

Một số lỗi được biểu diễn bằng `error` event nhưng `streamClaudePrompt()` resolve `{text: errorText}`; background `.then()` vẫn có thể đặt `task.status='done'`. Vì vậy **không dùng riêng task.status để suy ra business success**. Bản sửa đã cải thiện UI error event, chưa chuẩn hóa toàn bộ result/error state machine.[1]

### 10.3 Stop

`cancelRun()` cập nhật live state, gửi terminal event và yêu cầu process adapter dừng bằng SIGINT. Có fallback SIGTERM sau 1.200 ms nếu adapter chưa báo `killed`. SSH adapter gửi INT/TERM và đóng channel.[1]

Đây là best-effort cancellation: `ChildProcess.killed` nghĩa đã gửi signal, không bảo đảm toàn bộ subprocess tree đã chết. Chưa có cam kết kill process tree hoặc rollback file thay đổi do tool đã chạy. Khi process close được nhận diện cancel, kết quả canonical có thể trở thành `Đã dừng yêu cầu.`; không cam kết luôn bảo lưu partial text sau Stop.[1]

**Source:** `claudeService.ts:1324–1361, 1998–2061, 2078–2135`; `claudeStore.ts:505–530`.[1][3]

## 11. Bộ kiểm thử và bằng chứng

### 11.1 Lệnh chạy

Chạy từ project root; các suite tự động dùng fixture/mocks cô lập, không gửi prompt vào conversation production:

```bash
npm run test:claude-stream
npm run test:ui
npm run test:git
npm run build
```

`test:claude-stream` gồm backend parser suite và frontend SSE store test. `build:web` chạy `vue-tsc --noEmit` trước Vite bundling. Cần kiểm tra exit code, không chỉ dòng “built”.

### 11.2 Backend parser: 15 test

Các nhóm đã chạy pass:

1. Text xuất hiện trước assistant snapshot và không bị nhân đôi.
2. Thinking delta và block xen kẽ.
3. Nhiều tool turn có text giống nhau, tool input chỉ phát một lần.
4. Snapshot-only fallback.
5. JSON cuối không có newline.
6. UTF-8 chia ở byte boundary trên stdout/stderr.
7. Snapshot một block sau thinking.
8. Root/child namespace không trộn.
9. Correction bằng/ngắn/dài hơn chuỗi cũ.
10. Retire attempt chưa commit.
11. Retire text chưa commit dù thinking đã commit.
12. Nonzero exit sau partial phải phát lỗi.
13. Usage, tool error, spawn error và cancellation.
14. Snapshot-only split blocks.
15. Local và SSH đều có partial flag.[5]

Test setup đổi HOME trước dynamic import và mock process adapters. Kiểm thử “SSH invocation” xác minh args đi qua nhánh SSH trong harness, **không phải live model trên SSH server**.[5]

### 11.3 Frontend và live browser

- Store test chứng minh text/thinking/tool update trước completion, `content_sync` thay canonical text và giữ tools.
- SSR test tái hiện compact mode che partial rồi xác nhận bản sửa.
- Live CLI 2.1.302 probe: 96 text delta trong khoảng 46,860–64,210 giây từ lúc bắt đầu; assistant text snapshot 64,233 giây; result 64,509 giây.
- Live HugRemote UI với CLI thật và dữ liệu cô lập: **81 độ dài text khác nhau**, từ 65 đến 6.880 ký tự trong khoảng 14,479 giây; update xảy ra khi nút Dừng còn active; mọi frame answer được quan sát đều visible trong compact mode.
- Final raw/rendered đều dài 6.880 ký tự, so sánh bỏ whitespace khớp, marker kiểm thử xuất hiện một lần, không có replacement character.
- Reload giữ kết quả cuối. Reload giữa generation trên viewport 390px phục hồi Stop và nhận thinking; Stop thực tế kết thúc yêu cầu và lưu `isWorking=false`.
- Smoke production sau restart xác nhận UI load asset mới. **Không chạy test model vào conversation của người dùng trên production.**

Số liệu ở trên được ghi trong `.hermes-context/features/claude-realtime-streaming/STATE.md` tại commit `21888ea`. Đây là số đo của các lần test đã thực hiện, không đại diện tốc độ mọi model/network. TTFB có thể vẫn cao do model thinking trước khi phát text.

## 12. Vận hành và xử lý sự cố

### 12.1 Có thinking nhưng chưa có answer

Đọc trạng thái live/task và độ dài thinking thay vì kết luận transport bị treo. Model có thể dành thời gian dài để thinking; partial flag không làm model bỏ giai đoạn này. Trong compact mode thinking có thể được thu gọn trong khi chưa có text.[1][4]

### 12.2 Text vẫn hiện một lần ở cuối

Kiểm tra theo thứ tự:

1. Backend thực sự chạy dist mới và đã restart sau build.
2. Browser tải asset mới, không dùng bundle cache cũ.
3. CLI trên đúng target hỗ trợ `--include-partial-messages`.
4. CLI có phát `stream_event` và `text_delta` không.
5. Parser có emit delta trước snapshot không.
6. SSE có bị buffering ở reverse proxy/network không.
7. UI compact condition và reactive store có cập nhật không.

Không log full prompt/stdout để đếm event. Chỉ ghi event type, timestamp, chiều dài delta và identifier đã xử lý an toàn. Đây là khuyến nghị chẩn đoán, chưa có metrics endpoint chuyên dụng.

### 12.3 Chữ bị lặp hoặc thứ tự sai

Kiểm tra `message.id`, UUID snapshot, stream block index, single-block snapshot và parent namespace. Không vá bằng cách bỏ mọi assistant snapshot: làm vậy sẽ mất tool input, usage và authoritative correction.[1][6]

### 12.4 Deploy

Sau test/build và xác nhận không có task người dùng cần giữ, áp dụng quy trình deploy hiện có rồi restart service. Restart có thể làm mất task đang chạy trong RAM; không coi deploy là zero-downtime cho generation đang thực thi.

```bash
# Ví dụ môi trường đang dùng systemd user service.
systemctl --user restart hugremote.service
systemctl --user is-active hugremote.service
```

Production smoke phải kiểm tra page render, asset và backend route; build exit 0 không tự chứng minh realtime end-to-end.

## 13. Giới hạn và hướng cải tiến

Các điểm dưới đây **chưa được triển khai hoặc chưa được chứng minh toàn diện**, không phải tính năng đã có:

- Chưa có durable task queue/recovery qua backend restart.
- Chưa có nested child-agent UI; child content bị loại khỏi root.
- Snapshot mapping một block có heuristic; cần regression khi CLI schema thay đổi.
- Chưa có heartbeat, sequence ID và replay ACK; clean EOF cần được harden thêm.
- Tổng stdout/stderr/content trong một invocation chưa có giới hạn byte riêng trong parser này; buffer event giới hạn 1.000 không giới hạn tổng memory của task.
- `syncContent()` tổng hợp lại toàn bộ message/block mỗi lần; chi phí tăng theo tổng content. Chưa benchmark transcript rất lớn hoặc nhiều session đồng thời.
- Chưa chuẩn hóa `error` event, promise result và task status thành state machine thống nhất.
- Chưa chứng minh cancellation tiêu diệt toàn bộ process tree.
- Live model E2E được thực hiện local; nhánh SSH có kiểm thử adapter/args, chưa có live model SSH trong lượt này.
- Chưa xác minh VS Code UI thật; artifact reference đã đọc static và assembler trích xuất đã chạy với protocol frame tổng hợp.

Các giới hạn được suy ra trực tiếp từ cấu trúc code và phạm vi kiểm thử hiện tại; không thay thế security review hoặc load test.[1][2][3]

## 14. Bản đồ source để bảo trì

| Thành phần | Vị trí tại `6ca0bdf` |
|---|---|
| Event union | `apps/api/src/services/claudeService.ts:37–45` |
| Local/SSH adapter | `apps/api/src/services/claudeService.ts:1364–1445` |
| Background task và liveMessage | `apps/api/src/services/claudeService.ts:1448–1587` |
| CLI argv | `apps/api/src/services/claudeService.ts:1742–1783` |
| Assembler/reconcile | `apps/api/src/services/claudeService.ts:1811–1998` |
| Decode/result/close | `apps/api/src/services/claudeService.ts:2022–2135` |
| SSE route | `apps/api/src/routes/api.ts:599–719` |
| Task/cancel route | `apps/api/src/routes/api.ts:721–737` |
| Pinia event reducer | `apps/web/src/stores/claudeStore.ts:247–331` |
| Reconnect | `apps/web/src/stores/claudeStore.ts:334–401` |
| Send/read loop | `apps/web/src/stores/claudeStore.ts:404–503` |
| Compact visibility | `apps/web/src/components/ClaudeView.vue:45–78` |
| Parser regression | `scripts/test_claude_streaming.ts` |
| Frontend SSE regression | `scripts/test_ui_claude_stream.mjs` |
| Compact SSR regression | `scripts/test_ui_claude_context.mjs` |

Tài liệu bằng chứng artifact gốc: `docs/claude-realtime-reference.md`. Không sửa các offset/hash ở tài liệu reference khi nâng CLI mà chưa tải và kiểm chứng artifact mới.

## Sources

[1] https://github.com/vibecoding-hungkc/hugremote/blob/6ca0bdf/apps/api/src/services/claudeService.ts — apps/api/src/services/claudeService.ts
[2] https://github.com/vibecoding-hungkc/hugremote/blob/6ca0bdf/apps/api/src/routes/api.ts — apps/api/src/routes/api.ts
[3] https://github.com/vibecoding-hungkc/hugremote/blob/6ca0bdf/apps/web/src/stores/claudeStore.ts — apps/web/src/stores/claudeStore.ts
[4] https://github.com/vibecoding-hungkc/hugremote/blob/6ca0bdf/apps/web/src/components/ClaudeView.vue — apps/web/src/components/ClaudeView.vue
[5] https://github.com/vibecoding-hungkc/hugremote/blob/6ca0bdf/scripts/test_claude_streaming.ts — scripts/test_claude_streaming.ts
[6] https://github.com/vibecoding-hungkc/hugremote/blob/6ca0bdf/docs/claude-realtime-reference.md — docs/claude-realtime-reference.md
[7] https://openvsx.eclipsecontent.org/Anthropic/claude-code/linux-x64/2.1.308/Anthropic.claude-code-2.1.308@linux-x64.vsix — Claude Code VSIX 2.1.308
