---
type: aggregated
artifact_kind: prd
status: RENDERED
tier: T0
last_rendered: "2026-11-21"
rendered_by: "Claude Code — soạn từ phân tích HugRemote v1.6.20"
---

# PRD — HugRemote (bản phát triển lại, thân thiện hơn)

> **Bối cảnh.** HugRemote v1.x (v1.0.0 → v1.6.20) đã chạy thật và được dùng hằng ngày. Bản PRD này mô tả
> sản phẩm cho lần phát triển lại, dựa trên năng lực, điểm đau và bài học của v1.x. Sau khi
> `/viper-validate` dịch sang `context/`, file này đóng băng (intake/README.md luật 3).

## 1. Problem statement

Lập trình viên làm việc với Claude Code và nhiều máy chủ SSH cần **điều khiển máy làm việc từ điện
thoại, tablet hoặc máy khác**: mở terminal thật, xem và sửa file, theo dõi Git, và nhất là giao việc
rồi duyệt quyền cho Claude Code khi không ngồi trước máy. Các Web IDE hiện có (code-server / VS Code
Web) thiết kế desktop-first: nút quá nhỏ để chạm, bàn phím ảo che terminal, thiếu phím `Ctrl/Esc/Tab/mũi
tên`, Monaco nặng và cuộn kém trên di động.

HugRemote v1.x đã giải được phần kỹ thuật — PTY thật, SSH qua `~/.ssh/config` (Include, ProxyJump),
Claude CLI chạy nền có stream và nối lại, Git đa repo, cài một lệnh, tự cập nhật. Nhưng sau 288 commit
trong 5 tuần, **trải nghiệm người dùng trở nên rối**:

- **Bảy bề mặt điều hướng chồng nhau**: header 2 hàng (ngăn kéo chọn máy + hộp chọn dự án), nút phiên mở
  bảng phiên, cây thanh bên trái, ô tìm kiếm nhanh, thanh dock dưới, panel nhanh bên phải, và breadcrumb
  Files lặp ở cả header lẫn thanh công cụ. Chọn server có 4 lối, chọn project 4 lối, tạo phiên 3 lối.
- **Hai phạm vi file khác nhau**: tab Files đi theo workspace của server, còn panel nhanh, Git và các
  phiên đi theo project — project trên header không quyết định Files đang hiện gì.
- **Tính năng làm hai lần**: hai editor (CodeMirror và textarea tự vẽ gutter), hai giao diện Git, ba bộ
  render Markdown, bypass-permissions đặt được ở 3 chỗ, model/effort ở 2 chỗ.
- **Khái niệm nội bộ lộ ra người dùng**: hub Claude tách "phiên HugRemote" và "phiên Claude CLI";
  phiên terminal chỉ sống trong localStorage của một trình duyệt còn phiên Claude sống trên server.
- **Điều khiển ẩn / thiếu**: badge mode bấm để xoay vòng 4 chế độ, `/clear` trên mobile xoá hội thoại
  không hỏi, **không có nút Đăng xuất**, server thêm vào rồi không sửa/xoá được.
- **Không có design system**: không token nào được khai báo, ~12 bán kính bo góc, ~25 cỡ chữ, z-index
  tuỳ hứng, terminal dùng bảng màu xanh slate lệch với phần còn lại; i18n vi/en chỉ phủ một phần
  (Settings, Git gần như chỉ tiếng Việt).
- **Nợ bảo mật**: `POST /api/auth/oidc/config` công khai, ai cũng ghi đè được nhà cung cấp danh tính;
  `GET /api/servers` trả mật khẩu SSH dạng rõ; mọi kết nối SSH tắt kiểm host key; phiên đăng nhập chỉ trong RAM.

Status quo: chủ sản phẩm (người dùng chính) vẫn dùng bản cũ hằng ngày qua Cloudflare Tunnel, nhưng mỗi
tính năng mới lại thêm một lối điều hướng và một lớp vá ca biên (scope, đường dẫn remote, resize
terminal). Không làm lại thì chi phí thêm tính năng và chi phí "tìm xem mình đang ở đâu" tiếp tục tăng;
lỗ hổng OIDC là rủi ro chiếm shell từ xa.

