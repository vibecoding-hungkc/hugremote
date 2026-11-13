# 📋 Changelog — HugRemote

## [v1.6.19] - 2026-11-13

Khắc phục lỗi **Claude Code trên máy chủ SSH remote luôn khởi chạy ở thư mục home thay vì thư mục của Project**, khi mở Project hoặc tạo phiên Claude mới từ Project.

### Khắc phục lỗi

- **Nguyên nhân gốc (`claudeService.ts`):** lệnh remote được ghép dạng `(cd -- <project> 2>/dev/null || cd -- "$HOME") && claude ...`. Dấu ngoặc `( )` chạy `cd` trong subshell nên thay đổi thư mục bị mất ngay khi subshell kết thúc, `claude` luôn chạy ở home của user SSH.
- **Cách sửa:** đổi sang nhóm lệnh `{ cd -- <project> 2>/dev/null || cd -- "$HOME"; } && claude ...` chạy trong cùng shell. Áp dụng cho cả 4 điểm: chạy phiên chat, thăm dò cấu hình, thăm dò model và khởi chạy remote.
- **Kiểm chứng:** trên SSH server thật, cùng một request trước đó chạy ở `/home/devops`, sau khi sửa chạy ở `/home/devops/test-proj`.

### Test

- Thêm `scripts/test_claude_remote_cwd.ts` (`npm run test:claude-remote-cwd`): chạy đúng lệnh được sinh ra qua shell thật, kiểm tra đường dẫn `~/...`, đường dẫn có khoảng trắng, thư mục không tồn tại quay về home, và chặn việc quay lại dạng subshell.

---

## [v1.6.18] - 2026-11-13

Bản phát hành khắc phục triệt để lỗi **vỡ giao diện Terminal Claude Code CLI (UI corruption / text overlap / staircase artifacts)** khi chuyển đổi qua lại giữa các phiên terminal trên nhiều máy chủ khác nhau, giới thiệu cơ chế **Multi-Session Terminal Pooling** và đồng bộ kích thước PTY trước khi phát lại bộ đệm.

### Khắc phục lỗi & Cải tiến

- **Cơ chế Multi-Session Terminal Pooling (`TerminalView.vue`):**
  - Duy trì bộ nhớ đệm riêng biệt (`SessionTerminalInstance`) cho từng phiên terminal kết nối đến các máy chủ khác nhau.
  - Khi chuyển qua lại giữa các cửa sổ terminal hoặc giữa các máy chủ, không hủy (`dispose`) xterm instance và không ngắt kết nối WebSocket cũ. Thay vào đó, ẩn/hiện wrapper tương ứng (`display: none` / `display: block`).
  - Giữ nguyên vẹn 100% màn hình TUI phức tạp của Claude Code CLI (alternate screen buffer, cursor addressing, ANSI formatting), loại bỏ hoàn toàn việc phát lại (replay) đè dữ liệu hay lệch tọa độ con trỏ.
  - Khi kích hoạt lại phiên cũ, tự động gọi `fitAddon.fit()` và đồng bộ kích cỡ tức thì mà không cần độ trễ debounce.

- **Đồng bộ kích cỡ PTY trước khi phát lại đệm (`ws.ts`, `sessionManager.ts`):**
  - Khách hàng (client) tự động `fit()` ngay sau khi mở xterm để xác định chính xác số cột và dòng (`cols` x `rows`) thực tế trước khi gửi yêu cầu WebSocket.
  - Tuyến WebSocket phía backend tự động resize PTY theo đúng kích thước thực tế của client trước khi thực hiện `sessionManager.attach(...)` và phát lại `session.backend.buffer`, ngăn chặn triệt để hiện tượng ngắt dòng cứng tại 80 cột mặc định.

- **Nâng cấp dung lượng và độ an toàn của bộ đệm PTY (`localPty.ts`, `sshPool.ts`):**
  - Mở rộng dung lượng đệm lịch sử từ 100KB lên 500KB.
  - Cắt tỉa bộ đệm tại vị trí ký tự xuống dòng (`\n`) thay vì cắt ngẫu nhiên, bảo vệ toàn vẹn các chuỗi UTF-8 nhiều byte (tiếng Việt có dấu) và chuỗi escape sequence ANSI.

- **Khắc phục thứ tự chuyển phiên trong Sidebar (`WorkspaceSidebar.vue`):**
  - Chuyển `terminalStore.switchSession(session.id)` lên đầu tiên trong `handleSelectTerminal` trước khi đổi ngữ cảnh máy chủ/project, loại bỏ trạng thái trung gian không khớp giữa ID phiên và server ID.

- **Bổ sung bộ test hồi quy (`scripts/test_ui_terminal_multi_server_switch.mjs`):**
  - Kiểm thử tự động cơ chế pooling, toggle wrapper, PTY resize trước attach, bộ đệm an toàn, và luồng switch session trên sidebar.

---

Bản phát hành sửa lỗi triệt để **Chọn thư mục dạng cây (`FolderTreePicker.vue`, `FolderTreeNode.vue`)** và nâng cấp tính năng **Tệp / Quản lý File (`FileExplorer.vue`, `fileStore.ts`)** kèm bộ test E2E kiểm thử toàn diện edge cases cho Workspace.

### Khắc phục lỗi & Cải tiến

- **Sửa lỗi 'Đang mở đến thư mục đã chọn...' trong Chọn thư mục (`FolderTreePicker.vue`, `FolderTreeNode.vue`):**
  - Luôn truyền `fsScope=server` khi truy vấn `/api/fs` để cây thư mục luôn duyệt từ gốc workspace máy chủ, không bị bóp nghẹt bên trong thư mục của sub-project đang active.
  - Sửa lỗi tính `childFullPath`: trên remote SSH server, trước đây gán `entry.relPath` (ví dụ `acn-viper` hoặc `src`) khiến đường dẫn trả về bị cụt. Đã chuẩn hóa `joinPath(props.serverWorkspace || '~', entry.relPath)` cho cả local và SSH server.
  - Viết lại hàm `computeRelativeRemainder`: giải quyết hoàn toàn việc lệch tiền tố giữa `~` và `/home/<user>`, loại bỏ lỗi không mở rộng được thư mục đã chọn.
  - Thêm timeout bảo vệ 4.0 giây: đảm bảo `isNavigating` ("Đang mở đến thư mục đã chọn...") không bao giờ bị treo vĩnh viễn trên giao diện.

