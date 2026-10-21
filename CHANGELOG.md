# 📋 Changelog — HugRemote

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
