# SPEC.md — HugCode (Mobile-First Web IDE & Terminal)

> **Tài liệu đặc tả kỹ thuật dự án (Project Technical Specification)**  
> **Phiên bản:** 1.0.0  
> **Trạng thái:** Chờ phê duyệt (Pending Review)  
> **Tác giả:** Đội ngũ phát triển HugCode  
> **Tham chiếu Prototype:** [prototype.html](http://hugtech.buaanvuive.com/file/projects/hugcode/prototype.html)

---

## 1. TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)

### 1.1. Bối cảnh & Vấn đề
Các giải pháp Web IDE hiện nay như `code-server` (VS Code Web) hoạt động tốt trên desktop nhưng bộc lộ nhiều nhược điểm nghiêm trọng khi sử dụng trên điện thoại di động:
1. **Giao diện Desktop-first:** Bố cục thanh bên, thanh công cụ, status bar chiếm phần lớn diện tích màn hình điện thoại; các nút bấm quá nhỏ khó chạm chính xác bằng ngón tay.
2. **Xung đột bàn phím ảo:** Khi bàn phím điện thoại bật lên, màn hình bị co lại 50%, VS Code không có cơ chế tự thu gọn panel gây che khuất con trỏ soạn thảo hoặc terminal.
3. **Thiếu hàng phím điều hướng (Accessory Keys):** Shell CLI Linux và các công cụ TUI phụ thuộc nặng vào `Ctrl`, `Esc`, `Tab`, phím mũi tên `↑↓←→`, nhưng bàn phím di động mặc định không có các phím này.
4. **Monaco Editor quá nặng:** Bộ editor Monaco của VS Code (~5MB) thiết kế cho chuột/con trỏ desktop, gây giật lag và xử lý cảm ứng/vuốt cuộn kém trên mobile.

### 1.2. Mục tiêu dự án HugCode
Xây dựng một **Web IDE & Terminal thế hệ mới tối ưu 100% cho Mobile (Mobile-First PWA)**:
* Siêu nhẹ, khởi động tức thì, tối đa hóa diện tích hiển thị code và dòng lệnh trên màn hình nhỏ.
* Hỗ trợ Terminal chuẩn Linux PTY tương thích hoàn hảo với các ứng dụng TUI hiện đại như **Claude Code CLI (`claude`)**, `htop`, `vim`, `lazygit`.
* Nhập lệnh trực tiếp tại con trỏ Terminal (theo phong cách Code-Server), đi kèm thanh **Quick Touch Bar** có khả năng mở rộng đa hàng phím.
* Quản lý đa máy chủ (Multi-Server) nạp từ `~/.ssh/config`: Chuyển đổi linh hoạt giữa máy Local và các Remote SSH Servers mà vẫn **duy trì kết nối nền liên tục (Persistent Background Sessions)**.

---

## 2. KIẾN TRÚC HỆ THỐNG & TECH STACK

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CLIENT (Mobile Browser / PWA)                        │
│  ┌───────────────────────┐ ┌───────────────────┐ ┌──────────────────┐  │
│  │   Smart Unified Top   │ │   Files / Editor  │ │ Terminal Screen  │  │
│  │   (Server Selector)   │ │  (CodeMirror 6)   │ │   (@xterm/xterm) │  │
│  └───────────────────────┘ └───────────────────┘ └──────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Expandable Quick Touch Bar (ESC, TAB, Enter, ^C, Arrows, Ctrl)  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │     Compact Bottom Dock (Files • Terminal [Session Badge])       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────▲───────────────────────────────────┘
                                     │ HTTP/REST (Files/Config)
                                     │ WebSocket (Binary PTY Stream)
┌────────────────────────────────────▼───────────────────────────────────┐
│                     HUGCODE BACKEND (Docker Container)                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Fastify Web Framework (TypeScript) + Session Multiplexer       │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│           ┌────────────────────────┴────────────────────────┐          │
│           ▼                                                 ▼          │
│  ┌─────────────────┐                               ┌────────────────┐  │
│  │ Local PTY Pool  │                               │ SSH2 Pool      │  │
│  │ (node-pty Linux)│                               │ (Multi-Client) │  │
│  └────────┬────────┘                               └────────┬───────┘  │
└───────────┼─────────────────────────────────────────────────┼──────────┘
            ▼                                                 ▼
   [Local Host WSL2]                               [Remote SSH Servers]
   (Files & Local Bash)                            (103.145.2.10, AWS, Staging...)
```

### 2.1. Chi tiết Tech Stack
* **Backend:** **Node.js (TypeScript) + Fastify v4/v5**
  * Hiệu năng cao gấp 2 lần Express, hỗ trợ native WebSocket plugin `@fastify/websocket`.
  * `node-pty`: Tạo pseudo-terminal thật qua Linux system call `forkpty(3)`.
  * `ssh2`: Quản lý pool kết nối SSH client và kênh SFTP direct stream.
* **Frontend:** **Vue 3 (Composition API) + Vite + Tailwind CSS**
  * Bundle siêu nhẹ (< 150KB gzip), render phản hồi cảm ứng ngay lập tức.
* **Code Editor:** **CodeMirror 6**
  * Thiết kế module hóa, nhẹ hơn Monaco 5 lần, tối ưu cảm ứng và tự động wrap dòng trên mobile.
* **Terminal Emulator:** **`@xterm/xterm` (v5+) + `addon-fit`**
  * Render xterm Canvas/WebGL mượt mà, hỗ trợ 24-bit TrueColor, UTF-8 và Alternate Screen Buffer.
* **Bộ Icon:** **Remix Icon v4.6 (CDN)**
  * Chuẩn thiết kế lập trình tối giản, loại bỏ hoàn toàn emoji.
* **Đóng gói & Hạ tầng:**
  * Toàn bộ ứng dụng chạy trong **Docker & docker-compose**.
  * Chạy loopback nội bộ `127.0.0.1:8099`, kết nối an toàn ra ngoài qua **Cloudflare Tunnel (Zero Trust)**.

---

## 3. ĐẶC TẢ CHI TIẾT TÍNH NĂNG (FEATURE SPECIFICATIONS)

### 3.1. Giao diện Mobile-First & Tối ưu không gian màn hình
1. **Single Unified Smart Topbar (Chiều cao 40px):**
   * **Bên trái:** Nút **Quản lý Server** (`server-selector-btn`) hiển thị dạng Pill: `[🔵 hungpc ▾]` (Local) hoặc `[🟢 prod-vps-sg ▾]` (Remote SSH).
   * **Ở giữa (Động theo tab):**
     * Khi ở *Files*: Breadcrumb trượt ngang dẫn xuất thư mục (`hugcode / src / ...`).
     * Khi ở *Editor*: Tên file đang mở (`📄 server.js`) kèm chấm vàng `● Sửa` nếu có thay đổi.
     * Khi ở *Terminal*: Pill chọn nhanh cửa sổ terminal (`[💻 main-shell (1) ▾]`).
   * **Bên phải (Nút tác vụ động):**
     * Ở *Files*: Nút `+` (mở menu tạo file/folder).
     * Ở *Editor*: Nút `✏️ Sửa` / `👁️ Xem` (cho Markdown), nút `💾` (Lưu), nút `✕` (Đóng file quay về danh sách).
     * Ở *Terminal*: Nút `+` (thêm terminal window), nút `⋮` (menu tiện ích: clear, help, rename, close).
2. **Compact Bottom Dock (Chiều cao 42px + Safe Area):**
   * Chỉ giữ đúng **2 Tab chính**: `📁 Files` và `💻 Terminal` (có badge số session đang chạy).
   * Đã bỏ tab Editor thừa (mở file tự chuyển view) và bỏ icon phóng to toàn màn hình.
3. **Cơ chế chống tràn màn hình (Viewport Sync):**
   * Khóa `html, body` bằng `position: fixed; inset: 0;` để loại bỏ hoàn toàn hiện tượng trượt trang hoặc co giật khung nhìn.
   * Lắng nghe sự kiện `window.visualViewport` để co giãn `#app` chuẩn xác theo thời gian thực khi thanh địa chỉ trình duyệt hoặc bàn phím ảo bật lên/thu xuống.

---

### 3.2. Quản lý đa Server & Duy trì kết nối nền (Multi-Server & Session Persistence)
1. **Nguồn cấu hình máy chủ:**
   * Tự động nạp danh sách host từ file cấu hình SSH chuẩn `~/.ssh/config` cùng máy hiện tại (`hungpc`).
   * Hỗ trợ nút `+ Thêm SSH Host` trực tiếp trên UI (nhập HostName, IP, Port, User, IdentityKey).
2. **Cơ chế duy trì kết nối nền (Persistent Sessions):**
   * Mỗi server duy trì một trạng thái độc lập (`State Container`):
     * Trạng thái kết nối (`isConnected`).
     * Cây thư mục và vị trí đang đứng (`currentPathStack`).
     * Tệp tin và nội dung đang mở trong Editor (`activeOpenedFile`).
     * Danh sách các cửa sổ Terminal (`terminalSessions`), buffer log và tiến trình đang chạy.
   * **Khi chuyển đổi (Switch) server:**
     * Lưu trạng thái server cũ vào RAM/Cache.
     * Server cũ **vẫn giữ kết nối nền liên tục**, các tiến trình nền (build code, server daemon, TUI) tiếp tục chạy bình thường.
     * Nạp trạng thái của server mới ngay lập tức mà không phải tải lại trang.
3. **Bảng Quản lý Server (Modal Sheet):**
   * Hiển thị trạng thái rõ ràng:
     * `● Đang mở (Active)`: Máy chủ đang thao tác tiền cảnh.
     * `● Kết nối nền (Background)` *(chấm xanh nhấp nháy)*: Máy chủ SSH đang giữ phiên nền (kèm số terminal session và file đang mở).
     * `Chưa kết nối`: Các SSH host đang ở trạng thái chờ.
   * Nút thao tác: `Vào Server` và `Ngắt kết nối` (cho phép chủ động đóng phiên SSH khi không dùng).

---

### 3.3. Trình quản lý File & Soạn thảo Code (Files & Editor)
1. **File Explorer:**
   * Chạm ngón tay lớn (Touch targets >= 44px).
   * Breadcrumb trượt ngang cho phép nhảy nhanh về thư mục gốc hoặc các cấp cha.
   * Thao tác: Tạo file mới, tạo thư mục mới, đổi tên, xóa tệp tin.
   * Chạm vào bất kỳ file nào sẽ tự động mở thẳng vào màn hình Editor.
2. **Code Editor (CodeMirror 6):**
   * Đánh số dòng (line numbers), tự động ngắt dòng (word wrapping) chống tràn màn hình ngang.
   * Chấm vàng dirty indicator khi có sửa đổi chưa lưu.
   * Hàng phím phụ hỗ trợ lập trình: `Tab`, `Undo`, di chuyển con trỏ `◄`, `►`, các cặp ngoặc `{ }`, `( )`, `[ ]`, toán tử `=>`, `===`, từ khóa `const`, `function`, `return`...
3. **Chế độ xem trước Markdown (Markdown Preview):**
   * Khi mở file `.md` (ví dụ `README.md`), mặc định mở ngay chế độ **Xem trước (Preview)** chuẩn GitHub Typography.
   * Nút chuyển đổi trên header: Bấm `✏️ Sửa` để sửa code thô, bấm `👁️ Xem` để quay lại xem bản render Markdown.

---

### 3.4. Terminal Engine kiểu Code-Server & Hỗ trợ TUI (Claude CLI)
1. **Nhập lệnh trực tiếp tại con trỏ Terminal (In-Terminal Typing):**
   * **Loại bỏ hoàn toàn ô input riêng biệt dưới đáy.**
   * Con trỏ nhấp nháy `█` (`blinking block cursor`) nằm trực tiếp ngay sau prompt shell trong màn hình terminal.
   * Chạm vào bất kỳ đâu trên màn hình terminal: Bàn phím ảo mobile tự động bật lên.
   * Ký tự gõ từ bàn phím xuất hiện trực tiếp tại vị trí con trỏ trên dòng terminal.
   * Các phím mũi tên `◄` / `►` cho phép di chuyển con trỏ vào giữa các ký tự và chỉnh sửa trực tiếp.
2. **Hỗ trợ TUI tương tác thời gian thực (Full Interactive TUI):**
   * Tương thích 100% với **Claude Code CLI (`claude`)**, `htop`, `vim`, `nano`, `lazygit`.
   * Hỗ trợ cơ chế Alternate Screen Buffer: Khi ứng dụng TUI chạy, màn hình hiển thị toàn bộ giao diện tương tác; khi thoát ứng dụng (`/exit` hoặc `^C`), terminal khôi phục lại màn hình shell bash bình thường mà không làm hỏng lịch sử log.
3. **Thanh phím nhanh mở rộng (Expandable Touch Bar):**
   * **Nút Fixed mở rộng `[⌨️ ▲]` ở đầu thanh phím:** Chạm vào để mở rộng chiều cao thanh phím thành bảng phím đa hàng (`Drawer Panel`).
   * **Các phím cốt lõi ngay đầu thanh:** `[ESC]`, `[TAB]`, `[↵ Enter]`, `[^C]`, `[▲]`, `[▼]`, `[◄]`, `[►]`.
   * **Bảng mở rộng bao gồm:**
     * *Tổ hợp phím Ctrl (Bash / Linux):* `^C`, `^D`, `^Z`, `^L`, `^A`, `^E`, `^W`, `^U`, `^K`, `^R`.
     * *Phím điều hướng & chức năng:* `Home`, `End`, `PgUp`, `PgDn`, `Esc`, `Tab`, `Enter`.
     * *Ký tự Shell & Lập trình:* `|`, `>`, `>>`, `<`, `&&`, `||`, `&`, `;`, `:`, `~`, `/`, `\`, `-`, `_`, `$`, `*`, `"`, `'`, ``` ` ```, `{ }`, `( )`, `[ ]`.
     * *Lệnh nhanh 1 chạm (Quick Run):* `ls -la ↵`, `cd .. ↵`, `git status ↵`, `clear ↵`, `pwd ↵`, `node server.js ↵`.

---

## 4. ĐẶC TẢ GIAO THỨC & API (PROTOCOLS & APIS)

### 4.1. REST API (Quản lý File & Cấu hình)
* `GET /api/servers`: Lấy danh sách server (Local + parsed SSH hosts từ `~/.ssh/config`).
* `POST /api/servers`: Thêm một SSH host mới vào cấu hình.
* `GET /api/fs?serverId=...&path=...`: Liệt kê tệp tin/thư mục (Local fs hoặc SFTP).
* `GET /api/file?serverId=...&path=...`: Đọc nội dung tệp tin văn bản.
* `POST /api/file`: Lưu nội dung tệp tin (`{ serverId, path, content }`).
* `POST /api/fs/action`: Tạo file/folder, đổi tên, xóa tệp tin.

### 4.2. WebSocket Protocol (Terminal Bridge)
* Endpoint: `/ws/terminal?serverId=...&sessionId=...`
* Định dạng bản tin:
  * **Client -> Server:**
    * Nhập dữ liệu PTY: Chuỗi ký tự raw (`string` hoặc binary stream).
    * Điều khiển kích thước: `JSON.stringify({ type: 'resize', cols: 80, rows: 24 })`.
    * Ping keep-alive: `JSON.stringify({ type: 'ping' })`.
  * **Server -> Client:**
    * Output PTY: Chuỗi stream escape sequence (ANSI colors, cursor moves, TUI redraws).
    * Replay snapshot: Bản tin khôi phục buffer khi reconnect.

---

## 5. KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN (IMPLEMENTATION PHASES)

| Giai đoạn | Nội dung công việc | Kết quả bàn giao (Deliverables) |
|---|---|---|
| **Phase 1** | Khởi tạo cấu trúc dự án Docker, Backend Fastify, `node-pty` Local & `ssh2` Remote Bridge. | Backend Docker container chạy PTY shell ổn định. |
| **Phase 2** | Xây dựng Frontend Vue 3 + CodeMirror 6 + `@xterm/xterm` + Remix Icons. | Giao diện Web IDE chạy trực tiếp trên browser mobile. |
| **Phase 3** | Hiện thực cơ chế Server Manager & Duy trì kết nối nền (Session Persistence). | Chuyển đổi Local ↔ SSH VPS mượt mà, không mất phiên làm việc. |
| **Phase 4** | Kiểm thử với Claude Code CLI TUI, đóng gói PWA, test end-to-end trên mobile. | Bản phát hành hoàn chỉnh của HugCode sẵn sàng sử dụng. |

---

## 6. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

1. [x] Giao diện hiển thị đúng 100% theo bản prototype đã duyệt, không bị che khuất bởi thanh công cụ trình duyệt mobile.
2. [x] Không còn nút `← Files` hay nút source `⚡` thừa trên Topbar; nút Quản lý Server hoạt động trực quan.
3. [x] Nhập lệnh trực tiếp tại con trỏ trong màn hình Terminal mà không qua ô input phụ.
4. [x] Chạy thử lệnh `claude` hoặc các lệnh TUI tương tác mượt mà không vỡ layout.
5. [x] Chuyển đổi giữa các server giữ nguyên kết nối nền, buffer terminal và tệp tin đang mở.
6. [x] Ứng dụng chạy gọn gàng trong Docker, bảo mật loopback Zero Trust qua Cloudflare Tunnel.