- **Nâng cấp Tính năng Tệp & Tự phục hồi lỗi (`FileExplorer.vue`, `fileStore.ts`, `serverStore.ts`):**
  - Tự động fallback về thư mục gốc `''` khi đường dẫn đã lưu bị xóa hoặc trả về 400/404, xóa sạch cache lỗi trong `localStorage`.
  - Thêm 2 nút hành động "Về thư mục gốc" và "Thử lại" trực tiếp trong khung báo lỗi để người dùng có thể tự phục hồi ngay trên UI.
  - Bảo vệ an toàn `serverStore.currentServer` bằng fallback mặc định và optional chaining `?.`, chống hoàn toàn lỗi `TypeError: Cannot read properties of undefined (reading 'workspace')`.

- **Mở rộng Bộ kiểm thử E2E & Edge Cases (`scripts/test_workspace_and_file_edge_cases.ts`):**
  - Bao phủ toàn diện các ca biên: phân rã tiền tố đường dẫn, ghép nối canonical path, deduplication project trùng lặp, xóa project ID dài (>100 ký tự) trên máy chủ SSH, quản trị project tại root `/`, và lưu trữ bền vững trạng thái Workspace.

---

## [v1.6.16] - 2026-11-12

Bản phát hành chuẩn hóa **Thanh cuộn toàn cục (Global Thin Scrollbar)** cho toàn bộ ứng dụng và tối ưu **Bộ đệm Resize Terminal (`TerminalView.vue`, `localPty.ts`, `sshPool.ts`)**.

### Khắc phục lỗi & Cải tiến

- **Tùy biến Thanh cuộn Toàn cục (Global Scrollbar Style):**
  - Khai báo chuẩn `scrollbar-width: thin` và `scrollbar-color: rgba(163, 163, 163, 0.4) transparent` trên toàn bộ cây DOM (`*`).
  - Tùy biến thanh cuộn WebKit mảnh 6px, bo viền capsule, đổi màu mượt mà khi hover/active, áp dụng nhất quán trên màn hình Cài đặt, File Explorer, Workspace Sidebar, Quick Panel, Git View và các Modal.
- **Tối ưu Terminal Resize & Chống Vỡ Giao diện TUI:**
  - Bổ sung bộ đệm hoãn 40ms (`resizeDebounceTimer`) khi container thay đổi kích thước, tránh phát dồn dập hàng chục tín hiệu `SIGWINCH` làm vỡ layout CLI/TUI khi mở đóng sidebar hoặc thay đổi khung hình.
  - Tường minh hóa các biến môi trường `LANG: 'en_US.UTF-8'` và `LC_ALL: 'en_US.UTF-8'` trong cả `localPty.ts` và `sshPool.ts`.

---

## [v1.6.15] - 2026-11-12

Bản phát hành nâng cấp toàn diện **Tiến trình cập nhật phiên bản (`SettingsView.vue`, `systemUpdateService.ts`, `isolated-update.js`)** và hoàn thiện **Quyền xóa project trên Workspace Sidebar**.

### Khắc phục lỗi & Cải tiến

- **Nâng cấp Tiến trình Cập nhật Phiên bản:**
  - Hiển thị tiến trình thời gian thực từng bước (tải mã nguồn, chuẩn bị, cài đặt thư viện/phụ thuộc, biên dịch ứng dụng, chuyển đổi phiên bản).
  - Bổ sung cơ chế Polling tự động mỗi 2.5 giây chống timeout khi đi qua Reverse Proxy/Cloudflare Tunnel.
  - Xử lý mượt mà khi cập nhật đồng thời (không còn bị quăng lỗi 500 khi bấm lại hoặc tải lại trang).
  - Tự động phát hiện và giải phóng khóa chết (`update.lock`) khi tiến trình trước bị hủy bất thường.
  - Tăng độ trễ khởi động lại dịch vụ lên 1.2s đảm bảo response HTTP được truyền trọn vẹn về trình duyệt.

- **Đồng bộ logic `isHomeProject` trên Workspace Sidebar:**
  - Chuẩn hóa kiểm tra `isHomeProject` trong `WorkspaceSidebar.vue` đồng bộ với `ProjectModal.vue`: chỉ duy nhất project `~` là Home, mọi project khác (kể cả trỏ vào workspace của user) đều hiển thị đầy đủ nút thùng rác `🗑️` để xóa bình thường.

---

## [v1.6.14] - 2026-11-11

Bản phát hành hoàn thiện **Hộp thoại Quản lý Project (`ProjectModal.vue`)**, khắc phục lỗi **Xóa Project có ID dài (`>100` ký tự)** và bổ sung **Lưu trữ trạng thái bền vững cho Workspace & Terminal Sessions** sau khi khởi động lại.

### Khắc phục lỗi & Cải tiến

- **Cải tiến Hộp thoại Quản lý Project (`ProjectModal.vue`, `FolderTreePicker.vue`):**
  - Loại bỏ nút `Workspace` gây tạo bản ghi project trùng lặp với thư mục Home của máy chủ từ xa.
  - Thay thế bằng 2 nút trực quan: **Thư mục Home** và **Chọn thư mục**, đồng thời bổ sung nút chọn thư mục ngay cạnh ô nhập đường dẫn.
  - Khi bấm **Chọn thư mục**, hệ thống mở cây thư mục (`FolderTreePicker`) cho phép duyệt và chọn bất kỳ thư mục nào trên máy chủ để mở làm Project ngay lập tức.
  - Chuẩn hóa điều kiện `isHomeProject`: chỉ duy nhất project `~` là Home Project, các project khác (kể cả project trỏ vào thư mục workspace được tạo trước đó) đều hiển thị đầy đủ nút xóa `🗑️` và có thể xóa bình thường.

- **Khắc phục lỗi Không xóa được Project có ID dài (`app.ts`):**
  - Nâng giới hạn `maxParamLength` của Fastify router từ `100` lên `500` ký tự, xử lý triệt để lỗi HTTP `414 (FST_ERR_MAX_PARAM_LENGTH)` khi xóa hoặc chọn các project trên máy chủ SSH có tên dài (kết hợp SHA-256 digest vượt quá 100 ký tự).

