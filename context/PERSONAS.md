---
type: personas
tier: T0
status: ACTIVE
last_reviewed: "2026-11-21"
---

# PERSONAS — hugremote

> **Ai dùng sản phẩm, và họ được cấp năng lực gì.** Dịch từ `intake/PRD.md §2`, giữ mã `P-…`.
> P-MOBILE, P-DESK, P-HOST thực tế là **cùng một người** (chủ instance) ở ba bối cảnh — nên cùng vai
> `owner`. P-TEAM là vai `member`, vào bằng SSO.
>
> **Đối tượng chính là developer làm việc cùng AI agent (Claude Code) trên máy của mình và máy SSH.** HugRemote
> không thay IDE cho phiên code dài; nó là **bàn điều khiển từ xa** cho vòng việc: giao việc cho Claude → duyệt
> kết quả (file, diff) → sửa nhanh → chạy lệnh/đọc log → commit. Bảng §1.1 là những việc đó, theo tần suất.

---

## 1. Persona

### Persona 1 — Lập trình viên điều khiển từ điện thoại (role: owner) ← persona chính

| Mục | Nội dung |
|---|---|
| Mã (intake) | P-MOBILE |
| Chân dung + bối cảnh | Lập trình viên solo dùng Claude Code hằng ngày; giao việc rồi rời máy, mở điện thoại lúc đang di chuyển/xếp hàng để xem tiến độ, gõ vài lệnh, duyệt quyền. Mỗi lần dùng 1–5 phút, một tay, mạng 4G chập chờn |
| Thiết bị chính | Điện thoại (iOS Safari PWA, Android Chrome), màn 360–430px, bàn phím ảo tiếng Việt Telex/VNI |
| Tần suất dùng | Hằng ngày, nhiều lần mỗi ngày |
| Mức thành thạo | Cao về kỹ thuật (shell, git, SSH), nhưng ghét giao diện rối trên màn nhỏ |
| Năng lực được cấp | Toàn quyền trên instance: đăng nhập/đăng xuất, bật/tắt 2FA, cấu hình SSO, thêm/sửa/xoá máy, tin host key, tạo/xoá dự án, mọi phiên terminal và Claude (của mọi người), Files, Git, cập nhật phiên bản |
| KHÔNG được làm | Truy cập file local ngoài `ALLOWED_ROOT` qua API file; vào app khi chưa qua đủ mật khẩu + 2FA |
| Luồng chính | Mở PWA → (2FA) → thấy cây máy/dự án, phiên Claude có chấm "cần duyệt" → chạm → duyệt quyền một chạm → xem diff ở Git → commit; hoặc chạm phiên terminal, gõ bằng thanh phím |
| Vào từ vòng | 1 |

### Persona 2 — Lập trình viên dùng trên desktop/tablet (role: owner)

| Mục | Nội dung |
|---|---|
| Mã (intake) | P-DESK |
| Chân dung + bối cảnh | Cùng người (hoặc đồng nghiệp tin cậy) ngồi trước laptop/iPad, dùng HugRemote như bàn điều khiển nhiều máy và nhiều phiên song song — Authority hiện dùng desktop nhiều, nên đây là trải nghiệm hạng nhất ngang mobile |
| Thiết bị chính | Máy tính (trình duyệt desktop ≥ 1024px), tablet 768–1024px; bàn phím vật lý |
| Tần suất dùng | Hằng ngày, phiên dài hàng giờ |
| Mức thành thạo | Cao; dùng phím tắt, muốn thấy nhiều thứ cùng lúc (thanh bên + hai terminal cạnh nhau) |
| Năng lực được cấp | Như P-MOBILE |
| KHÔNG được làm | Như P-MOBILE |
| Luồng chính | Mở trình duyệt → thanh bên cây Máy → Dự án → Phiên → chia ô Claude + Terminal (hoặc Files/Git) → làm việc → ⌘K chuyển dự án |
| Vào từ vòng | 1 |

### Persona 3 — Người tự host và quản trị instance (role: owner)

