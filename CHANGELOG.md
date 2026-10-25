# 📋 Changelog — HugRemote

## [v1.5.3] - 2026-10-25

Bản sửa Context Window dùng dữ liệu native từ Claude CLI, hiển thị đúng model 1M và tự phục hồi khi canonical CLI session identity thay đổi.

### Native Context Window
- Lấy effective model, token usage, raw context maximum và percentage qua native `get_context_usage` summary.
- Xóa heuristic theo tên model và fallback `200k` trong Composer, Limits Popup và Session Hub.
- Model 1M hiển thị đúng `1M`; unavailable hiển thị rõ ràng thay vì số liệu giả.

### Session freshness và race safety
- Theo dõi `cliSessionId` trong frontend scope identity nhưng không gửi resume ID từ client lên endpoint.
- Khi hydration nhận CLI session identity mới, tự refetch context đúng một lần và bỏ qua response thuộc identity cũ.
- Chặn response PATCH cũ ghi đè model/effort mới; `/clear` vô hiệu hóa context ngay và session đã xóa không bị response muộn hồi sinh.

### Backend hardening
- Ràng buộc context probe theo canonical server/CWD/session; giới hạn bốn probe, coalescing và cache LRU ngắn.
- Cache key dạng JSON tuple; HTTP error được sanitize theo trusted error classes.
- Cleanup SIGTERM/SIGKILL, close và EPIPE muộn an toàn.

### Bàn phím ảo Terminal
- Tăng ký tự phím đúng 1,5 lần và thu gọn padding/gap mà không giảm chiều cao vùng bấm.
- Dùng legend gọn có accessible name đầy đủ; 62 phím không overflow tại viewport `320/360/375/390/480px`.

### Kiểm chứng
- PASS `npm run test:claude-context`: 26 backend + 24 frontend.
- PASS model, resume, stream, UI, Git regression suites và full production build.
- Independent reviews không còn security/logic findings.
- Browser production hiển thị `16.7k / 1M · 2.0%` với `hermes-claude[1m]`.

### Phạm vi và giới hạn
- Account quota 5 giờ/tuần là scope riêng và chưa chuyển sang native `get_usage`.
- Không cập nhật/restart trong lúc Claude đang generation.
- Updater caveat có sẵn: `--dry-run` có thể restart service khi đã ở bản mới nhất.

---

## [v1.5.2] - 2026-10-23

Bản sửa giúp Claude Chat tiếp tục hiển thị tiến độ và giữ lịch sử nhất quán khi rời màn hình rồi quay lại.

### Lịch sử và ngữ cảnh phiên
- Giữ đúng reactive message khi tải lại danh sách phiên; stream không còn ghi vào object đã tách khỏi màn hình.
- Chặn snapshot tải chậm ghi đè tiến độ mới; snapshot canonical vẫn có quyền sửa nội dung, kể cả rút ngắn phần phản hồi chưa commit.
- Background run cập nhật đúng phiên được lưu, giữ CLI session ID và token metadata để tiếp tục ngữ cảnh qua các lượt và reload.

### Reconnect trên mobile
- Khi trở lại tab Claude hoặc browser foreground, đồng bộ snapshot và nối lại qua GET stream, không gửi lại prompt POST.
- Mỗi phiên có transport ownership và AbortController; response hoặc cleanup cũ không làm thay đổi trạng thái của phiên mới.
- Thêm timeout 30 giây cho bước nhận headers của GET và cho stream không nhận byte; retry có backoff và giới hạn 15 lần.
- Khi hết retry nhưng server vẫn chạy, giữ Stop và chặn gửi trùng prompt; lần foreground tiếp theo có thể khởi động lại recovery.
- Xử lý đúng terminal sync done/error/cancelled và nội dung canonical rỗng.

### SSE và trạng thái giao diện
- Cleanup subscriber theo vòng đời response close/finish, không theo request đã đọc xong; rời browser không hủy background task.
- Heartbeat SSE mỗi 15 giây, cleanup timer khi đóng hoặc kết thúc.
- Loading hiển thị cả chế độ thường, không chỉ compact mode; không hiển thị tool đã hoàn thành như task đang chạy.