- **Lưu trữ bền vững trạng thái Workspace & Phiên làm việc sau khi khởi động lại (`projectService.ts`, `serverStore.ts`, `terminalStore.ts`, `WorkspaceSidebar.vue`):**
  - Lưu danh sách các máy chủ trong Workspace (`workspaceServerIds`) trực tiếp vào `~/.config/hugremote/projects.json` thông qua API `/api/projects/workspace-servers`, đồng bộ tự động khi khởi động lại ứng dụng hoặc mở trên trình duyệt mới.
  - Lưu trữ danh sách các phiên Terminal (`hugremote_terminal_sessions`) trong `localStorage` để giữ nguyên tên phiên, thư mục làm việc (`cwd`) và liên kết `projectId` sau khi khởi động lại, tự động kết nối lại PTY khi mở.
  - Tự động nạp danh sách project và phiên Claude/Terminal cho toàn bộ các máy chủ và project có trong Workspace ngay khi khởi động.

---

## [v1.6.13] - 2026-11-11

Bản phát hành khắc phục sự cố khi **Mở/Sửa đường dẫn Project thành Root (`/`)**, đảm bảo Project tại Root hiển thị nút xóa, có thể gỡ khỏi Workspace và cho phép khởi tạo đầy đủ phiên Terminal / Claude.

### Khắc phục lỗi & Cải tiến

- **Khắc phục lỗi Đặt tên & Xóa Project tại Root (`/`) (`projectService.ts`, `ProjectModal.vue`, `WorkspaceSidebar.vue`):**
  - Sửa hàm `basenameForProject`: khi mở đường dẫn root `'/'`, hệ thống đặt tên là `"root"` thay vì fallback nhầm thành `"~"`.
  - Chuẩn hóa điều kiện `isHomeProject`: chỉ thư mục thực sự là Home (`~` hoặc home directory của server) mới là Home Project. Project tại `'/'` là project thông thường, không bị coi là Home project, hiển thị đầy đủ nút xóa và cho phép xóa an toàn khỏi Workspace.
  - Tự động phát hiện và vá lỗi cho các bản ghi cũ trong `projects.json`: các project trỏ vào `'/'` nhưng mang tên `"~"` được tự động đổi tên thành `"root"` và mở khóa quyền xóa.
  - Bổ sung ô nhập đường dẫn thư mục trong form sửa project (`ProjectModal.vue`), cho phép sửa cả tên và đường dẫn.

- **Cho phép khởi tạo đầy đủ Terminal & Claude tại Project Root (`fsService.ts`, `claudeService.ts`, `WorkspaceSidebar.vue`):**
  - Cập nhật cơ chế kiểm tra `resolveLocalPath`: khi người dùng mở một project (bao gồm cả `/`), hệ thống cấp quyền truy cập hợp lệ trong phạm vi project đó mà không bị chặn bởi `ALLOWED_ROOT`.
  - Cập nhật `claudeService`: cho phép chạy phiên Claude với `cwd` thuộc project root đã được cấp quyền.
  - Đảm bảo `sessionsForProject` không làm mất đường dẫn khi `rootPath` là `'/'`.

---

## [v1.6.12] - 2026-11-11

Bản phát hành sửa lỗi và tăng cường độ tin cậy cho **Cây Workspace đa máy chủ** và **Quản lý Project**, bổ sung kiểm định E2E bao phủ các ca biên (edge cases).

### Khắc phục lỗi & Cải tiến

- **Chống trùng lặp Project khi mở lại trong Workspace (`projectService.ts`, `projectStore.ts`):**
  - Chuẩn hóa triệt để đường dẫn project: loại bỏ trailing slash (`/`), thu gọn duplicate slashes (`//`), quy đổi đường dẫn tương đối và tuyệt đối đồng nhất cả trên máy local lẫn remote SSH server.
  - Khi mở một thư mục đã nằm trong Workspace (từ thanh công cụ Tệp, Cây thư mục hoặc Hộp thoại Project): hệ thống tự động nhận diện và chuyển vùng làm việc (select) tới Project hiện có, tuyệt đối không tạo thêm bản ghi trùng lặp.
  - Tự động phát hiện và dọn dẹp các bản ghi project trùng lặp cũ khi khởi động hoặc tải cấu hình `projects.json`.
  - Trên màn hình Tệp (`FileExplorer.vue`): thư mục đã có trong Workspace hiển thị biểu tượng `ri-folder-shared-line` kèm chú thích "Chuyển tới dự án".

- **Xử lý Xóa Project an toàn và dọn dẹp phiên mồ côi (`WorkspaceSidebar.vue`, `projectStore.ts`, `api.ts`):**
  - Đồng bộ điều kiện Home Project giữa frontend và backend: bảo vệ tuyệt đối thư mục gốc (`~` hoặc home directory), ẩn nút xóa và từ chối xóa ở tầng backend với mã lỗi 400.
  - Khi xóa một project: tự động dọn dẹp và đóng an toàn các phiên Terminal và Claude thuộc project đó, tránh lỗi mồ côi PTY hoặc tiến trình nền.
  - Tự động chuyển giao vùng làm việc sang Home Project (`~`) khi project đang chọn bị xóa, đồng thời đồng bộ lại `localStorage` và danh sách project của server tương ứng.

- **Sửa lỗi Focus phiên đa máy chủ trên Workspace (`WorkspaceSidebar.vue`, `TerminalView.vue`, `claudeStore.ts`):**
  - Khắc phục lỗi tự động focus lại vào Terminal khi đang ở Terminal mà click vào phiên Claude trên máy chủ khác.
  - `WorkspaceSidebar.vue` chuyển tab (`emit('select-claude')`) ngay lập tức khi click phiên Claude, đưa Terminal về trạng thái inactive trước khi đồng bộ chuyển máy chủ và project.
  - Bổ sung chốt chặn `props.isActive === false` trong `focusTerminal()` và các bộ đếm thời gian của `TerminalView.vue`, ngăn chặn triệt để hành vi xterm cướp focus DOM khi tab Terminal đang ẩn.
  - Bảo toàn phiên Claude đang chọn trong `claudeStore.ensureProjectSession()`, không bị ghi đè bởi session ID cũ đã lưu.
  - Đồng bộ viền active trên Workspace chính xác theo tab và server đích: chỉ phiên Claude được highlight border, phiên Terminal không bị highlight nhầm.