| Mục | Nội dung |
|---|---|
| Mã (intake) | P-HOST |
| Chân dung + bối cảnh | Người cài HugRemote lên máy cá nhân/VPS, đặt sau Cloudflare Tunnel hoặc reverse proxy, lo bảo mật và cập nhật |
| Thiết bị chính | Máy tính (terminal + trình duyệt) |
| Tần suất dùng | Vài lần một tháng (cài, cấu hình, cập nhật); bật 2FA một lần |
| Mức thành thạo | Cao — quen systemd, `.env`, `~/.ssh/config` |
| Năng lực được cấp | Như P-MOBILE, cộng: `install.sh`, nhập dữ liệu v1, `hugremote doctor`, cập nhật trong app, cấu hình SSO + allowlist |
| KHÔNG được làm | Như P-MOBILE |
| Luồng chính | `install.sh` (nhập dữ liệu v1) → đăng nhập lần đầu → đổi mật khẩu → bật 2FA → thêm máy SSH → cấu hình SSO cho nhóm → cập nhật khi có bản mới |
| Vào từ vòng | 1 |

### Persona 4 — Thành viên nhóm nhỏ dùng chung host (role: member)

| Mục | Nội dung |
|---|---|
| Mã (intake) | P-TEAM (sub-persona của P-HOST) |
| Chân dung + bối cảnh | Đồng nghiệp đăng nhập bằng SSO (Google/OIDC) vào instance chung của nhóm để dùng terminal/Claude trên máy chung |
| Thiết bị chính | Điện thoại + máy tính |
| Tần suất dùng | Hằng ngày |
| Mức thành thạo | Cao về kỹ thuật |
| Năng lực được cấp | Mở/đóng/đổi tên phiên terminal và Claude **của mình** (duyệt qua chuông chỉ phiên của mình); dùng Files/Git trong dự án owner đã khai; xem danh sách máy và ghim cho riêng mình; xem/đăng xuất thiết bị của mình; tuỳ chọn cá nhân |
| KHÔNG được làm | Thấy/điều khiển phiên của người khác (ở cây, S2, chuông, ⌘K, URL); cấu hình SSO, quản trị thành viên, nhật ký, cập nhật, 2FA toàn instance; thêm/sửa/xoá máy; tạo/đổi tên/bỏ dự án |
| Luồng chính | Đăng nhập SSO → chọn dự án → mở phiên của mình |
| Vào từ vòng | 1 |

### 1.1 Việc hằng ngày của developer (nguồn cho AC Files/Git/Claude và vai dogfood `power`)

| Việc | Tần suất | Thiết bị | Cần gì từ HugRemote |
|---|---|---|---|
| Duyệt thay đổi Claude vừa làm | Nhiều lần/ngày | Điện thoại + desktop | Chấm "cần duyệt"/"xong" ở cây; bấm đường dẫn trong thẻ công cụ của Claude → mở file đúng dòng; đánh dấu dòng mới/đã sửa so với commit; xem thay đổi (diff) của một file |
| Sửa nhanh vài dòng ở 1–3 file | Nhiều lần/ngày | Desktop chủ yếu | Mở nhanh file theo tên (⌘P), nhiều file mở dạng tab, tìm/thay trong file (⌘F), tới dòng, lưu (⌘S), không ghi đè im lặng khi Claude sửa cùng file |
| Tìm nơi dùng một hàm/chuỗi | Hằng ngày | Desktop | Tìm trong nội dung cả dự án (⌘⇧F) có số dòng, bỏ qua `.gitignore`, bấm kết quả mở đúng dòng |
| Đọc log / file cấu hình | Hằng ngày | Cả hai | Mở log có theo dõi (tail -f), hiện file ẩn (`.env`, `.github`) khi cần, file quá lớn → xem đoạn cuối/tải xuống |
| Đưa ngữ cảnh cho Claude / terminal | Nhiều lần/ngày | Cả hai | Sao chép đường dẫn (tuyệt đối/tương đối), "Gửi cho Claude" một file/thư mục, "Mở terminal tại đây" |
| Quản lý file | Vài lần/tuần | Cả hai | Tạo/đổi tên/di chuyển/nhân bản/xoá, tải lên (cả thư mục), tải xuống (thư mục → zip), xem ảnh |
| Commit/push | Hằng ngày | Cả hai | Chọn file vào commit, mô tả, commit, push; bỏ thay đổi chưa commit của một file |

## 2. Ma trận vai × hành động

> Mỗi ô ✗ là một ca kiểm bắt buộc của vai `breaker` (gọi thẳng API phải bị chặn).