**Mục tiêu bản mới**: **viết lại toàn bộ** trên stack NestJS + React (Vite) + SQLite (Authority chốt
2026-11-21, `intake/TECHSTACK.md`), giữ nguyên năng lực kỹ thuật và các quyết định ở tầng năng lực đã được
kiểm chứng của v1.x (PTY, SSH, giao thức Claude CLI, phân phối tự host), **làm lại mô hình điều hướng, mô
hình khái niệm và giao diện** cho thân thiện — một cách đi tới mỗi thứ, một phạm vi rõ ràng, design system
nhất quán — và đóng các lỗ hổng bảo mật đã biết.

## 2. Target users (personas)

## P-MOBILE — Lập trình viên điều khiển từ điện thoại

| Field | Value |
|---|---|
| Role | Lập trình viên solo dùng Claude Code hằng ngày, cần giao việc và theo dõi máy làm việc khi đang di chuyển |
| Goals | • Mở đúng phiên Claude của đúng dự án trong vài chạm • Duyệt/từ chối yêu cầu quyền của Claude ngay trên điện thoại • Xem nhanh file và thay đổi Git mà Claude vừa làm • Gõ lệnh terminal có phím Ctrl/Esc/Tab/mũi tên |
| Pains | • Không biết mình đang ở server/project nào, mỗi màn hình một lối điều hướng • Header 2 hàng + dock chiếm nhiều chỗ trên màn hình nhỏ • Bàn phím ảo che terminal • Phiên terminal mở trên máy tính không thấy trên điện thoại |
| Workflow today | Mở HugRemote v1.x qua Cloudflare Tunnel trên Safari/Chrome mobile hoặc PWA; dùng tab Claude và Terminal là chính, nhập bằng tiếng Việt (Telex/VNI) hoặc giọng nói |
| Platforms | web mobile (iOS Safari PWA, Android Chrome), màn 360–430px |
| Anti-persona (NOT this) | Không phải người cần IDE đầy đủ trên điện thoại (debugger, extension, refactor đa file) |
| Active in waves | W1–W4 (Phase MVP) |

## P-DESK — Lập trình viên dùng trên desktop/tablet

| Field | Value |
|---|---|
| Role | Cùng một người (hoặc đồng nghiệp) ngồi trước laptop/iPad, dùng HugRemote như bàn điều khiển nhiều máy và nhiều phiên Claude song song |
| Goals | • Thấy cùng lúc cây dự án, phiên đang chạy và nội dung • Chuyển nhanh giữa server/dự án/phiên bằng bàn phím (⌘K) • Xem diff Git hai cột, sửa file với editor thật |
| Pains | • Thanh bên, panel nhanh và tab chính trùng chức năng • Phím Esc/Ctrl+C/Ctrl+V từng hỏng trong xterm/editor • Kéo giãn cột chỗ có chỗ không |
| Workflow today | Mở HugRemote trên trình duyệt desktop hoặc app macOS tuỳ chọn; dùng thanh bên trái + ô tìm kiếm nhanh (⌘K) |
| Platforms | web desktop ≥900px, tablet 768–1024px |
| Anti-persona (NOT this) | Không thay thế VS Code/IDE local cho phiên làm việc dài trên một máy |
| Active in waves | W1–W4 (Phase MVP), W5–W6 |

## P-HOST — Người tự host và quản trị instance

| Field | Value |
|---|---|
| Role | Người cài HugRemote lên máy cá nhân/VPS, cấu hình truy cập từ xa, bảo mật và cập nhật phiên bản |
| Goals | • Cài một lệnh, chạy như user service • Bật đăng nhập + 2FA trước khi mở ra Internet • Cập nhật lên bản mới an toàn, lỗi thì quay lại • Thêm/sửa máy SSH mà không phải tự sửa file config |
| Pains | • Cấu hình rải ở `.env`, `~/.ssh/config`, file JSON trong `~/.ssh/` • Mất phiên đăng nhập sau mỗi lần restart • Khoá update chết, timeout qua Cloudflare khi cập nhật |
| Workflow today | `curl … install.sh \| bash`, sửa `~/.config/hugremote/.env`, `systemctl --user restart hugremote.service`, `hugremote update --stable` |
| Platforms | CLI Linux/macOS + màn Cài đặt trên web |
| Anti-persona (NOT this) | Không phải quản trị viên doanh nghiệp cần phân quyền nhiều tầng, audit tập trung |
| Active in waves | W1, W4 (Phase MVP), W5–W6 |