### Kiểm chứng
- `npm run test:claude-resume`: 27 kiểm tra gồm history persistence, 8 real-HTTP SSE, 13 store recovery và 5 activity UI.
- `npm run test:claude-stream`, `npm run test:claude-models`, `npm run test:ui`, `npm run test:git`: pass.
- `npm run build`: pass, bao gồm web typecheck và TypeScript backend.
- Browser kiểm thử cô lập qua HTTP: rời/vào lại nhận tiếp text, không gửi trùng prompt, finish tắt Stop/loading, lịch sử cuối khớp sau reload. Đã smoke-test bundle production sau triển khai.

### Phạm vi và giới hạn
- Chưa sửa phần số liệu quota/usage hoặc đồng bộ đầy đủ slash commands.
- Timeout headers mới áp dụng cho GET recovery; POST ban đầu chưa bổ sung header timeout.
- Backend restart chưa có durable recovery cho process đang chạy; hãy hoàn tất/dừng task trước khi cập nhật.
- Lỗi updater có sẵn: nhánh đã ở bản mới nhất vẫn có thể restart service ngay cả khi truyền `--dry-run`. Không dùng updater trong lúc generation đang chạy.

---

## [v1.5.1] - 2026-10-23

Bản sửa tập trung vào Claude Chat phản hồi realtime, danh sách model theo CLI native và Git trên máy chủ SSH.

### Claude Chat realtime
- Bật partial messages trên CLI local và SSH; hiển thị text/thinking ngay khi CLI phát delta, không chờ assistant snapshot hoàn tất.
- Reconcile snapshot theo message/block, sửa nội dung authoritative mà không nhân đôi text; loại bỏ phần chưa commit của attempt bị thay thế.
- Không trộn child-agent content vào câu trả lời root; xử lý UTF-8 chia chunk, JSON cuối thiếu newline và lỗi process sau khi đã có partial output.
- Compact mode giữ câu trả lời text đang stream. Background task và frontend áp dụng canonical `content_sync` mà không xóa tool cards.

### Model picker native
- Thay parser chuỗi hướng dẫn `/model Usage` bằng control protocol `initialize`, cùng nguồn model metadata mà package Claude Code VS Code sử dụng.
- Giữ nguyên native value, label, description, custom model ID và suffix `[1m]`; chọn Default không ép `--model`.
- Cache theo target/cwd và nhận diện binary local; lỗi discovery có thông báo/retry, không dựng danh sách fallback giả hoặc lấy danh sách máy khác.
- Chặn response discovery cũ ghi đè lựa chọn mới khi đổi model, effort hoặc ngữ cảnh phiên.

### Git qua SSH
- Hỗ trợ status, diff, branches, stage, unstage, commit, checkout, pull và push trên repository thuộc project của target SSH.
- Thực thi request-scoped, quote argv/cwd, kiểm tra scope, timeout và output limit; xử lý đúng vòng đời exit/close của SSH channel.

### Giao diện
- Nút đính kèm context dùng icon, giữ tooltip và accessibility label.
- Bỏ nút History/report trùng ở composer; giữ History trên header và báo cáo qua context window.
- Icon tải folder đồng nhất với file; tải folder vẫn đóng gói ZIP.

### Kiểm chứng
- PASS `npm run test:claude-models`: 14 backend discovery tests và 6 frontend regression cases.
- PASS `npm run test:claude-stream`: 16 backend parser/dispatch tests và frontend SSE integration.
- PASS toàn bộ `npm run test:ui`, `npm run test:git`, kiểm tra icon download và CLI version/updater dry-run.
- PASS `npm run build`, bao gồm `vue-tsc --noEmit` và TypeScript backend.
- Đã kiểm thử browser với CLI thật trên session cô lập: picker native, chọn model và reload, nhận phản hồi model thật, mobile 390px và lỗi/retry; kiểm thử Git mutations trên SSH fixture riêng.

