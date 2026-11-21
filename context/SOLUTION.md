---
type: solution
tier: T0
status: DRAFT
last_reviewed: "2026-11-21"
---

# SOLUTION — hugremote

> **Đầu mối của bộ giải pháp** — bộ gồm file này + `ARCHITECTURE.md` (hệ thống trông thế nào) +
> `TECHSTACK.md` (dựng bằng gì) + `DESIGN-SYSTEM.md` (trông ra sao, nếu có UI). File này trả lời
> câu còn lại: **bài toán của Phase được giải ra sao, và pha I phải tuân thủ những gì.**
>
> - **Phần A — giải pháp tổng thể của Phase**: lập ở pha V của **vòng đầu tiên của Phase** (MVP,
>   Phase 2…), Authority chốt, đứng yên suốt Phase. Đổi giữa Phase → dòng ở §A6, không sửa lén.
> - **Phần B — giải pháp chi tiết của vòng**: viết lại ở pha V **mỗi vòng** cho đúng AC của vòng.
>   Trước khi viết lại, phần nào của B vòng trước còn hiệu lực lâu dài thì **nâng lên** A3 (quy ước)
>   hoặc `ARCHITECTURE.md` (contract, dữ liệu) — B cũ nằm ở `context/archive/vong-N/`.
>
> Pha I **tuân thủ** A3 và B1: làm khác đi phải có 1 dòng `DECISIONS.md` + sửa file này cùng commit
> (luật #4). Ngắn: A tối đa ~2 trang, B tối đa ~1 trang — Authority đọc A một lần mỗi Phase.
> `gate.py V` kiểm cả hai phần.

Phase: MVP
Vòng đầu của Phase: 1
Authority chốt Phase: _CHƯA ĐIỀN_

<!-- Ba dòng trên là dòng máy đọc. `Phase` và `Vòng đầu của Phase` phải khớp dòng `Phase` trong
     STATE.md. `Authority chốt Phase: <ngày ISO>` — ghi khi Authority đọc phần A và đồng ý (đang pha
     V, được hỏi); ở vòng đầu của Phase từ vòng 2 trở đi, ngày phải ≥ `Vòng mở`. -->

## A. Giải pháp tổng thể của Phase

### A1. Sản phẩm cuối Phase

_CHƯA ĐIỀN_

<!-- Một đoạn: hết Phase này, AI làm được GÌ mà hôm nay chưa làm được — góc nhìn người dùng, không
     phải danh sách module. Rồi bảng: mọi năng lực Phase giao, chia vào vòng nào.
     Đường intake: lấy đúng capability có cột Phase = Phase này ở CAPABILITIES-MAP.md.
     Đường phỏng vấn, MVP: chính là PRD §3 của vòng 1 + thứ Authority nói "sau đó sẽ cần".

     | Năng lực | Persona | Vòng | Xong Phase khi |
     | CAP-BOOK-01 Đặt lịch | P-OWNER | 1 | chủ gara tự đặt lịch không cần gọi điện |
-->

| Năng lực | Persona | Vòng | Xong Phase khi |
|---|---|---|---|
| _CHƯA ĐIỀN_ | | | |

### A2. Hướng giải pháp

<!-- Các lựa chọn LỚN quyết định hình dạng cả Phase — mỗi dòng một vấn đề, phương án chọn và
     phương án đã loại. Đây là chỗ Authority thấy giải pháp phức tạp TRƯỚC khi agent làm:
     đồng bộ hay hàng đợi, xoá mềm hay cứng, tính tiền ở đâu, đa tenant thế nào, tích hợp kiểu gì.
     Chỉ thứ khó đảo ngược hoặc ảnh hưởng nhiều vòng — không chép lại TECHSTACK.
     | Chống đặt trùng khung giờ | Ràng buộc unique (thợ, khung) ở DB + bắt lỗi ở API | Khoá ở tầng app | Hai request song song vẫn chặn được |
-->

| Vấn đề | Giải pháp chọn | Đã loại | Vì sao |
|---|---|---|---|
| _CHƯA ĐIỀN_ | | | |

### A3. Quy ước bắt buộc — pha I tuân thủ

<!-- Luật xuyên suốt mà MỌI vòng của Phase phải theo, viết đủ cụ thể để kiểm được: phân quyền,
     validate, xử lý lỗi, kiểu API, tiền tệ/làm tròn, múi giờ, migration, log, đặt tên dữ liệu,
     gọi dịch vụ ngoài. Mã G-<số> không tái dùng — DECISIONS, review và dogfood dẫn mã này.
     | G-1 | Mọi query theo id lọc thêm garage_id của người đang đăng nhập | srcroot/boundaries/** | breaker + reviewer |
     | G-2 | Thời gian lưu UTC, hiển thị Asia/Ho_Chi_Minh, định dạng dd/mm/yyyy HH:mm | mọi target | locale |
-->

| Mã | Quy ước | Áp cho | Kiểm bằng |
|---|---|---|---|
| G-1 | _CHƯA ĐIỀN_ | | |

### A4. Yêu cầu phi chức năng — có số

<!-- Chỉ thứ Phase này thật sự cần, kèm con số và cách đo: thời gian phản hồi, số người dùng
     đồng thời, dung lượng dữ liệu, sẵn sàng, sao lưu, trợ năng, thiết bị/trình duyệt hỗ trợ.
     | Thời gian mở danh sách lịch | < 1 giây với 500 lịch | đo ở dogfood power |
-->

| Hạng mục | Mức yêu cầu | Đo bằng |
|---|---|---|
| _CHƯA ĐIỀN_ | | |

### A5. Rủi ro lớn của Phase

| Rủi ro | Khả năng × tác động | Phòng ngừa | Nếu xảy ra |
|---|---|---|---|
| _CHƯA ĐIỀN_ | | | |

### A6. Điều chỉnh giữa Phase

<!-- Thực tế các vòng làm lệch phần A → một dòng ở đây + 1 dòng DECISIONS. Đổi lớn (A2) giữa
     Phase là chỗ phải trình Authority ở pha V của vòng sau. -->

| Ngày | Vòng | Đổi gì | Vì sao |
|---|---|---|---|

## B. Giải pháp chi tiết vòng này

Vòng: 1

### B1. Giải pháp theo AC

<!-- MỖI AC của PRD.md §3 một dòng — gate kiểm đủ. Viết tới mức builder ở pha I không phải đoán:
     target nào đổi, endpoint/contract nào, bảng/cột nào, màn/component nào, ca biên nào phải xử
     và kiểm chứng bằng gì (test, vai dogfood). Dẫn mã quy ước A3 khi áp dụng.
     | AC-2 | boundaries/booking: POST /bookings + unique (mechanic_id, slot_start) · web: S2 form đặt lịch (C3 nút gửi khoá khi đang gửi) | trùng khung → 409 + "Khung giờ đã có người đặt" · G-1 | test API trùng giờ · dogfood rushed + concurrent |
-->

| AC | Thay đổi (target · API/contract · dữ liệu · màn/component) | Ca biên phải xử · quy ước | Kiểm chứng |
|---|---|---|---|
| AC-1 | _CHƯA ĐIỀN_ | | |

### B2. Thay đổi kỹ thuật của vòng

<!-- Migration, contract mới/đổi giữa target, biến môi trường mới, dịch vụ ngoài mới, job/cron.
     Vòng ≥2: cột tương thích ngược đối chiếu BACKWARD-COMPATIBILITY-CHECKLIST.md §2.
     Không có thì một dòng "—". -->

| Loại | Thay đổi | Tương thích ngược |
|---|---|---|
| _CHƯA ĐIỀN_ | | |
