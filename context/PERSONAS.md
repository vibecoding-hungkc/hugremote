---
type: personas
tier: T0
status: DRAFT
last_reviewed: "2026-11-21"
---

# PERSONAS — hugremote

> **Ai dùng sản phẩm, và họ được cấp năng lực gì.** Điền ở pha V. Đây là nguồn sự thật cho
> phân quyền khi code (pha I), và là chân dung mà các vai dogfood đóng (`DOGFOOD-PLAN.md`) —
> thẻ vai (vội, phá, mới, khó tính…) là *cách dùng*, persona là *ai đang dùng*.
> Xoá hết dấu `_CHƯA ĐIỀN_` khi điền xong — `python3 scripts/gate.py V` bắt dấu này.

---

## 1. Persona

<!-- SỐ LƯỢNG khác nhau theo đường vào (VIPER.md §1.3):
     · Đường phỏng vấn — tối đa 2–3. Nhiều hơn là dấu hiệu scope quá lớn cho một tuần.
     · Đường intake   — bao nhiêu persona thì intake/PRD.md §2 định nghĩa bấy nhiêu; giữ
       nguyên mã P-… để truy vết ngược. Hệ thống lớn có nhiều vai là chuyện bình thường.

     Persona CHÍNH để đầu tiên. Ví dụ:

     ### Persona 1 — Chủ gara (role: owner) ← persona chính
     | Mục | Nội dung |
     |---|---|
     | Mã (intake) | P-OWNER |
     | Chân dung + bối cảnh | 35–50 tuổi, quản 3–10 thợ, đứng giữa xưởng vừa nghe điện thoại vừa thao tác, mỗi lần dưới 1 phút |
     | Thiết bị chính | Điện thoại (link chia sẻ qua Zalo) |
     | Tần suất dùng | Cả ngày — 20–40 cuộc gọi đặt lịch mỗi ngày |
     | Mức thành thạo | Thấp — chỉ quen Zalo, không quen phần mềm quản lý |
     | Năng lực được cấp | Tạo/sửa/huỷ lịch hẹn của MỌI thợ trong gara mình; xem báo cáo tuần |
     | KHÔNG được làm | Thấy dữ liệu của gara khác |
     | Luồng chính | Nhận cuộc gọi → mở app → thấy khung giờ trống → chốt hẹn → xong |
     | Vào từ vòng | 1 |
-->

### Persona 1 — _CHƯA ĐIỀN_ (role: _CHƯA ĐIỀN_) ← persona chính

| Mục | Nội dung |
|---|---|
| Mã (intake) | — (đường phỏng vấn để `—`) |
| Chân dung + bối cảnh | _CHƯA ĐIỀN_ |
| Thiết bị chính | _CHƯA ĐIỀN_ (điện thoại / máy tính — điện thoại là tín hiệu bật vai dogfood `mobile`) |
| Tần suất dùng | _CHƯA ĐIỀN_ (vài lần một tháng / hằng ngày / cả ngày — dùng hằng ngày là tín hiệu bật vai `power`) |
| Mức thành thạo | _CHƯA ĐIỀN_ |
| Năng lực được cấp | _CHƯA ĐIỀN_ (được làm gì trong sản phẩm) |
| KHÔNG được làm | _CHƯA ĐIỀN_ |
| Luồng chính | _CHƯA ĐIỀN_ (vai dogfood sẽ đi đúng luồng này) |
| Vào từ vòng | 1 |

<!-- Persona 2, 3… — copy đúng khung trên. Sản phẩm chỉ có một loại người dùng thì một
     persona là đủ, đừng bịa thêm cho có.
     "Vào từ vòng": persona chỉ xuất hiện ở vòng sau vẫn khai đủ ở đây (để ma trận §2
     đầy đủ ngay từ đầu), nhưng ghi rõ vòng nào mới cấp năng lực thật. -->

## 2. Ma trận vai × hành động

<!-- Đây là SPEC cho phân quyền — pha I code theo đây, không tự quyết rồi ghi DECISIONS.
     Mỗi ô ✗ là một ca kiểm bắt buộc: gọi thẳng URL/API phải bị chặn.
     vai `breaker` (dogfood) và phép thử A↛B (/viper-polish nhóm 2) chạy đúng theo bảng này.
     Luôn có cột "chưa đăng nhập" — kể cả khi sản phẩm không có đăng nhập (khi đó ghi rõ
     "không có auth, mọi người thấy mọi thứ" ở dòng đầu và cân nhắc lại với Authority ở pha V).

     Ví dụ:
     | Hành động | owner | mechanic | chưa đăng nhập |
     |---|---|---|---|
     | Tạo / sửa / huỷ lịch hẹn | ✓ | ✗ | ✗ |
     | Xem lịch của thợ khác | ✓ | ✗ | ✗ |
     | Đánh dấu hoàn thành | ✓ | ✓ (của mình) | ✗ |
-->

| Hành động | _CHƯA ĐIỀN_ (role 1) | chưa đăng nhập |
|---|---|---|
| _CHƯA ĐIỀN_ | | |

## 3. Dogfood

Vai dogfood nào chạy, đóng persona nào, bằng tài khoản nào — **theo từng vòng** ở
`context/DOGFOOD-PLAN.md` (lập ở pha V). File này chỉ cung cấp nguyên liệu cho kế hoạch đó:
chân dung + thiết bị chính + tần suất dùng (§1) là tín hiệu bật vai, ma trận §2 là danh sách
phép thử của vai `breaker`.