### Phạm vi và giới hạn
- Không tuyên bố kế thừa toàn bộ slash commands hoặc effort UI native; `/clear`, `/compact` và command parity chưa được sửa trong release này.
- Background generation chưa có durable recovery qua backend restart; nên hoàn tất hoặc dừng task trước khi cập nhật/restart.
- Live model E2E chạy local; nhánh model discovery/streaming SSH có transport regression, không coi đó là live model SSH E2E.
- Tham khảo VS Code dựa trên artifact 2.1.308 và source trace, không phải kiểm thử VS Code editor live.

---

## [v1.5.0] - 2026-10-22

### 🚀 Tính năng nổi bật (Major Features)
- **Tải lên & Tải xuống Tệp/Thư mục và Tự động Nén Zip (File Explorer Upload & Download with Zip Packaging)**:
  - Tải lên tệp lẻ hoặc tải lên cả cây thư mục (`webkitdirectory`) trực tiếp trên giao diện File Explorer và backend API.
  - Tải xuống từng tệp đơn lẻ hoặc tự động đóng gói nén thư mục thành file `.zip` (`tempZipService.ts`) với cơ chế streaming nhanh chóng.
  - Tích hợp bộ đệm file zip tạm thời tại `~/.config/hugremote/tmp/downloads/` với cơ chế tự động dọn dẹp theo thời gian sống (TTL 60 phút), quét định kỳ và giới hạn dung lượng LRU (500MB).
  - Modal quản lý File nén tạm (Zip Cache Manager) cho phép người dùng theo dõi dung lượng và dọn dẹp cache tức thì.
- **Claude Context Attachment Picker (Đính kèm ngữ cảnh tệp/thư mục)**:
  - Bổ sung nút **Add context** trên composer của Claude View, cho phép chọn file hoặc thư mục từ danh sách cây tệp tin trong project hiện tại.
  - Tự động chèn cú pháp `@<đường-dẫn>` vào bản nháp câu lệnh mà không can thiệp hay thay đổi working directory (`cwd`) của phiên Claude đang chạy.
  - Tối ưu giao diện modal vừa vặn với kích thước màn hình smartphone (viewport 390px).

### 🛠️ Cải tiến Trải nghiệm & Giao diện (UI/UX & Mobile Parity)
- **Bảo vệ Nội dung Chưa lưu (Unsaved Changes Guard & Modal)**:
  - Hộp thoại `UnsavedChangesModal.vue` tự động nhắc nhở người dùng khi có nội dung sửa dở trước mọi thao tác chuyển ngữ cảnh: đóng file, mở file khác, đổi server, đổi project hoặc xóa project.
  - Cung cấp 3 lựa chọn trực quan: **Lưu (Save)**, **Không lưu (Discard)** và **Hủy (Cancel)**.
  - Khôi phục chỉ báo dirty (`*` và chấm trạng thái) trên `SmartHeader.vue`.
  - Cơ chế xếp hàng tuần tự (serialized save queue) ngăn ngừa xung đột ghi đè race condition khi lưu file đồng thời từ toolbar và modal xác nhận.
- **Thanh Phím Điều khiển Nâng cao cho CodeMirror trên Mobile (Touch Keybar)**:
  - Bổ sung phím **Undo** (`undo(view)`), phím điều hướng con trỏ **Trái / Phải** (`cursorCharLeft`, `cursorCharRight`) giữ nguyên focus editor.
  - Drawer phím tắt mở rộng cung cấp các toán tử và từ khóa thông dụng cho lập trình viên trên smartphone: `!==`, `&&`, `||`, `import`, `export`.
- **Quản lý & Đổi tên Project (Project Management)**:
  - Bổ sung form đổi tên project ngay trên giao diện `ProjectModal.vue` thông qua API `PATCH /api/projects/:id`.
  - Chặn đặt tên dành riêng `'~'` (cả ở frontend lẫn backend) để ngăn project thường bị vô hiệu hóa tính năng do trùng tên với Home workspace.