| Hành động | owner | member | đã nhập đúng mật khẩu, chưa qua 2FA | chưa đăng nhập |
|---|---|---|---|---|
| Đăng nhập bằng mật khẩu | ✓ | ✗ (dùng SSO) | — | ✓ (chỉ màn đăng nhập) |
| Đăng nhập SSO (Google/OIDC) | ✓ (nếu email trong allowlist) | ✓ (email trong allowlist) | — | ✓ (chỉ luồng redirect) |
| Nhập mã 2FA / mã khôi phục | ✓ | — (2FA của IdP) | ✓ | ✗ |
| Đổi mật khẩu, bật/tắt 2FA, tạo lại mã khôi phục | ✓ | ✗ | ✗ | ✗ |
| Xem / sửa cấu hình SSO, allowlist | ✓ | ✗ | ✗ | ✗ |
| Đăng xuất | ✓ | ✓ | ✓ | — |
| Xem danh sách máy | ✓ | ✓ | ✗ | ✗ |
| Thêm / sửa / xoá máy, xem khoá SSH, tin host key | ✓ | ✗ | ✗ | ✗ |
| Ghim / sắp xếp máy | ✓ | ✓ (của mình) | ✗ | ✗ |
| Tạo / sửa / xoá dự án | ✓ | ✗ | ✗ | ✗ |
| Đổi tên hiển thị dự án | ✓ | ✗ | ✗ | ✗ |
| Bỏ dự án khỏi không gian làm việc (xoá cho cả nhóm, dừng mọi phiên của dự án) | ✓ | ✗ | ✗ | ✗ |
| Tạo thư mục mới khi chọn thư mục dự án (S5, `POST /api/hosts/:id/mkdir`) | ✓ | ✗ | ✗ | ✗ |
| Duyệt cây thư mục (local: trong `ALLOWED_ROOT`) | ✓ | ✓ (trong dự án) | ✗ | ✗ |
| Mở / gõ / đổi tên / đóng phiên terminal | ✓ (mọi phiên) | ✓ (chỉ của mình) | ✗ | ✗ |
| Đổi tên hiển thị phiên Claude | ✓ (mọi phiên) | ✓ (chỉ của mình) | ✗ | ✗ |
| Duyệt ✓/✗ qua chuông thông báo; nhận sự kiện `events.v1` | ✓ (mọi phiên) | ✓ (chỉ phiên của mình) | ✗ | ✗ |
| Xếp hàng / huỷ tin nhắn chờ của phiên Claude | ✓ (mọi phiên) | ✓ (chỉ của mình) | ✗ | ✗ |
| Xem / đăng xuất thiết bị đăng nhập | ✓ (của mình) | ✓ (của mình) | ✗ | ✗ |
| Tuỳ chọn cá nhân (chủ đề, ngôn ngữ, chế độ gọn) | ✓ | ✓ | ✗ | ✗ |
| Xem thành viên, thu hồi member, xem lần SSO bị từ chối, tắt SSO | ✓ | ✗ | ✗ | ✗ |
| Xem nhật ký trong app (ứng dụng, cập nhật, SSH) | ✓ | ✗ | ✗ | ✗ |
| Mở WebSocket terminal / SSE Claude | ✓ (vé hợp lệ) | ✓ (vé + phiên của mình) | ✗ | ✗ |
| Files: đọc, sửa, tạo, xoá, tải lên/xuống | ✓ | ✓ (trong dự án) | ✗ | ✗ |
| Git: xem, stage, commit, pull, push, đổi nhánh, lịch sử | ✓ | ✓ (trong dự án) | ✗ | ✗ |
| Phiên Claude: tạo, gửi, dừng, duyệt quyền, đổi model, resume, xoá | ✓ (mọi phiên) | ✓ (chỉ của mình) | ✗ | ✗ |
| Bật chế độ quyền Bypass cho phiên Claude | ✓ | ✓ (phiên của mình, xác nhận hai lần) | ✗ | ✗ |
| Xem trang Hệ thống, cập nhật phiên bản | ✓ | ✗ | ✗ | ✗ |
| `GET /api/health` | ✓ | ✓ | ✓ | ✓ (chỉ `{status}`) |

## 3. Dogfood

Vai dogfood nào chạy, đóng persona nào, bằng instance nào — **theo từng vòng** ở
`context/DOGFOOD-PLAN.md`. P-MOBILE dùng điện thoại hằng ngày → tín hiệu bật `mobile` + `power`;
P-HOST là persona vận hành, có vai `member` → tín hiệu `operator`; ma trận §2 là danh sách
phép thử của `breaker`.