## P-TEAM — Thành viên nhóm nhỏ dùng chung host

> Sub-persona của **P-HOST**: suy ra từ hỗ trợ OIDC (Keycloak/Authentik/Okta/Entra), danh sách email Google được phép và thư mục của nhiều người trên cùng một host.

| Field | Value |
|---|---|
| Role | Đồng nghiệp đăng nhập bằng SSO vào instance HugRemote của nhóm để dùng terminal/Claude trên máy chung |
| Goals | • Đăng nhập bằng tài khoản tổ chức • Chỉ thấy phiên Claude của mình |
| Pains | • Bản cũ chỉ kiểm chủ phiên Claude ở chế độ google; terminal/file/git không có ranh giới người dùng |
| Workflow today | Đăng nhập Google/OIDC vào instance chung |
| Platforms | web mobile + desktop |
| Anti-persona (NOT this) | Không phải môi trường đa tenant cô lập — mọi người dùng chung quyền của tài khoản hệ điều hành chạy dịch vụ |
| Active in waves | W5 (Phase 2) |

## 3. Capabilities

| Capability | Phase | P-MOBILE | P-DESK | P-HOST | P-TEAM | Business outcome | Candidate domain |
|---|:--:|:--:|:--:|:--:|:--:|---|---|
| CAP-ACCESS-01 — Đăng nhập mật khẩu (PBKDF2), bắt đổi mật khẩu mặc định, **đăng xuất**, phiên đăng nhập bền qua restart (refresh token lưu phía server) | MVP | ✓ | ✓ | ✓ | | Instance mở ra Internet an toàn; không bị đá ra sau mỗi lần cập nhật (H-4) | access |
| CAP-ACCESS-02 — 2FA TOTP (QR sinh cục bộ, mã khôi phục), giới hạn số lần thử cả bước 2FA | MVP | ✓ | ✓ | ✓ | | Lớp bảo vệ thứ hai cho một ứng dụng có quyền shell | access |
| CAP-ACCESS-03 — Đăng nhập SSO: Google (allowlist email) và OIDC (PKCE, preset IdP); cấu hình SSO **chỉ khi đã đăng nhập** | Phase 2 | ✓ | ✓ | ✓ | ✓ | Nhóm nhỏ dùng chung instance bằng tài khoản tổ chức | access |
| CAP-HOST-01 — Danh sách máy: máy local + host đọc từ `~/.ssh/config` (Include, wildcard, ProxyJump/ProxyCommand), trạng thái kết nối, ngắt kết nối; **không bao giờ trả mật khẩu ra API** | MVP | ✓ | ✓ | ✓ | | Dùng lại cấu hình SSH sẵn có, không phải khai lại | host |
| CAP-HOST-02 — Thêm, **sửa, xoá** máy SSH từ giao diện (khoá hoặc mật khẩu, thư mục bắt đầu, jump host), có nút "Thử kết nối" | MVP | ✓ | ✓ | ✓ | | Không phải tự sửa file config trên điện thoại | host |
| CAP-HOST-03 — Kiểm host key SSH (tin lần đầu + cảnh báo khi đổi), lưu `known_hosts` riêng của HugRemote | MVP | | | ✓ | | Đóng lỗ hổng MITM của bản cũ (`StrictHostKeyChecking no`) | host |
| CAP-PROJ-01 — Dự án = một thư mục trên một máy; dự án Home; chọn thư mục bằng cây; ID dự án ổn định (SHA-256 của serverId + đường dẫn chuẩn hoá); **một phạm vi hiện hành (máy → dự án) quyết định Files, Git, Terminal, Claude** | MVP | ✓ | ✓ | | | Hết nhầm "file của dự án nào" (H-3) | workspace |
| CAP-PROJ-02 — Chuyển nhanh toàn cục (⌘K trên Mac, Ctrl+Alt+K nơi khác — Ctrl+K là phím xoá dòng của shell; nút tìm trên mobile): dự án, phiên Terminal, phiên Claude, file gần đây trên mọi máy đã ghim; tìm không dấu tiếng Việt, an toàn với IME | MVP | ✓ | ✓ | | | Tới đúng chỗ trong ≤3 thao tác (H-1) | workspace |
| CAP-PROJ-03 — Ghim máy vào "Không gian làm việc" và thứ tự hiển thị; trạng thái lưu trên server, đồng bộ giữa thiết bị | MVP | ✓ | ✓ | | | Mở trên điện thoại thấy y như trên máy tính | workspace |
| CAP-TERM-01 — Nhiều phiên terminal PTY thật cho mỗi dự án (local + SSH), chạy nền khi đóng trình duyệt, nối lại có replay đúng kích thước, **danh sách phiên lưu phía server** | MVP | ✓ | ✓ | | | Lệnh dài và TUI (claude, htop, vim) không chết khi điện thoại khoá màn hình | terminal |
| CAP-TERM-02 — Bàn phím cảm ứng cho terminal: thanh phím nhanh (Esc, Tab, Ctrl, mũi tên, Enter), ngăn mở rộng (tổ hợp Ctrl, ký tự shell, lệnh nhanh), bàn phím laptop ảo; co giãn theo `visualViewport` khi bàn phím ảo bật | MVP | ✓ | | | | Gõ được shell/TUI trên điện thoại mà không bị che | terminal |
| CAP-FILE-01 — Duyệt cây file của dự án, mở/sửa/lưu bằng CodeMirror 6, xem trước Markdown/HTML (sandbox), chặn mất thay đổi chưa lưu, phím phụ lập trình trên mobile | MVP | ✓ | ✓ | | | Xem và sửa nhanh thứ Claude vừa viết | files |
| CAP-FILE-02 — Tạo/đổi tên/xoá file và thư mục, tải lên (cả thư mục), tải xuống (thư mục tự nén zip, dọn tạm theo TTL) | MVP | ✓ | ✓ | | | Đưa file qua lại giữa điện thoại và máy chủ | files |
| CAP-GIT-01 — Git của dự án: phát hiện repo lồng (≤5 cấp), trạng thái staged/unstaged, diff, stage/unstage, commit, pull (ff-only), push, đổi nhánh — local và qua SSH | MVP | ✓ | ✓ | | | Duyệt và commit thay đổi của Claude ngay trên điện thoại | git |
| CAP-GIT-02 — Lịch sử commit phân trang, file và diff theo từng commit | Phase 2 | ✓ | ✓ | | | Xem lại Claude đã làm gì qua các commit | git |
| CAP-AI-01 — Phiên Claude Code theo dự án: gửi prompt, stream realtime (thinking, text, tool card, agent con), **chạy nền khi trình duyệt ngắt**, nối lại có replay theo sequence, dừng (SIGINT) hiển thị trạng thái thật | MVP | ✓ | ✓ | | | Giao việc cho Claude rồi bỏ máy đi (H-2) | claude |
| CAP-AI-02 — Yêu cầu tương tác của Claude (xin quyền công cụ, AskUserQuestion) hiện thành thẻ Cho phép/Từ chối/chọn phương án; chế độ quyền chọn bằng menu có mô tả (Auto/Manual/Plan/AcceptEdits/Bypass), cảnh báo rõ khi bật Bypass | MVP | ✓ | ✓ | | | Duyệt quyền trong 1 chạm, không vô tình bật Bypass | claude |
| CAP-AI-03 — Chọn model và mức effort từ chính Claude CLI trên máy đích (`initialize`), hiển thị mức dùng context window | MVP | ✓ | ✓ | | | Không còn danh sách model cứng lỗi thời | claude |
| CAP-AI-04 — **Một danh sách phiên Claude duy nhất** cho mỗi dự án, gộp phiên tạo từ HugRemote và phiên Claude CLI có sẵn trong `~/.claude/projects`; tiếp tục (resume), đổi tên (đồng bộ `--name`), xoá | MVP | ✓ | ✓ | | | Không phải hiểu khái niệm "phiên HugRemote vs phiên CLI" | claude |
| CAP-AI-05 — Tiện ích soạn prompt: gợi ý slash command, đính kèm file/thư mục làm ngữ cảnh, nhập giọng nói theo ngôn ngữ giao diện (Web Speech API), xử lý IME Telex/VNI | Phase 2 | ✓ | ✓ | | | Soạn prompt dài trên điện thoại nhanh hơn | claude |
| CAP-AI-06 — Hạn mức dùng Claude (5 giờ, tuần) và cảnh báo ≥80% | Phase 2 | ✓ | ✓ | | | Không bị bất ngờ hết hạn mức giữa việc | claude |
| CAP-AI-07 — Phân quyền chủ phiên: người dùng SSO chỉ thấy phiên Claude/Terminal của mình | Phase 2 | | | | ✓ | Dùng chung instance không lộ hội thoại của nhau | claude |
| CAP-UX-01 — Vỏ ứng dụng mới: một mô hình điều hướng duy nhất — mobile: thanh trên một hàng (phạm vi máy → dự án) + thanh dưới 4 mục; desktop: thanh bên trái (máy → dự án → phiên) + nội dung; mọi thứ có deep link (hash route) | MVP | ✓ | ✓ | | | Biết mình đang ở đâu, quay lại được bằng nút Back (H-1) | shell |
| CAP-UX-02 — Design system: token màu/chữ/khoảng cách/bo góc/độ sâu, chế độ tối và sáng, tương phản AA, terminal và editor dùng cùng bảng màu; i18n vi/en phủ 100% chuỗi | MVP | ✓ | ✓ | ✓ | | Giao diện nhất quán, thân thiện (H-1) | shell |
| CAP-UX-03 — Trải nghiệm lần đầu và trạng thái rỗng: hướng dẫn thêm máy, tạo dự án, mở phiên đầu tiên; mọi màn có trạng thái đang tải / rỗng / lỗi kèm hành động khắc phục | MVP | ✓ | ✓ | ✓ | | Người mới tự dùng được không cần đọc tài liệu | shell |
| CAP-OPS-01 — Phân phối: CLI `hugremote` (cờ `-p -h -b`, `--version`), cấu hình `~/.config/hugremote/.env`, `install.sh` (stable) / `beta.sh`, user service systemd, phục vụ dưới `BASE_PATH` sau reverse proxy | MVP | | | ✓ | | Cài một lệnh trên Linux/macOS | ops |
| CAP-OPS-02 — Nhập dữ liệu từ bản v1.x: đọc `projects.json`, `auth.json`, `two_factor.json`, server trong `~/.ssh/config`, phiên Claude ở `~/.ssh/hugcode_claude_sessions.json` | MVP | | | ✓ | | Chuyển sang bản mới không mất dự án, mật khẩu, lịch sử Claude | ops |
| CAP-OPS-03 — Tự cập nhật trong ứng dụng: kênh stable/beta, bản cài cô lập + symlink `current`, khoá chống chạy đồng thời, tiến độ từng bước, tự quay lại khi lỗi | Phase 2 | | | ✓ | | Cập nhật từ điện thoại không phải SSH vào máy | ops |
| CAP-OPS-04 — Kiểm tra sức khoẻ: `/api/health`, `hugremote doctor` (Node, git, python3/zip, ssh, claude CLI, quyền file dữ liệu) | MVP | | | ✓ | | Tự chẩn đoán khi cài lỗi | ops |
| CAP-OPS-05 — Ứng dụng macOS tuỳ chọn (Electron, backend loopback + cookie bí mật, `.dmg`, ký Developer ID + notarize) | Phase 3 | | ✓ | ✓ | | Cửa sổ desktop riêng trên Mac | ops |
| CAP-SEC-01 — Nền bảo mật xuyên suốt: CSP chặt, kiểm Origin cho HTTP/WS, chống CSRF (access token qua header + refresh cookie `SameSite=Strict`), giới hạn đường dẫn local theo `ALLOWED_ROOT` (realpath), file SQLite và dữ liệu bí mật mode 0600, bí mật SSH mã hoá, không bí mật nào trong phản hồi API | MVP | ✓ | ✓ | ✓ | ✓ | Đóng các lỗ hổng đã biết của v1.x (H-5) | access |