- **Đồng bộ hóa Chuyển đổi Server (Server Synchronization)**:
  - Đồng bộ trạng thái giữa `ServerModal.vue` (Server Manager) và `ServerDrawer.vue`.
  - Bổ sung cờ `scopeBusy` và cảnh báo lỗi `scopeError` khi chuyển server thất bại, giữ nguyên server cũ thay vì rơi vào trạng thái giao diện bất nhất.

### 🐛 Vá lỗi & Ổn định Hệ thống (Bug Fixes & Hardening)
- **Terminal Reconnect & Lifecycle Hardening**:
  - Khắc phục lỗi màn hình trắng khi bấm nút "+" tạo cửa sổ terminal mới do thiếu import `useProjectStore` trong `NewTerminalModal.vue`.
  - Đình chỉ toàn bộ cơ chế auto-reconnect của `TerminalView` khi một phiên đang trong quá trình DELETE hoặc khởi động lại CWD (`beginClose`, `beginRestart`), tránh việc tạo lại session cũ trên PTY backend khi mạng phản hồi chậm.
  - Bắt buộc gọi API `DELETE /api/sessions/:id` backend thành công trước khi xóa session khỏi frontend state.
  - Thêm ResizeObserver và watcher trạng thái kích hoạt trên `TerminalView.vue` giúp giao diện terminal co giãn linh hoạt 100% full-screen trên cả màn hình lớn và di động.
- **Git Upstream Status**:
  - Sửa lỗi hiển thị "Branch chưa có upstream" trong `gitStore.ts` khi repository đã cấu hình upstream hợp lệ.
- **Claude `/status` Command**:
  - Sửa lệnh slash `/status` đọc đúng thông tin server hiện tại từ `serverStore.currentServer`.
- **Authentication & Default Password**:
  - Bổ sung xuất khẩu `mustChangePassword` & `changePassword` từ `authStore`, tự động bootstrap khi đăng nhập và kiểm soát chặt chẽ luồng đổi mật khẩu mặc định.
- **Typecheck & Kiểm thử Hồi quy Toàn diện (Quality Gates)**:
  - Tích hợp `vue-tsc --noEmit` vào script `build:web` trong `package.json`, đảm bảo 0 lỗi type khi biên dịch production bundle.
  - Bổ sung 8 bộ test UI tự động (`npm run test:ui`) với 63/63 bài test pass exit 0 bao phủ toàn diện các luồng thao tác phức tạp.

---

## [v1.4.0] - 2026-10-21

### 🚀 Tính năng nổi bật (Major Features)
- **Tiến trình Claude Chạy Nền Kiên Cường & Tái Kết Nối SSE (Background Execution & Resilient Reconnection)**:
  - Tách rời vòng đời thực thi của Claude CLI khỏi HTTP request đơn lẻ: tiến trình CLI chạy ngầm liên tục trên backend daemon `hugremote.service` ngay cả khi tắt màn hình điện thoại, đóng trình duyệt hoặc mạng gián đoạn.
  - Hỗ trợ endpoint tái gắn kết nối `GET /api/claude/sessions/:id/stream` truyền snapshot sự kiện tức thì và stream tiếp phản hồi trực tiếp.
  - Tự động nhận diện tab hiển thị lại qua sự kiện `visibilitychange` và `window focus`, tự kích hoạt đồng bộ phiên và nối lại stream nền với backoff an toàn.
  - Hiển thị banner trạng thái tái kết nối thông minh (`.claude-reconnecting-banner`) trên giao diện khi đang bắt lại tiến trình nền.