- **Bộ kiểm thử tự động E2E & Edge Cases (`test_workspace_project_dedupe_and_delete.ts`, `test_ui_workspace_sidebar.mjs`):**
  - Bổ sung bộ test bao phủ toàn bộ các ca biên: mở project trùng với trailing slash / tilde / redundant slashes, xóa project đa máy chủ, cô lập dữ liệu giữa các server, và chuyển tab đa máy chủ không cướp focus.

---

## [v1.6.11] - 2026-11-10

Bản phát hành bổ sung tính năng **Làm việc đa máy chủ (Multi-Server Workspace)** trong cùng một cây Workspace, nâng cấp toàn diện **Giao diện Git 2 tab (Thay đổi hiện tại & Lịch sử Commit)** kèm thanh chia cột Resizable, tích hợp **Xác thực Đăng nhập OIDC Single Sign-On (SSO)**, tinh gọn thanh Header/Sidebar (cố định nút góc và thụt lề nội dung theo panel), chuẩn hóa thanh **Bottom Menu trên Mobile** (chỉ hiển thị icon và viền gradient 2px cạnh trên).

### Tính năng mới & Cải tiến

- **Làm việc đa máy chủ đồng thời trong Workspace Sidebar (`WorkspaceSidebar.vue`, `serverStore.ts`):**
  - Hỗ trợ thêm nhiều máy chủ vào cây Workspace đồng thời (`workspaceServerIds` lưu trong `localStorage`).
  - Phân cấp rõ ràng: Server ➔ Project ➔ Terminal sessions & Claude sessions.
  - Tinh gọn thanh tiêu đề Workspace: lược bỏ dòng nhãn `Servers` và nút `Quản lý`, chuyển nút thêm máy chủ `+` (`#btn-dw-add-server`) lên góc phải trên cùng cạnh nút đóng `×`.
  - Thay thế nhãn chữ `active` và các chấm tròn `dot` bằng đường viền `border` màu nhẹ nhàng, tinh tế theo từng loại mục (server xanh ngọc, project xanh da trời, terminal tím, claude cam).
  - Đồng bộ trạng thái active của session trên Workspace theo đúng tab Bottom Menu đang mở (khi ở Terminal chỉ active terminal, khi ở Claude chỉ active claude).

- **Đồng bộ Layout Header với Workspace & Folder Panels (`SmartHeader.vue`, `App.vue`):**
  - Cố định nút Workspace ở góc trái ngoài cùng (`left: 10px`) và nút Folder ở góc phải ngoài cùng (`right: 10px`) trên thanh Header.
  - Thụt lề nội dung hiển thị ngữ cảnh (`.smart-header-center` và `.smart-header-right`) theo đúng độ rộng thực tế của Workspace Sidebar (`--workspace-sidebar-width`) và bảng Folder (`--quick-panel-width`), giữ nội dung luôn thẳng hàng tuyệt đối với khung làm việc chính bên dưới.
  - Khắc phục lỗi nút Folder bị nhảy tọa độ dọc khi click chuột (loại bỏ phụ thuộc `translateY(-50%)` bị ghi đè bởi `:active scale`).
  - Lược bỏ icon limit usage khỏi header và ẩn icon Git nhanh trên màn hình mobile (`< 800px`).
  - Lược bỏ nhãn văn bản "Thư mục dự án" ở thanh tiêu đề sidebar folder (`QuickWorkspacePanel.vue`).

- **Chuẩn hóa Bottom Menu trên Mobile (`BottomDock.vue`):**
  - Trên mobile: ẩn toàn bộ nhãn chữ (`dock-label`), tăng kích thước icon lên `19px` cân đối đều cả 5 tab (`Tệp`, `Lệnh`, `Claude`, `Git`, `Cài đặt`).
  - Mục active của Bottom Menu tuân thủ nghiêm ngặt chỉ có một vạch gradient mảnh `2px` ở cạnh trên (`.dock-item.active::after`), không có màu nền hay viền hộp bao quanh.

- **Git View 2 Tab & Cột Resizable (`GitView.vue`, `gitService.ts`, `gitStore.ts`):**
  - Bổ sung tab **Lịch sử Commit** song song với tab **Thay đổi hiện tại**.
  - Xem danh sách commit theo thời gian, lọc commit theo từng tệp, xem chi tiết biến động tệp và diff của từng commit.
  - Hỗ trợ luồng mobile drill-down 3 bước mượt mà (Commit ➔ Danh sách tệp ➔ Chi tiết Diff).
  - Bổ sung 4 thanh kéo chia cột Desktop (`.git-col-resizer`) tùy chỉnh độ rộng cột linh hoạt.

- **Xác thực Đăng nhập OIDC Single Sign-On (SSO) (`oidcAuth.ts`, `oidcStore.ts`, `SettingsView.vue`, `AuthGate.vue`):**
  - Hỗ trợ Authorization Code Flow với PKCE (S256), chống CSRF bằng state token ký số.
  - Hỗ trợ chế độ `both` cho phép đăng nhập đồng thời cả Mật khẩu nội bộ và OIDC SSO.
  - Tự động nhận diện động Callback URL (`/auth/oidc/callback`) từ request origin khi chưa cấu hình `APP_URL`.
  - Màn hình Cài đặt hỗ trợ preset 1-click (Keycloak, Authentik, Okta, Microsoft Entra ID), kiểm tra issuer discovery và lưu cấu hình bảo mật `0600`.

---

## [v1.6.10] - 2026-11-08

Bản phát hành khắc phục triệt để các lỗi còn tồn đọng khi làm việc với **Remote SSH Server qua Jump Server (`ProxyJump` / `ProxyCommand`) trên bản cài macOS (`HugRemote.app` / `.dmg`)**, đồng thời tích hợp tùy chọn **Bảo mật 2 lớp · 2FA chuẩn TOTP 6 số** cho bản Web.

