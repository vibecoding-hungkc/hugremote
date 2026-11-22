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
| 1 | MVP | **Toàn bộ HugRemote mới** — 30 capability của intake (W1–W6 gộp): đăng nhập + 2FA + SSO, máy & dự án, terminal, Files, Git (cả lịch sử), Claude chat (stream, chạy nền, duyệt quyền, model, phiên CLI, giọng nói, đính kèm, hạn mức), chuyển nhanh, design system tối/sáng + vi/en, installer, nhập dữ liệu v1, tự cập nhật, nền bảo mật + pentest; + checklist P1 | V, I, P | — | đang chạy |

Authority gộp 6 vòng của kế hoạch cũ thành một vòng (DECISIONS 2026-11-21). Thứ tự 6 wave của
`intake/ROADMAP.md §2` giữ làm **thứ tự triển khai bên trong vòng** (`intake/loops/l1/_PROPOSAL.md §21`).
Không chạy E (chỉ chạy local); P chỉ phần P1. CAP-OPS-05 (app macOS, Phase 3) ngoài kế hoạch.

## 2. Vòng này — bám AC

Nguồn: `PRD.md §3`. Không thêm gì ngoài danh sách đó.

| AC | Trạng thái | Ghi chú |
|---|---|---|
| AC-1 | ☐ | |
| AC-2 | ☐ | |
| AC-3 | ☐ | |
| AC-4 | ☐ | |
| AC-5 | ☐ | |
| AC-6 | ☐ | |
| AC-7 | ☐ | |
| AC-8 | ☐ | |
| AC-9 | ☐ | |
| AC-10 | ☐ | |
| AC-11 | ☐ | |
| AC-12 | ☐ | |
| AC-13 | ☐ | |
| AC-14 | ☐ | |
| AC-15 | ☐ | |
| AC-16 | ☐ | |
| AC-17 | ☐ | |
| AC-18 | ☐ | |
| AC-19 | ☐ | |
| AC-20 | ☐ | |
| AC-21 | ☐ | |
| AC-22 | ☐ | |
| AC-23 | ☐ | |
| AC-24 | ☐ | |
| AC-25 | ☐ | |
| AC-26 | ☐ | |
| AC-27 | ☐ | |
| AC-28 | ☐ | |
| AC-29 | ☐ | |
| AC-30 | ☐ | |
| AC-31 | ☐ | |
| AC-32 | ☐ | |
| AC-33 | ☐ | |
| AC-34 | ☐ | |
| AC-35 | ☐ | |
| AC-36 | ☐ | |
| AC-37 | ☐ | |
| AC-38 | ☐ | |
| AC-39 | ☐ | |
| AC-40 | ☐ | |
| AC-41 | ☐ | |
| AC-42 | ☐ | |
| AC-43 | ☐ | |
| AC-44 | ☐ | |
| AC-45 | ☐ | |
| AC-46 | ☐ | |
| AC-47 | ☐ | |
| AC-48 | ☐ | |
| AC-49 | ☐ | |

Thời lượng vòng: `intake/loops/l1/_PROPOSAL.md` (~6 tuần công, gồm P1).

---

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