- **Model Discovery Chuẩn Xác theo Claude CLI (`claude -p /model`)**:
  - Chuyển đổi cơ chế khám phá model sang single-source-of-truth trực tiếp từ lệnh `claude -p /model --output-format json` trên từng máy chủ (cả máy host local và máy chủ remote qua SSH).
  - Loại bỏ hoàn toàn việc đọc nhầm các khóa tự định nghĩa (`aenv`, `modelPicker`, `availableModels`) trong `settings.json`.
  - Giữ nguyên vẹn các alias model đặc thù như `sonnet[1m]`, `opus[1m]`, `fable[1m]`, `opusplan`, `best` và chuyển tiếp chính xác đối số `--model <alias>` vào tiến trình Claude Code CLI.
  - Phân giải động mô tả alias (Resolves to...) dựa theo biến môi trường ánh xạ thật sự (`ANTHROPIC_DEFAULT_*_MODEL`).
  - Tối ưu hóa bộ nhớ đệm model (Cache TTL 30s) và hỗ trợ tham số làm mới tức thì `?refresh=1`.
- **Đếm Token Chuẩn Xác & Context Window Động (Dynamic Context Ceiling)**:
  - Bóc tách số lượng token thực tế từ các bản ghi `usage` trong file transcript `.jsonl` và stream chunks.
  - Tự động nhận diện và cập nhật trần ngữ cảnh: `1000k` đối với các model mở rộng 1M context (`sonnet[1m]`, `opus[1m]`,...) và `200k` đối với các model tiêu chuẩn.
  - Bổ sung lệnh slash `/cost` trong khung chat: xuất bảng Markdown trực quan hiển thị model hiện tại, số token đã dùng, phần trăm context tiêu thụ, tổng chi phí và khuyến nghị chạy `/compact` khi vượt ngưỡng 70%.
  - Hiển thị thông số token (`contextTokens`) và chi phí ước tính (`totalCostUSD`) trực tiếp trên từng mục phiên tại Claude Session Hub Modal.
- **Duy trì Trạng thái Đa tầng khi F5 / Thoát Trình Duyệt (Multi-tier Persistence)**:
  - Lưu trữ và phục hồi liền mạch Server đang chọn (`hugremote_active_server`), Project đang chọn (`hugremote_active_project_<serverId>`), Phiên Terminal đang mở (`hugremote_active_term_<serverId>`) và Phiên Claude đang chạy (`hugremote_active_session_<serverId>_<projectId>`).
  - Khắc phục triệt để tình trạng F5 làm lệch root path hoặc đứt ngữ cảnh đang làm việc dở dang.
- **Interactive Prototype: Download, Upload & Tự Động Nén Zip / Dọn Dẹp File Tạm**:
  - Giao diện xem trước tại `prototype.html` mô phỏng đầy đủ tính năng: tải lên file lẻ hoặc đệ quy cả thư mục (`webkitdirectory`), kéo thả tệp/thư mục trực tiếp vào giao diện.
  - Tải xuống file đơn lẻ hoặc nén zip toàn bộ thư mục bằng JSZip và lưu trữ tạm thời tại `~/.config/hugremote/tmp/downloads/`.
  - Modal quản lý file nén tạm (Auto-Cleanup Manager) với bộ đếm TTL (hết hạn sau 60m), cơ chế quét định kỳ (mỗi 15m), giới hạn LRU (500MB) và nút dọn dẹp sạch tức thì.

### 🐛 Vá lỗi & Tối ưu hóa (Bug Fixes & Refinements)
- Sửa lỗi mất hậu tố `[1m]` khi người dùng chọn model `sonnet[1m]` trong popup khiến Claude CLI bị ép về bản 200k.
- Sửa lỗi lệnh slash `/model <name>` tìm kiếm theo thuộc tính không tồn tại (`label`) thay vì `id`/`title`/`prefix`.
- Khắc phục lỗi Vue Reactivity không kích hoạt re-render khi gán trực tiếp thuộc tính mới vào `modelsByServer.value[serverId]`.
- Thêm kiểm tra phòng vệ (guard check) trước khi gọi `--resume <cliSessionId>`: tự động xác minh file `<cliSessionId>.jsonl` có tồn tại trước khi resume để tránh crash tiến trình CLI khi file transcript bị xóa bên ngoài.

---

## [v1.3.1] - 2026-10-18