### Khắc phục lỗi & Cải tiến
- **Xử lý đa khóa (`Multi-Key`) và `Host Key Verification` cho Jump Server trên macOS (`sshPool.ts`):**
  - Tự động phát hiện và truyền tất cả các private key không mã hóa trong `~/.ssh/` (bao gồm cả các key đặt tên tùy chỉnh ngoài `id_rsa`/`id_ed25519`) cùng `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes` vào lệnh `ProxyCommand` của `ProxyJump`, ngăn lỗi `Host key verification failed` hoặc `Permission denied (publickey)` ở chặng Jump Server khi chạy trong tiến trình GUI `detached` không có `/dev/tty` trên macOS.
  - Nâng cấp `ssh2` (`getClient`) sử dụng `resolveUsablePrivateKeys()` và mảng `authHandler` để thử lần lượt toàn bộ các private key hợp lệ trong `~/.ssh/` thay vì chỉ thử 1 key đầu tiên, đồng thời hỗ trợ `IdentityAgent` (1Password, OrbStack) và tự động nạp key từ Apple Keychain (`ssh-add --apple-load-keychain`).
  - Bật OpenSSH Connection Multiplexing (`ControlMaster=auto`, `ControlPath=/tmp/hugremote-ssh-%C`, `ControlPersist=10m`) và đặt cờ tùy chọn trước tên host trong `buildNativeSshArgs()`.
  - Đảm bảo `spawnNativeSshExec` phát hết dữ liệu `stdout`/`stderr` trước khi phát sự kiện `exit`/`close`.
- **Chống rò rỉ đường dẫn `/Users/<mac_user>` sang Remote Linux Server (`config.ts`, `fsService.ts`, `gitService.ts`, `claudeService.ts`, `ServerModal.vue`):**
  - Bổ sung `sanitizeRemoteWorkspacePath()` tự động chuyển các đường dẫn `/Users/...` của máy Mac local về thư mục home trên máy chủ Linux từ xa, bảo toàn `ProxyJump`/`ProxyCommand` khi lưu cấu hình Server, và hỗ trợ nhập trực tiếp `ProxyJump` trong `ServerModal.vue`.
- **Tích hợp Bảo mật 2 lớp · 2FA tùy chọn Bật/Tắt cho bản Web (`twoFactorStore.ts`, `qrSvg.ts`, `SettingsView.vue`, `AuthGate.vue`):**
  - Hỗ trợ xác thực 2FA chuẩn TOTP 6 số (RFC 6238) kèm Mã QR SVG và 8 mã khôi phục dự phòng dùng một lần.

---

## [v1.6.9] - 2026-11-07

Bản phát hành đồng bộ **Icon ứng dụng macOS (`HugRemote.app` / `.dmg`) giống hệt Favicon của bản Web** (`favicon.svg`) và khắc phục triệt để lỗi **`connect ECONNREFUSED` (`Connection refused`) khi làm việc với Remote SSH Server** (đặc biệt các server kết nối qua `ProxyJump`, `ProxyCommand`, SSH Reverse Tunnel `127.0.0.1:<port>`, hoặc khai báo trong file `Include`).

### Đồng bộ Icon macOS giống Favicon Web (`desktop/icon.icns`, `desktop/icon.png`)
- Chuyển đổi trực tiếp `apps/api/public/favicon.svg` thành bộ icon chuẩn Apple ICNS đa độ phân giải (`32×32` đến `1024×1024`, đầy đủ các chunk `ic07`..`ic14`) tại `desktop/icon.icns` và `desktop/icon.png` (`512×512`).
- Cấu hình `makePackagerOptions` trong `desktop/packager-options.mjs`, `scripts/build_macos_app.mjs` và `desktop/main.cjs` (`BrowserWindow` icon + `app.dock.setIcon`) để ứng dụng macOS trên Finder, Launchpad, Applications và thanh Dock hiển thị đúng biểu tượng của HugRemote.

### Khắc phục triệt để lỗi `Connect Refused` khi làm việc với Remote SSH Server trên macOS
- **Hỗ trợ `ProxyJump` & `ProxyCommand` xuyên suốt (`config.ts`, `sshPool.ts`):**
  - `parseSshConfig()` đọc đầy đủ `ProxyJump` và `ProxyCommand`, hỗ trợ nhiều alias trên cùng một dòng `Host`, đóng block khi gặp `Match` (tránh ghi đè nhầm `Port`/`HostName`), kế thừa `Host *` theo chuẩn first-match wins của OpenSSH và kiểm tra alias trên toàn bộ cây file `Include` (`hasSshHostAlias`).
  - Khi kết nối tới server có `ProxyJump` (như `HostName 127.0.0.1` + `Port 2225` qua jump host) hoặc `ProxyCommand`, `sshPool.getClient()` tự động tạo luồng `sock: Duplex` qua tiến trình `ssh -W '[%h]:%p'` / `ProxyCommand` thay vì kết nối TCP trực tiếp vào `127.0.0.1` của máy Mac.
  - Chuẩn hóa `buildProxyCommandFromJump()` để bóc tách định dạng `user@[host]:port` do `ssh -G` sinh ra và nạp đầy đủ `PATH` của macOS (`/opt/homebrew/bin`, `/opt/homebrew/sbin`, `/usr/local/bin`, `~/.local/bin`, `~/.orbstack/bin`, login shell `PATH`).
- **Fallback tự động qua `/usr/bin/ssh` cho toàn bộ thao tác File Remote (`fsService.ts`, `api.ts`, `tempZipService.ts`):**
  - Khi kết nối SFTP trực tiếp qua `ssh2` không khả dụng, toàn bộ thao tác trên màn hình **Files**, **Folder Sidebar**, **Code Editor**, **FolderTreePicker** và **Upload/Download** (`listRemote`, `readRemoteFile`, `writeRemoteFile`, `createRemote`, `deleteRemote`, `renameRemote`, `statRemote`, `readRemoteBuffer`, `writeRemoteStream`, `createRemoteZip`) tự động thực thi qua `sshPool.runRemoteCommand()` (`/usr/bin/ssh <alias>`).
