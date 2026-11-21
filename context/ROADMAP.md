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
| _CHƯA ĐIỀN_ | MVP | | | | |

## 2. Vòng này — bám AC

Nguồn: `PRD.md §3`. Không thêm gì ngoài danh sách đó.

| AC | Trạng thái | Ghi chú |
|---|---|---|
| AC-1 | ☐ | |
| AC-2 | ☐ | |
| AC-3 | ☐ | |

<!-- ĐƯỜNG PHỎNG VẤN — nhịp một tuần, bảng dưới là lịch chuẩn. ĐƯỜNG INTAKE không dùng
     bảng này: thời lượng mỗi vòng khai ở intake/loops/l<N>/_PROPOSAL.md theo cadence
     của wave tương ứng, và vòng nào chạy pha nào cũng đã ghi ở §1. Xoá bảng nếu đi
     đường intake. -->

Lịch (đường phỏng vấn):

| Ngày | Đích | Bắt buộc? |
|---|---|---|
| D1 sáng | Pha V — chốt PRD + persona + stack + kiến trúc (+ prototype Authority chốt, nếu có UI), khoá scope | Có |
| D1 chiều | Pha I — chạy được ở local, đã dogfood | Có |
| D2 | Pha P — prod-ready 4 nhóm + deploy | Khuyến nghị |
| D2–D5 | Pha E — đo, fix, tối ưu, thử nghiệm | Tuỳ chọn |
| Cuối tuần | Pha R — go / pivot / kill | Có |

---

## 3. Backlog — ngoài scope vòng này

> Agent tự append vào đây khi gặp việc ngoài scope. Format: ngày · việc · vì sao bị đẩy ra · ai/cái gì kích hoạt lại.
> Đường intake: nếu việc đó đã nằm trong kế hoạch ở §1 thì ghi rõ "đã có ở vòng N" thay vì mở dòng mới.

| Ngày | Việc | Vì sao không làm vòng này | Kích hoạt lại khi |
|---|---|---|---|
| | | | |

---

## 4. Đã quyết bỏ hẳn

> Khác với backlog — đây là thứ quyết định **không bao giờ làm**, ghi lại để không ai đề xuất lại.

| Ngày | Việc | Lý do bỏ |
|---|---|---|
| | | |

---

## 5. Change log

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-21 | Tạo từ template VIPER | — |