### 🐛 Vá lỗi & Đồng bộ Trạng thái Phiên / Model (Bug Fixes)
- **Đồng bộ danh sách Claude Models theo Server đang chọn**:
  - Khắc phục triệt để lỗi chuyển đổi Server nhưng danh sách model vẫn hiển thị model của server trước đó.
  - Phân tách ranh giới môi trường thực thi: remote SSH server không còn bị đọc nhầm biến môi trường `process.env.ANTHROPIC_BASE_URL` của máy chủ host (local).
  - Cập nhật backend `serverConfigResolver` hỗ trợ tìm kiếm linh hoạt theo cả ID (`server-ssh-...`) và tên host (`s.name`).
  - Frontend `claudeStore`: lưu trữ cache model riêng biệt theo từng `serverId` (`modelsByServer`, `modelSourceByServer`), tự động theo dõi `serverStore.currentServerId` để cập nhật danh sách tức thì trên `ModelSelectorPopup` và `NewClaudeModal`.
- **Duy trì Project và Phiên Claude khi F5 (Persistence on Reload)**:
  - Khắc phục lỗi khi F5 trang web bị nhảy về Root path (`~`) trong khi Claude vẫn giữ phiên của project trước đó.
  - Lưu trạng thái project đang kích hoạt vào `localStorage.getItem('hugremote_active_project_<serverId>')`.
  - Tối ưu hóa thứ tự khởi tạo trong `useAppBootstrap`: nạp Server -> Project -> Files -> Terminal -> Claude -> Git theo luồng tuần tự tin cậy.
  - Khớp nối `claudeStore.currentServerSessions` và `ensureProjectSession()` chính xác theo `projectId` và `cwd` của project đang chọn.
  - Quản lý phiên CLI: quét transcript và hiển thị Project Sessions khớp 100% với `rootPath` của project đang chọn.

---

## [v1.3.0] - 2026-10-18

### 🏗️ Kiến trúc Fullstack Monorepo (`nodejs-fullstack-structure`)
- **Tái cấu trúc Monorepo phân tách ranh giới rõ ràng**:
  - `apps/api`: Backend Fastify độc lập (`@hugremote/api`), tách biệt `app.ts` (`createApp`) và `main.ts` (`startServer`), module hóa cấu hình và dịch vụ.
  - `apps/web`: Frontend Vue 3 + Vite (`@hugremote/web`), phụ thuộc kiểu dữ liệu dùng chung và xuất bản tĩnh sang `apps/api/public`.
  - `packages/shared`: Thư viện hợp đồng và kiểu dữ liệu dùng chung (`@hugremote/shared`), chuẩn hóa models universal (`ClaudeSession`, `ClaudeMessage`, `ServerItem`, `TerminalSessionInfo`,...).
  - Thiết lập quản lý workspace đồng thời qua `pnpm-workspace.yaml` và npm workspaces.
  - Duy trì tương thích ngược 100% qua symlink `client -> apps/web`, `server -> apps/api` và CLI `bin/hugremote.js`.

### 🧭 Path Router cho các Tab giao diện
- **Định tuyến chuẩn theo URL Hash (`#/path`)**:
  - Tự động đồng bộ đường dẫn trên thanh địa chỉ theo từng tab: `#/files`, `#/editor`, `#/terminal`, `#/claude`, `#/git`.
  - Hỗ trợ đầy đủ phím điều hướng **Back / Forward** của trình duyệt (`window.history.back()`).
  - Duy trì trạng thái tab khi tải lại trang (F5 reload) qua 3 lớp: URL hash, `localStorage` fallback và store reactivity.

### 🛡️ Security Audit & Gia cố bảo mật
- **Nâng cấp gói phụ thuộc loại trừ lỗ hổng (0 CVEs)**: Nâng cấp `@fastify/static` lên `v10.1.6`, khắc phục hoàn toàn nguy cơ route guard bypass qua đường dẫn mã hóa (GHSA-83w8-p2f5-377r).
- **Gia cố `.gitignore`**: Bổ sung quy tắc phòng chống rò rỉ file `*cookie*`, `*credentials*` và các artifact monorepo.
- **Xác thực bảo vệ lớp biên**: Xác nhận hệ thống được bảo vệ vững chắc bởi Cloudflare Access Zero Trust và tiến trình chỉ lắng nghe trên Loopback `127.0.0.1:8099`.