- **Bảo toàn đường dẫn `~` trên Remote Server (`projectService.ts`, `config.ts`):**
  - Không mở rộng `~` của Remote Linux Server thành `os.homedir()` (`/Users/<user>`) của máy Mac khi mở Home Project hoặc lưu Workspace.

---

## [v1.6.8] - 2026-11-07

Bản phát hành bổ sung màn hình **Cài đặt** ở thanh điều hướng dưới (chỉ hiển thị icon), tính năng **Kiểm tra & Cập nhật phiên bản nhanh** ngay trong Cài đặt, hệ thống **Phím tắt chuyển nhanh dùng chung** kèm **Thin Index**, **Folder Sidebar toàn cục** ở mọi màn hình (có Upload tệp/thư mục, Download tệp/ZIP và chế độ **Toàn màn hình**), **Giao diện Git 2 cột mới**, gói cài đặt **macOS `.dmg` tùy chọn** và khắc phục triệt để kết nối WebSocket với **SSH Server trên macOS**.

### Màn hình Cài đặt, Ngôn ngữ & Cập nhật Phiên bản nhanh
- Bổ sung tab **Cài đặt** (`#dock-item-settings`) chỉ hiển thị icon bánh răng (`ri-settings-3-line`) trên thanh điều hướng dưới (`BottomDock.vue`).
- Đưa bộ chọn **Ngôn ngữ giao diện** (`#settings-language-card`: `Tiếng Việt` / `English`) từ thanh Top Menu vào trong màn hình Cài đặt.
- Bổ sung khối **Phiên bản & Cập nhật** (`#settings-version-card`) kèm API `GET /api/system/version` và `POST /api/system/update`:
  - Kiểm tra phiên bản trực tiếp từ GitHub theo kênh **Stable** hoặc **Beta**, hiển thị trạng thái có bản cập nhật mới (`#version-status-badge`) và thông tin commit/tag.
  - Nút **Cập nhật ngay** (`#btn-quick-update`) kích hoạt `installIsolatedRelease` an toàn (hoặc cập nhật từ nhánh Git) và tự động khởi động lại dịch vụ nền sau khi hoàn tất.

### Phím tắt chuyển nhanh dùng chung & Thin Index (`Alt+K`)
- Bổ sung khối **Cài đặt phím tắt dùng chung** (`#settings-shortcut-card`, `shortcutStore.ts`): thiết lập tổ hợp phím chung kết hợp với số thứ tự `1..9` cho **Chuyển Project** (`Alt + 1..9`), **Chuyển Phiên Claude** (`Alt+Shift + 1..9`), **Chuyển Phiên Terminal** (`Ctrl+Alt + 1..9`), **Chuyển Server** (`Ctrl+Shift + 1..9`) và phím **Ẩn/Hiện nhãn phím tắt** (`Alt+K`), hỗ trợ chọn preset hoặc thu phím trực tiếp.
- Hiển thị **thin index** mảnh (`1, 2, 3...`, `.dw-idx-badge`) cạnh từng Project, Terminal session và Claude session trong `WorkspaceSidebar.vue`; mặc định ẩn nhãn phím tắt (`.dw-kbd-tag`) để giao diện thoáng và bật/tắt tức thì bằng `Alt+K`.

### Folder Sidebar toàn cục, Upload/Download & Chế độ Toàn màn hình
- Đưa nút đóng/mở **Folder Sidebar** và **Workspace Sidebar** lên thanh Header (`SmartHeader.vue`) ở tất cả 6 màn hình (`Files`, `Editor`, `Terminal`, `Claude`, `Git`, `Cài đặt`).
- Bổ sung thanh công cụ **Tải tệp** (`#quick-tree-upload-files`), **Tải thư mục** (`#quick-tree-upload-folder`), **Tải về ZIP** (`#quick-tree-download-zip`), các nút tải lên/tải xuống trên từng dòng cây thư mục và nút tải tệp đang mở (`#quick-file-download`) ngay trong `QuickWorkspacePanel.vue`.
- Bổ sung chế độ **Toàn màn hình** (`#quick-tree-fullscreen` và `#quick-file-fullscreen`) cho phép mở rộng bảng Xem nhanh thư mục và khung xem/sửa tệp inline phủ `100%` chiều ngang màn hình.

### Giao diện Git 2 cột mới (`GitView.vue`)
- Nâng cấp màn hình Git sang bố cục lưới 2 cột (`.git-main-grid`): banner tổng quan đầu trang (`.git-scanner-banner`), cột trái danh sách thẻ repository (`.git-repos-column`), cột phải chi tiết repository (`.git-Active-detail-column`) chia đôi song song giữa **Tệp thay đổi + Thanh Commit** (`.git-files-box`) và **Xem nhanh Diff** (`.git-diff-box`, tự động nạp Diff của tệp đầu tiên).
- Giữ luồng điều hướng danh sách ↔ chi tiết mượt trên Mobile & Tablet (`<=860px`) kèm nút quay lại `Danh sách repo`.

### Bộ cài macOS `.dmg` tùy chọn & Kết nối WebSocket với SSH Server trên macOS
- Đóng gói ứng dụng desktop macOS tùy chọn (`desktop/`, `scripts/build_macos_app.mjs`, `.github/workflows/macos-app.yml`) thành bộ cài `HugRemote-macOS-arm64.dmg` và `HugRemote-macOS-x64.dmg` kèm ký ad-hoc đệ quy toàn bộ Mach-O binaries (`codesign --verify --deep --strict`).
- Khắc phục triệt để lỗi kết nối WebSocket khi làm việc với SSH Server trên macOS:
  - Khởi tạo `terminalStore.ensureServerSession()` ngay đầu `handleScopeChanged()` (`App.vue`) trước mọi lời gọi mạng SFTP/HTTP và tách biệt việc đóng socket khi chuyển phiên khỏi trạng thái mất mạng thật (`TerminalView.vue`).
  - Trong `sshPool.ts` và `ws.ts`: deduplicate các kết nối SSH đồng thời, tự động dò `SSH_AUTH_SOCK` (kể cả qua `launchctl getenv SSH_AUTH_SOCK` trên macOS GUI app), đọc default SSH keys an toàn (bỏ qua key mã hóa passphrase không có passphrase), đệm hàng đợi bản tin WebSocket trong lúc bắt tay SSH, và tự động fallback sang tiến trình `/usr/bin/ssh` hệ thống (`node-pty` / `child_process.spawn`) khi `ssh2` không kết nối trực tiếp được.