## 4. Phase priority

_(Phase priority được mã hoá trong cột `Phase` của bảng Capability ở trên — xem §3; kế hoạch wave ở `intake/ROADMAP.md §2`.)_

- **MVP** — thay được bản cũ cho vòng làm việc hằng ngày của P-MOBILE/P-DESK/P-HOST: đăng nhập an toàn → chọn máy → dự án → Terminal / Files / Git / Claude, trên giao diện mới, cài được bằng một lệnh và nhập được dữ liệu cũ.
- **Phase 2** — SSO cho nhóm (P-TEAM), lịch sử Git, tiện ích soạn prompt, hạn mức Claude, tự cập nhật trong app.
- **Phase 3** — ứng dụng macOS đóng gói.

## 5. Out of scope

- **Bot Telegram** — không ai sửa từ v1.1, chạy lệnh shell tuỳ ý qua `child_process.exec`; không đưa vào bản mới. Có nhu cầu thì mở lại như một Phase riêng.
- **Target "Docker/container" như một loại máy** — bản cũ thực ra không có (Docker chỉ là cách deploy HugRemote); container được truy cập qua SSH như mọi host khác.
- **Hệ thống phím tắt Alt+1..9 và tag số** — đã bị gỡ ở v1.6.20, thay bằng chuyển nhanh (CAP-PROJ-02).
- **Panel nhanh thứ hai với editor textarea và Git riêng** — gộp vào màn Files/Git chính; desktop xem song song bằng bố cục chia cột, không bằng bản sao tính năng.
- **Nhập hạn mức Claude bằng tay / dán văn bản** — chỉ hiển thị khi CLI cung cấp được (CAP-AI-06, Phase 2).
- **Đa tenant / phân quyền hệ điều hành theo người dùng** — mọi người dùng chạy dưới quyền tài khoản chạy dịch vụ; HugRemote không cô lập ở mức OS.
- **Debugger, extension, LSP / gợi ý code** — không phải IDE đầy đủ.
- **Bản build Windows native** — Linux/macOS (WSL như Linux).