---

## [v1.2.0] - 2026-10-17

### 🚀 Tính năng mới (Major Features)
- **Kết nối Claude Code CLI Project Sessions thực tế (`~/.claude/projects/`)**:
  - Lệnh `/resume` kết nối trực tiếp với danh sách phiên làm việc thật của Claude Code CLI theo project slug.
  - Tự động bóc tách thông tin phiên từ các file JSONL transcript: ID, tóm tắt prompt, số lượng tin nhắn, model, nhánh git và mốc thời gian.
  - Giao diện Claude Session Hub mới với 2 tab riêng biệt: Tab "Phiên Claude CLI (Project)" và Tab "Phiên HugRemote", hỗ trợ tìm kiếm và khôi phục nhanh (Resume) ngữ cảnh đầy đủ vào chat.
- **Thực thi và Autocomplete Slash Commands chuẩn Claude**:
  - Danh sách gợi ý phẳng 22 slash commands chuẩn Claude CLI / Chat khi nhập `/` ở đầu dòng.
  - Sửa lỗi autocomplete: tự động điền lệnh kèm khoảng cách `/command ` và đưa con trỏ chuột ra sau.
  - Hỗ trợ thao tác cảm ứng mobile (`touchstart`), chuột (`mousedown`) và bàn phím (`Enter`, `Tab`).
  - Lệnh `/clear` hoạt động tức thì trên UI và server, dọn sạch hội thoại kèm Action Toast thông báo.

### 🛠️ Khắc phục sự cố Installer (`install.sh` & `beta.sh`)
- **Tự động khởi động lại Systemd Service khi cài đặt lại**: Sửa lỗi `install.sh` và `beta.sh` chỉ chạy `enable --now || start` (vốn là no-op khi service đang active), chuyển sang kiểm tra và gọi `systemctl --user restart hugremote` để tải ngay mã nguồn mới.
- **Tự động nhận diện thư mục cài đặt hiện có**: Nhận diện đường dẫn từ `~/.local/bin/hugremote` hoặc file cấu hình service systemd để cập nhật đúng thư mục mục tiêu.
- **Bảo đảm Git Checkout không bị xung đột**: Tự động stash các thay đổi cục bộ và thực hiện reset hard về tag/ref mục tiêu.
- **Fallback Release Tag linh hoạt**: Tự động truy vấn git ls-remote khi GitHub API bị giới hạn tần suất (rate-limit).

---

## [v1.1.1] - 2026-10-17

### ⚡ Cải tiến giao diện & Sửa lỗi (Improvements & Fixes)
- **Tối giản hiển thị Claude Thinking**: Loại bỏ hoàn toàn dòng chữ mô tả thừa `Phân tích yêu cầu và codebase`, chỉ giữ lại biểu tượng loading xoay tròn và nhãn `Thinking…` (hoặc `✳ Thinking…`) tinh gọn trên mobile.
- **Đồng bộ mã nguồn Release chính thức**: Cập nhật bản phát hành Release mới nhất đồng bộ đầy đủ các commit mới nhất từ nhánh `main`.

---

## [v1.1.0] - 2026-10-17

### 🚀 Tính năng chính mới (Major Features)
- **Tích hợp Telegram Bot**:
  - Giao tiếp và điều khiển Claude Code thời gian thực trực tiếp từ Telegram với streaming output, tool call cards, thinking block.
  - Hỗ trợ chế độ Topic (Forum / Threaded Mode) để quản lý nhiều phiên làm việc Claude độc lập.
  - Lệnh `/terminal` chạy trực tiếp lệnh Bash trên máy chủ.
  - Hỗ trợ xem output dài qua File Server nội bộ và bảo mật whitelist người dùng `TELEGRAM_ALLOWED_USERS`.