### Kiểm chứng
- PASS toàn bộ bộ kiểm thử: `scripts/test_ssh_ws_and_system_update.ts`, `scripts/test_ui_shortcuts_and_universal_folder.mjs`, `scripts/test_ui_git_mobile_list_details.mjs`, `scripts/test_ui_prototype_shortcuts.mjs`, `scripts/test_desktop_macos_installer.mjs`, `npm run test:ui` và cổng kiểm tra bảo mật release.

---

## [v1.6.7] - 2026-11-05

Bản phát hành bổ sung hỗ trợ đệ quy chỉ thị `Include` trong `~/.ssh/config`, tách biệt tab Files theo phạm vi Server Workspace độc lập với Project đang mở, nâng cấp luồng Git responsive trên Mobile/Tablet (`<=860px`), bổ sung cây thư mục Workspace có thanh kéo đổi kích thước, nhập liệu giọng nói tiếng Việt và đồng bộ tên phiên Claude CLI.

### SSH Config `Include` & Quản lý Server
- Mở rộng đệ quy chỉ thị `Include` trong `parseSshConfig()` theo chuẩn OpenSSH: hỗ trợ đường dẫn tương đối theo `~/.ssh`, `~/`, đường dẫn tuyệt đối, glob wildcard (`*`, `?`, `[...]`), nhiều mẫu đường dẫn trên cùng một dòng và cú pháp `Key=Value`.
- Chống vòng lặp `Include` đệ quy bằng `realpathSync` kèm giới hạn độ sâu an toàn, áp dụng quy tắc first-match của OpenSSH và bảo toàn trạng thái khối `Host` bao ngoài khi đọc file con.
- Cập nhật trực tiếp tại file cấu hình được include khi chỉnh sửa thông tin server (`POST /api/servers`) hoặc đổi đường dẫn `Workspace` (`POST /api/servers/workspace`).

### Tab Files độc lập theo Server Workspace (`fsScope=server`)
- Tách tab Files ở thanh điều hướng dưới khỏi Project đang chọn: luôn duyệt từ `workspace` của server hiện tại thông qua tham số `fsScope=server` trên toàn bộ `/api/fs`, `/api/fs/read`, `/api/fs/save`, `/api/fs/action`, `/api/fs/download`, `/api/fs/upload`.
- Lưu và khôi phục thư mục đang mở theo từng cặp `[serverId, workspace]` trong `localStorage` (`hugremote_file_dirs_by_server`) khi chuyển tab, đổi Project, đổi Server hoặc tải lại trang; tự động quay về gốc `''` khi thư mục đã nhớ không còn tồn tại.
- Ràng buộc chặt phạm vi đường dẫn (`strictWorkspace`) trong `fsService.resolveLocalPath`, chặn thoát khỏi `server.workspace` kể cả qua symlink trỏ sang thư mục ngang hàng.

### Giao diện Git Mobile/Tablet & Đa Repository
- Hỗ trợ quét đa repository trong dự án (tối đa 5 cấp, bỏ qua `node_modules`) kèm lọc nhanh `Tất cả` / `Có thay đổi`.
- Trên màn hình Mobile & Tablet (`<=860px`): hiển thị danh sách repo thu gọn trước, chạm vào repo để mở màn chi tiết thay đổi (giữ nguyên danh sách file, nhãn trạng thái, `staged`/`unstaged`, bộ đếm `+ / -`) kèm nút quay lại `Danh sách repo`; giữ nguyên bố cục hai cột trên Desktop (`>=861px`).

### Workspace Sidebar, Claude CLI & Trải nghiệm nhập liệu
- Bổ sung thanh bên Workspace có thể kéo đổi kích thước (resizable) với hai đường dẫn cấp cây thư mục, giữ màu ngữ nghĩa cho icon Project, Terminal (`#c084fc`), Folder (`#38bdf8`) và viền chuyển sắc (gradient border) trên màn Claude.
- Bổ sung nút nhập liệu giọng nói tiếng Việt (Web Speech API) trên khung chat Claude, giữ nguyên bản nháp khi xác nhận bộ gõ tiếng Việt (IME), đồng bộ tên phiên qua cờ `--name` của Claude CLI và hiển thị trạng thái đang chạy kèm nút dừng.
- Băm toàn bộ `rootPath` bằng SHA-256 khi sinh Project ID (tránh trùng lặp tên thư mục) và kiểm tra trước `systemctl` khi cập nhật trên môi trường CLI độc lập không dùng systemd.

### Kiểm chứng
- PASS toàn bộ bộ kiểm thử: `scripts/test_ssh_config_include.ts`, `scripts/test_fs_server_scope.ts`, `scripts/test_file_tab_server_scope.mjs` (8 PASS), `scripts/test_ui_git_mobile_list_details.mjs` (4 PASS), và toàn bộ `npm run test:ui`.

---

## [v1.6.6] - 2026-11-04

Bản phát hành chuẩn hóa hệ màu Monochrome (Đen - Trắng - Xám) trên toàn bộ 29 màn hình/component của HugRemote kèm bảo toàn màu ngữ nghĩa (icon tệp/thư mục, tín hiệu Git diff, nút xóa/cảnh báo, viền màu nhấn cho dropdown trên Header), đồng thời nâng cấp trải nghiệm làm việc trên Desktop và chế độ Preview mặc định cho tệp văn bản.

### Giao diện Monochrome & Màu ngữ nghĩa
- Chuẩn hóa toàn bộ khung giao diện (chrome) sang thang màu đen, trắng và xám trung tính trên 29 component Vue và `prototype.html`.
- Giữ màu ngữ nghĩa rõ ràng cho các icon thư mục (`ri-folder-2-line` màu vàng `#f59e0b`), icon tệp theo định dạng, các nút xóa/nguy hiểm và badge trạng thái.
- Giữ màu phân biệt trực quan trên màn Git (`GitView.vue` và quick Git): trạng thái tệp (`M`, `A`, `D`, `U`), chỉ số dòng `+` (`#34d399`) / `-` (`#fb7185`), dòng diff thêm/xóa và nhánh đang chọn.
- Bổ sung viền màu nhấn (accent border) cho các nút mở dropdown và menu dropdown trên `SmartHeader.vue` để dễ nhận diện trên nền tối.
- Đồng bộ icon thư mục `ri-folder-2-line` ở màn File và thu gọn nút tải ZIP thành nút icon download (`ri-download-2-line` `30×30`), giữ nguyên luồng tải ZIP và nhãn trợ năng (`title`, `aria-label`).

