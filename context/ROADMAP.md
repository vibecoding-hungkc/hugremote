---
type: roadmap
tier: T1
last_reviewed: "2026-11-21"
---

# ROADMAP — hugremote

> Hai việc: **kế hoạch chia vòng** (§1) và **nơi đổ thứ bị scope-lock đẩy ra** (§3).
> Agent gặp việc ngoài scope thì **ghi vào §3 rồi đi tiếp**, không hỏi.

---

## 1. Kế hoạch vòng

<!-- ĐƯỜNG PHỎNG VẤN: một dòng cho vòng hiện tại là đủ. Vòng sau chỉ mở khi pha R quyết
     GO/PIVOT — không lập trước, vì chưa biết số liệu sẽ nói gì.

     ĐƯỜNG INTAKE: lập ĐẦY ĐỦ ở vòng 1 (VIPER.md §1.4, /viper-validate mục I5). Cắt hệ
     thống trong intake/ROADMAP.md §2 (wave sequence) + intake/PRD.md §3 (capability ×
     phase) thành N vòng. Mỗi dòng ở đây PHẢI có intake/loops/l<N>/_PROPOSAL.md tương
     ứng — gate.py V vòng 1 đối chiếu hai bên, lệch là đỏ.

     Cột "Pha chạy": V, I bắt buộc mọi vòng. Thêm P (deploy) / E (đo) / R (quyết
     go-pivot-kill) ở vòng Authority chốt — hệ thống lớn thì phần lớn vòng chỉ V+I,
     deploy dồn vào vòng có đủ thứ đáng deploy.

     Ví dụ (đường intake):
     | 1 | MVP | Khung xác thực + hồ sơ người dùng (CAP-AUTH-01, CAP-USER-01) | V, I | — | đang chạy |
     | 2 | MVP | Đặt lịch lõi (CAP-BOOK-01..03) | V, I | vòng 1 | chưa mở |
     | 3 | MVP | Nhắc lịch + deploy lần đầu (CAP-NOTI-01) | V, I, P | vòng 2 | chưa mở |
     | 4 | Phase 2 | Đo phản ứng, quyết mở rộng | V, I, P, E, R | vòng 3 | chưa mở |

     Cột "Phase": giai đoạn sản phẩm mà vòng thuộc về (MVP, Phase 2…) — lấy từ cột Phase
     của capability ở intake. Vòng có Phase khác vòng trước = VÒNG ĐẦU của Phase mới: pha V
     của nó lập lại SOLUTION.md phần A (giải pháp tổng thể của Phase) và Authority chốt;
     repeat.py tự đọc cột này để ghi dòng `Phase` ở STATE.md.
-->

| Vòng | Phase | Phạm vi | Pha chạy | Phụ thuộc | Trạng thái |
|---|---|---|---|---|---|
| 1 | MVP | **Toàn bộ HugRemote mới** — 30 capability của intake (W1–W6 gộp): đăng nhập + 2FA + SSO, máy & dự án, terminal, Files, Git (cả lịch sử), Claude chat (stream, chạy nền, duyệt quyền, model, phiên CLI, giọng nói, đính kèm, hạn mức), chuyển nhanh, design system tối/sáng + vi/en, installer, nhập dữ liệu v1, tự cập nhật, nền bảo mật + pentest; + checklist P1 | V, I, P | — | xong (P1 xanh 2026-11-23; 49/49 AC; P2 không áp dụng — chỉ chạy local) |
| 2 | Phase 3 | **CAP-OPS-05 — Ứng dụng macOS đóng gói**: `apps/desktop` (vỏ Electron bọc `apps/api`+`apps/web` đã build), lệnh build `.app`+`.dmg` ký ad-hoc, chế độ "phiên desktop" (loopback + cookie bí mật riêng mỗi lần mở, không cần mật khẩu) | V, I | vòng 1 | xong (2026-11-24; AC-50..52; không quay video — DECISIONS 2026-11-24) |
| 3 | MVP | **Terminal dùng hằng ngày trên desktop** (yêu cầu Authority 2026-11-24): phím tắt macOS + chép/dán trong terminal, phiên tmux tự gắn lại, mở lại tại tab mất kết nối, phiên trình duyệt, chuyển tiếp cổng hai chiều (`-L`/`-R`), Files giữ trạng thái + Home file ẩn, ô chat gọn + hạn mức trong popup model, khung nội dung Claude rộng + markdown đúng — AC-53..65 | V, I, P (chỉ P1) | vòng 2 | đang chạy (prototype chốt 2026-11-24) |