- **Hệ thống CLI Cập nhật & Kiểm tra phiên bản (`hugremote update` & `--version`)**:
  - Lệnh `hugremote update` tự động nhận diện kênh cài đặt (kênh Stable theo GitHub Release chính thức mới nhất, kênh Beta theo nhánh `main`).
  - Hỗ trợ các cờ chuyển kênh: `--stable`, `--beta`, và `--force`.
  - Hỗ trợ chuyển đổi thông minh ký tự gạch ngang di động (`—version`, `–version` sang `--version`).
- **Trình cài đặt 1 lệnh tối ưu (One-Command Installer)**:
  - Tự động phát hiện và cài đặt các môi trường còn thiếu (`git`, `build-essential`, `python3`, `Node.js 20 LTS`).
  - Bảng hướng dẫn cài đặt thủ công rõ ràng theo từng hệ điều hành khi chạy trong môi trường không có sudo.
- **Trình duyệt File từ xa qua SFTP (Remote SFTP File Manager)**:
  - Quản lý tệp tin và thư mục từ xa trên máy chủ SSH / Docker container: tạo mới, đổi tên, xóa, mở chỉnh sửa trực tiếp.
- **Bàn phím ảo Laptop 5 hàng tối ưu Mobile**:
  - Tích hợp bàn phím ảo đầy đủ phím chuyên dụng lập trình (Esc, Tab, Ctrl, Alt, Phím điều hướng, Ký tự đặc biệt) ngay trên màn hình cảm ứng di động.
- **Layout Header 2 tầng (Proposal 9)**:
  - Phân tầng hiển thị Server / Project và Session Pill toàn chiều rộng, tối ưu diện tích trên màn hình di động (390px).
- **Tự động dọn dẹp & giải phóng phiên Terminal (Auto Eviction)**:
  - Tự động đóng phiên terminal không hoạt động sau 30 phút, cơ chế LRU tối đa 50 kết nối tránh nghẽn tài nguyên.

---

## [v1.0.1] - 2026-10-09

### 🐛 Sửa lỗi (Bug Fixes)
- **Terminal trên macOS/MacBook**: Sửa lỗi không mở được terminal trên máy Mac.
- **Bàn phím Terminal**: Tối ưu nhận diện phím trên macOS, tránh lỗi gõ lặp ký tự.
- **Xem & Sửa file Markdown**: Sửa lỗi không mở được file `.md`, hỗ trợ chuyển đổi mượt mà giữa chế độ xem trước (Preview) và chỉnh sửa (Edit).
- **Giao diện Web IDE**: Sửa lỗi màn hình trắng khi tải giao diện lần đầu.

### ⚡ Cải tiến (Improvements)
- **Thư mục làm việc (Workspace)**: Mặc định mở ngay tại thư mục gốc người dùng (`~`), hiển thị đầy đủ các thư mục trên máy thay vì bắt buộc vào `~/projects`.
- **Cập nhật một chạm**: Tự động nhận diện cấu hình cũ khi chạy cập nhật, nhấn Enter để giữ nguyên mà không cần trả lời lại câu hỏi.
- **Kênh cài đặt Beta**: Thêm script `beta.sh` để cập nhật các bản vá mới nhất trực tiếp từ nhánh `main`.

---

## [v1.0.0] - 2026-10-09

### 🚀 Tính năng chính
- **Mobile-First Web IDE & Terminal**: Trình soạn thảo mã nguồn và terminal đa cửa sổ tối ưu cho điện thoại.
- **Tích hợp Claude Code**: Giao diện chat trực quan với thẻ thực thi lệnh, diff và quản lý phiên làm việc.
- **Xác thực linh hoạt**: Hỗ trợ 3 chế độ (Không mật khẩu, Mật khẩu đổi lần đầu, Google OAuth).
- **Bảo mật**: Phòng vệ truy cập trái phép, bảo vệ an toàn hệ thống tệp và phiên đăng nhập.