### Trải nghiệm Workspace, Bàn phím Desktop & Preview
- Khắc phục triệt để phím vật lý `Esc`, `Ctrl+C`/`Cmd+C`, `Ctrl+V`/`Cmd+V` trên Desktop tại màn Terminal (`xterm.js`), Claude, Code Editor và Quick Workspace Panel:
  - Bổ sung `attachCustomKeyEventHandler` và listener toàn cục (`keydown` / `paste`) cho `TerminalView.vue` để `Esc` luôn gửi `\x1b`, `Ctrl+C` tự động copy văn bản đang bôi đen (hoặc gửi `\x03` SIGINT khi không có vùng chọn), và `Ctrl+V`/`Cmd+V` dán trực tiếp clipboard qua `term.paste()` thay vì gửi ký tự điều khiển `^V` (`\x16`), kể cả khi `.xterm-helper-textarea` chưa được focus sau khi chuyển tab/phiên.
  - Hỗ trợ `Esc` (đóng popup hoặc hủy tiến trình đang chạy), `Ctrl+C` và `Ctrl+V` trên màn Claude và tự động focus lại khung nhập khi chuyển sang chế độ Edit ở `CodeEditor.vue` / `QuickWorkspacePanel.vue`.
- Mở mọi tệp văn bản ở chế độ Preview chỉ đọc mặc định trong màn File và Quick Workspace Panel, kèm nút chuyển nhanh sang Edit.
- Ẩn thanh phím nhanh ảo theo thiết bị Desktop (`useDesktopDevice()`) thay vì chỉ dựa vào kích thước viewport, và căn chỉnh liền mạch Quick Workspace Panel / Sidebar với Header (`64px`) và Bottom Dock (`42px`).

### Bảo mật & Kiểm chứng
- Nâng cấp transitive dependencies (`glob@^14.0.3`, `minimatch@^11.0.4`) đưa `npm audit` về 0 lỗ hổng bảo mật ở mọi mức độ.
- PASS toàn bộ bộ kiểm thử UI, Claude stream/resume, Git remote, atomic updater và cổng kiểm tra bảo mật HTTP/CSP.

---

## [v1.6.0] - 2026-10-28

Bản phát hành nâng cấp toàn diện Claude Protocol Parity theo quy chuẩn Claude Code CLI / Extension 2.1.308, hoàn thiện interactive controls duplex, stream/reconnect replay buffer, child-agent namespaces, và tăng cường bảo mật HTTP CSP.

### Claude Protocol Parity (M0–M7)
- Chuẩn hóa toàn bộ schema sự kiện theo `schemaVersion: 1` dựa trên oracle artifacts VSIX và CLI `2.1.308`.
- Bộ phân tích `eventNormalizer` và `runAssembler` hỗ trợ đầy đủ các họ delta (`text_delta`, `thinking_delta`, `input_json_delta`), deduplication snapshot và message identity.
- Unknown native events sinh bounded diagnostic có giới hạn thay vì crash hoặc drop thầm lặng.
- Quản lý vòng đời tool hoàn chỉnh (`receiving-input`, `running`, `done`, `cancelled`, `error`) kèm structured output.
- Hỗ trợ child agents độc lập thông qua namespace `parent_tool_use_id`, tách biệt luồng subagent khỏi root transcript.

### Duplex Controls & Interactive Transport (M4–M5)
- Tích hợp transport hai chiều qua SDK stream-json, điều khiển quy trình qua child process stdin.
- Hỗ trợ đầy đủ các yêu cầu tương tác `can_use_tool` (permission) và `request_user_dialog`, chống double-submit và hỗ trợ cancellation.

### Sequenced Replay & Stream Migration (M6)
- `ClaudeReplayBuffer` với chuỗi số monotonic sequence, cho phép client khôi phục luồng sự kiện qua `?after=N`.
- Cơ chế fallback về snapshot canonical an toàn khi client bị mất kết nối quá thời hạn đệm.
- Idempotent migration helper nâng cấp các phiên lưu trữ từ `v1.5.3` lên `v1.6.0`.

### Tinh chỉnh UI & Trải nghiệm (M7 & Bugfixes)
- Chỉ hiển thị một thinking indicator duy nhất trong chế độ bình thường.
- Tinh chỉnh Context Window pill hiển thị dạng gọn current/max (vd: `27.2k / 1M`) mà vẫn giữ quota 5 giờ/tuần và percentage native.
- Tự động cuộn theo dõi tiến độ phản hồi trực tiếp (`useClaudeAutoScroll`).
- Giải phóng trạng thái Stop đúng lúc khi nhận terminal result từ backend.

### Tăng cường bảo mật (Security Hardening)
- Thiết lập Content Security Policy (CSP) chặt chẽ (`default-src 'self'`, `script-src 'self'`, không có `unsafe-eval` hay script inline).
- Thay thế cơ chế inject inline script toàn cục bằng thẻ meta `<meta name="hugremote-base-path">`.
- Chặn toàn diện các probe nhạy cảm và công cụ dev (`/.env`, `/@vite/`, `/@fs/`, `/package.json`, v.v.), trả về 404 JSON fail-closed.
- Nâng cấp `fastify` và `fast-uri`, đưa `npm audit` về 0 lỗ hổng bảo mật.

### Kiểm chứng
- PASS full regression suite: protocol core, fuzz, differential (43 fixtures), duplex spike, replay migration, security headers, streaming, models, context, git, và UI.
- PASS `npm audit`: 0 vulnerabilities (kể cả low/moderate).
- PASS live HTTP posture and leakage scanners trên runtime `http://127.0.0.1:8099`.

---

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