Authority gộp 6 vòng của kế hoạch cũ thành một vòng (DECISIONS 2026-11-21). Thứ tự 6 wave của
`intake/ROADMAP.md §2` giữ làm **thứ tự triển khai bên trong vòng** (`intake/loops/l1/_PROPOSAL.md §21`).
Không chạy E (chỉ chạy local); P chỉ phần P1.

Vòng 2 (CAP-OPS-05) mở theo chỉ thị trực tiếp của Authority qua chat ngày 2026-11-23 (ngoài kế hoạch
wave gốc, vốn đặt capability này ở Phase 3 — DECISIONS 2026-11-23). Notarize Apple thật (Developer ID)
cần tài khoản Apple Developer của Authority, chưa có ở vòng này → chỉ ký ad-hoc (`codesign --sign -`),
giữ nguyên ý định can và thay thế khi Authority cấp chứng chỉ.

## 2. Vòng này — bám AC

Nguồn: `PRD.md §3`. Không thêm gì ngoài danh sách đó. AC vòng 1–2 lưu nguyên vẹn ở `context/archive/vong-1/` và `context/archive/vong-2/ROADMAP.md`.

| AC | Trạng thái | Ghi chú |
|---|---|---|
| AC-53 | ☑ | Phím tắt macOS trong terminal — `e9fdd33`; ⌘ thật trên Mac chờ Authority xác nhận |
| AC-54 | ☑ | Nhiều phiên tmux ở nút + (chỉ máy SSH) — `2a098da`, e2e round3 |
| AC-55 | ☑ | tmux gắn lại qua restart, cùng shell — `2a098da`, e2e round3 |
| AC-56 | ☑ | Mở lại tại tab mất kết nối, giữ id — `2a098da`, e2e round3 |
| AC-57 | ☐ | Chuyển tiếp cổng hai chiều |
| AC-58 | ☐ | Cổng đang nghe trên máy SSH |
| AC-59 | ☐ | Phiên trình duyệt (app desktop) |
| AC-60 | ☐ | Files giữ trạng thái cây |
| AC-61 | ☐ | Home hiện file ẩn sẵn |
| AC-62 | ☐ | Ô chat gọn |
| AC-63 | ☐ | Hạn mức trong popup model |
| AC-64 | ☐ | Khung nội dung Claude 1280px |
| AC-65 | ☐ | CSS markdown (bảng viền…) |

Thời lượng vòng: `intake/loops/l3/_PROPOSAL.md` (~3–5 ngày công).

---

- [ ] `files-watch`: theo dõi file đổi ngoài Claude (terminal, công cụ khác) để tự tải lại — vòng sau (DECISIONS 2026-11-22 AC-37)

## 3. Backlog — ngoài scope vòng này

> Agent tự append vào đây khi gặp việc ngoài scope. Format: ngày · việc · vì sao bị đẩy ra · ai/cái gì kích hoạt lại.
> Đường intake: nếu việc đó đã nằm trong kế hoạch ở §1 thì ghi rõ "đã có ở vòng N" thay vì mở dòng mới.

| Ngày | Việc | Vì sao không làm vòng này | Kích hoạt lại khi |
|---|---|---|---|
| 2026-11-21 | Tính năng kiểu Orca: git worktree riêng cho mỗi phiên Claude, chạy song song nhiều agent một task, so sánh/gộp kết quả | Authority chỉ lấy UI của Orca ở bản này; ngoài 31 capability của intake | Authority thả tài liệu vòng / sau Phase 2 |
| 2026-11-21 | Deploy production thật (P2) và đo số liệu (E) | Công cụ chỉ chạy local (Authority) | Khi có người dùng ngoài Authority |

---

## 4. Đã quyết bỏ hẳn

> Khác với backlog — đây là thứ quyết định **không bao giờ làm**, ghi lại để không ai đề xuất lại.

| Ngày | Việc | Lý do bỏ |
|---|---|---|
| 2026-11-21 | Bot Telegram | Không bảo trì từ v1.1, chạy lệnh shell tuỳ ý (`intake/PRD.md §5`) |
| 2026-11-21 | Target Docker/container như một loại máy | Container truy cập qua SSH như mọi host (`intake/PRD.md §5`) |
| 2026-11-21 | Panel nhanh thứ hai (editor + Git riêng) | Gộp vào màn chính; desktop dùng chia ô (`intake/PRD.md §5`) |

---

## 5. Change log

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-21 | Tạo từ template VIPER | — |
| 2026-11-21 | Lập kế hoạch 6 vòng từ intake W1–W6 | Pha V vòng 1, đường intake |
| 2026-11-21 | Gộp 6 vòng thành 1 vòng | Authority chốt ở pha V |
| 2026-11-21 | §2 theo dõi 49 AC (thêm AC-36..AC-49) | Prototype lượt 3–7 + rà soát reviewer |
