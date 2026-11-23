---
type: capabilities-map
tier: T0
status: ACTIVE
last_reviewed: "2026-11-23"
---

# CAPABILITIES MAP — hugremote

> Bản đồ năng lực, tách từ `intake/PRD.md §3` (đường intake, `VIPER.md §1.3`). Giữ nguyên mã `CAP-…`.
> Cột "Vòng giao" khớp `ROADMAP.md §1`; cột "AC vòng này" khớp `PRD.md §3`.

---

## 1. Bảng năng lực

| Capability | Phase (intake) | Personas | Vòng giao | AC vòng này | Trạng thái |
|---|---|---|---|---|---|
| CAP-ACCESS-01 — Đăng nhập mật khẩu, bắt đổi mật khẩu mặc định, đăng xuất, phiên bền qua restart | MVP | P-MOBILE, P-DESK, P-HOST | 1 | — | xong (vòng 1) |
| CAP-ACCESS-02 — 2FA TOTP + mã khôi phục, giới hạn thử | MVP | P-MOBILE, P-DESK, P-HOST | 1 | — | xong (vòng 1) |
| CAP-ACCESS-03 — SSO Google / OIDC, cấu hình chỉ khi đã đăng nhập | Phase 2 | P-MOBILE, P-DESK, P-HOST, P-TEAM | 1 | — | xong (vòng 1) |
| CAP-HOST-01 — Danh sách máy từ `~/.ssh/config` + local, không lộ bí mật | MVP | P-MOBILE, P-DESK, P-HOST | 1 | — | xong (vòng 1) |
| CAP-HOST-02 — Thêm/sửa/xoá máy SSH, thử kết nối | MVP | P-MOBILE, P-DESK, P-HOST | 1 | — | xong (vòng 1) |
| CAP-HOST-03 — Kiểm host key SSH | MVP | P-HOST | 1 | — | xong (vòng 1) |
| CAP-PROJ-01 — Dự án + một phạm vi hiện hành cho mọi tab | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-PROJ-02 — Chuyển nhanh toàn cục | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-PROJ-03 — Máy đã ghim, đồng bộ giữa thiết bị | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-TERM-01 — Phiên PTY chạy nền, nối lại, lưu phía server | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-TERM-02 — Bàn phím cảm ứng cho terminal + `visualViewport` | MVP | P-MOBILE | 1 | — | xong (vòng 1) |
| CAP-FILE-01 — Duyệt, sửa, xem trước file của dự án | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-FILE-02 — Tạo/đổi tên/xoá, tải lên/xuống, zip | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-GIT-01 — Trạng thái, diff, stage, commit, pull/push, nhánh | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-GIT-02 — Lịch sử commit + diff theo commit | Phase 2 | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-AI-01 — Phiên Claude stream, chạy nền, nối lại, dừng | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-AI-02 — Thẻ duyệt quyền + menu chế độ quyền | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-AI-03 — Model/effort từ CLI + context usage | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-AI-04 — Một danh sách phiên Claude (gộp CLI) | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-AI-05 — Slash command, đính kèm, giọng nói, IME | Phase 2 | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-AI-06 — Hạn mức dùng Claude | Phase 2 | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-AI-07 — Phân quyền chủ phiên cho người dùng SSO | Phase 2 | P-TEAM | 1 | — | xong (vòng 1) |
| CAP-UX-01 — Vỏ ứng dụng + một mô hình điều hướng + deep link | MVP | P-MOBILE, P-DESK | 1 | — | xong (vòng 1) |
| CAP-UX-02 — Design system, tối/sáng, AA, i18n vi/en đủ | MVP | P-MOBILE, P-DESK, P-HOST | 1 | — | xong (vòng 1) |
| CAP-UX-03 — Lần đầu dùng + trạng thái rỗng/tải/lỗi | MVP | P-MOBILE, P-DESK, P-HOST | 1 | — | xong (vòng 1) |
| CAP-OPS-01 — CLI, `.env`, installer stable/beta, systemd, `BASE_PATH` | MVP | P-HOST | 1 | — | xong (vòng 1) |
| CAP-OPS-02 — Nhập dữ liệu từ v1.x | MVP | P-HOST | 1 | — | xong (vòng 1) |
| CAP-OPS-03 — Tự cập nhật trong app có quay lại | Phase 2 | P-HOST | 1 | — | xong (vòng 1) |
| CAP-OPS-04 — `/api/health` + `hugremote doctor` | MVP | P-HOST | 1 | — | xong (vòng 1) |
| CAP-OPS-05 — Ứng dụng macOS đóng gói, notarize | Phase 3 | P-DESK, P-HOST | 2 | AC-50, AC-51, AC-52 | vòng này |
| CAP-SEC-01 — Nền bảo mật xuyên suốt | MVP | P-MOBILE, P-DESK, P-HOST, P-TEAM | 1 | — | xong (vòng 1) |

## 2. Lát cắt vòng này

Vòng 2 giao **CAP-OPS-05 — Ứng dụng macOS đóng gói**: `apps/desktop` (vỏ Electron bọc `apps/api` + `apps/web`),
đóng gói `.app` và `.dmg` ký ad-hoc, tự động xác thực loopback không cần mật khẩu.

## 3. Change log

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-21 | Tạo từ template VIPER | — |
| 2026-11-21 | Tách 31 capability từ intake, xếp 6 vòng | Pha V vòng 1 |
| 2026-11-21 | Gộp: 30 capability giao ở vòng 1 | Authority chốt ở pha V |
| 2026-11-21 | Cột AC thêm AC-36..AC-49 (49 AC); không thêm capability | Prototype lượt 3–7 + rà soát reviewer (DECISIONS D1–D17) |
| 2026-11-23 | Mở vòng 2: CAP-OPS-05 (AC-50, AC-51, AC-52) | Chỉ thị Authority qua chat, dời từ Phase 3 lên làm ngay |