## 6. Hypotheses + risks

| ID | Statement | Expected outcome | Test method | Status |
|---|---|---|---|---|
| H-1 | Một mô hình điều hướng duy nhất (máy → dự án → phiên) + chuyển nhanh giúp tới đúng chỗ nhanh hơn | Từ mở app tới "đang ở phiên Claude X của dự án Y trên máy Z" ≤3 thao tác trên mobile (bản cũ: 5–7) | Đếm thao tác trong kịch bản demo trên prototype và app thật; dogfood vai newbie | TESTABLE |
| H-2 | Claude chạy nền + nối lại đáng tin là lý do chính người dùng mở app trên điện thoại | Authority dùng bản mới thay bản cũ ≥7 ngày liên tiếp, ≥1 phiên Claude chạy nền/ngày | Event `claude_run_started` có cờ `client_detached`; nhật ký dùng | TESTABLE |
| H-3 | Một phạm vi hiện hành cho mọi tab loại bỏ lớp lỗi "sai scope" | 0 lỗi thuộc lớp scope/đường dẫn remote trong 4 vòng MVP (v1.6.x có ≥6 bản vá) | Test tích hợp phạm vi + dogfood vai edge | TESTABLE |
| H-4 | Phiên đăng nhập bền qua restart giảm ma sát khi cập nhật | 0 lần phải đăng nhập lại sau restart/cập nhật trong thời hạn phiên | Test restart service rồi gọi `/api/auth/me` | TESTABLE |
| H-5 | Đóng các lỗ hổng đã biết không làm chậm luồng chính | Bộ pentest của v1 (truy cập chưa xác thực, rate limit, cookie, CSWSH, CORS, path traversal, prototype pollution, body quá lớn, fuzz WS) + 4 ca mới (cấu hình OIDC khi chưa đăng nhập, SSRF discover, rò mật khẩu qua API danh sách máy, đổi host key) đều PASS | Bộ test bảo mật tự động | TESTABLE |
| R-1 | Rủi ro: tương thích SSH trên macOS (ProxyJump, agent Keychain/1Password, thiếu PATH khi chạy GUI) từng cần ≥4 vòng vá | Giữ nguyên chiến lược ssh2 + fallback OpenSSH ControlMaster của v1.x; test với container SSH thử + jump host | Test tích hợp SSH | TESTABLE |
| R-2 | Rủi ro: hiển thị TUI vỡ khi chuyển phiên/resize | Giữ pool xterm mỗi phiên, resize PTY trước replay, buffer 500KB cắt ở `\n` | Test UI chuyển phiên đa máy | TESTABLE |
| R-3 | Rủi ro: giao thức stream-json của Claude CLI đổi theo phiên bản | Bộ chuẩn hoá sự kiện tách riêng, có fixture ghi từ CLI thật + fuzz | Test giao thức với fixture | TESTABLE |

## 7. References

- `intake/ARCHITECTURE.md`, `intake/TECHSTACK.md`, `intake/ROADMAP.md`
