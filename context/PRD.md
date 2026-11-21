---
type: prd
tier: T0
status: DRAFT
last_reviewed: "2026-11-21"
---

# PRD — hugremote

> **Mô tả sản phẩm ở lát cắt của VÒNG HIỆN TẠI.** Điền ở pha V. Sau khi khoá scope, file này là nguồn sự thật cho mọi quyết định của agent.
> Cấu trúc §1–§6 lấy theo `intake/_PRD-TEMPLATE.md` để hai đường vào dùng chung một khung.
> Xoá hết dòng `_CHƯA ĐIỀN_` khi điền xong — `python3 scripts/gate.py V` bắt dấu này.

---

## 1. Pain point

_CHƯA ĐIỀN_

<!-- Một đoạn. Vấn đề CỤ THỂ đang làm ai đó khó chịu, mất thời gian, hoặc mất tiền.
     Không viết "chưa có giải pháp tốt" — viết cái đau thật, kèm bằng chứng nếu có.
     Ví dụ: "Chủ gara nhỏ ghi lịch hẹn sửa xe bằng sổ giấy và Zalo. Trùng lịch 2-3 lần/tuần,
     mỗi lần mất khoảng 1 giờ gọi lại khách và xếp lại thợ."
     Đường intake: giữ nguyên ý của intake/PRD.md §1, KHÔNG paraphrase. -->

## 2. Đối tượng

_CHƯA ĐIỀN_

<!-- CỤ THỂ, không phải "người dùng nói chung". Ai? Bao nhiêu người kiểu này? Họ đang xoay xở bằng gì?
     Ví dụ: "Chủ gara 3-10 thợ ở TP lớn. Hiện dùng sổ giấy + Zalo. Không có nhân viên IT."
     Đường intake: tóm tắt từ intake/PRD.md §2, giữ mã P-… -->

Chân dung chi tiết + năng lực từng vai + ma trận phân quyền: `context/PERSONAS.md`.

## 3. Tiêu chí chấp nhận (AC) — vòng này

<!-- Làm được những cái này thì coi như xong vòng hiện tại. Viết theo góc nhìn người dùng,
     quan sát được. Đánh số AC-1..AC-n — agent tham chiếu số này trong DECISIONS và test.

     SỐ LƯỢNG khác nhau theo đường vào (VIPER.md §1.3):
     · Đường phỏng vấn — 3 đến 7. Nhiều hơn 7 là scope quá lớn cho một tuần, gate V báo đỏ.
     · Đường intake   — không có trần. Đổi lại mỗi AC phải điền cột "Capability" và mã đó
       phải có mặt trong CAPABILITIES-MAP.md; gate V kiểm truy vết này thay cho trần số.

     Cột "Capability": đường phỏng vấn để trống. -->

| # | Làm được gì | Coi là xong khi | Capability |
|---|---|---|---|
| AC-1 | _CHƯA ĐIỀN_ | | |
| AC-2 | _CHƯA ĐIỀN_ | | |
| AC-3 | _CHƯA ĐIỀN_ | | |

<!-- Dòng AC trống không được gate đếm — điền đủ ô "Làm được gì" hoặc xoá dòng thừa. -->

## 4. Ưu tiên — vòng này giao gì, phần còn lại nằm đâu

<!-- Đường phỏng vấn: một dòng — "Vòng 1 giao toàn bộ AC ở §3; phần khác ở ROADMAP.md §3 backlog".
     Đường intake: một đoạn ngắn nói rõ vòng này là lát cắt nào của hệ thống (thường = một
     wave của intake/ROADMAP.md), vì sao lát này trước. Bản đồ đầy đủ ở CAPABILITIES-MAP.md,
     kế hoạch chia vòng ở ROADMAP.md §1. -->

_CHƯA ĐIỀN_

## 5. Out-of-scope — chắc chắn KHÔNG làm ở vòng này

<!-- Đây là phần quan trọng nhất của scope-lock. Liệt kê tường minh những thứ dễ bị cuốn vào làm.
     Mọi thứ ở đây, nếu sau này thấy cần, đi thẳng vào ROADMAP.md — không chèn vào vòng này. -->

- _CHƯA ĐIỀN_

## 6. Giả thuyết + success metric

_CHƯA ĐIỀN_

<!-- MỘT con số, đo được, có ngưỡng quyết định. Đây là căn cứ go/pivot/kill ở pha R.
     Ví dụ: "≥10 gara tạo lịch hẹn thật trong 5 ngày đầu. <5 → kill. 5-9 → pivot cách tiếp cận."

     Đường intake: chọn MỘT giả thuyết đo được từ intake/PRD.md §6 làm metric; các giả thuyết
     còn lại vào sổ EXPERIMENTS của vòng. Vòng KHÔNG chạy pha E (theo _PROPOSAL.md) thì ghi
     "vòng này không đo — tiêu chí xong là AC §3" và nói rõ vòng nào sẽ đo. -->

---

## 7. Quyết định đã chốt ở pha V

<!-- Chốt luôn ở đây để agent không phải hỏi lại. Thiếu mục nào, agent tự quyết + ghi DECISIONS.md.
     Đây là thứ giữ luật #2 đứng được: sau khoá scope không hỏi nữa, nên chỗ hay phải hỏi
     nhất phải có câu trả lời sẵn ngay tại đây. -->

| Hạng mục | Chốt |
|---|---|
| Đăng nhập | _CHƯA ĐIỀN_ (không cần / email OTP / Google / provider nào) |
| Thu tiền | _CHƯA ĐIỀN_ (không / có — cách tính) |
| Mô hình dữ liệu lõi | _CHƯA ĐIỀN_ (các thực thể chính + quan hệ) |
| Ca biên phải xử | _CHƯA ĐIỀN_ (trùng, xoá, sửa, đồng thời) |
| Trạng thái rỗng | _CHƯA ĐIỀN_ (hiển thị gì khi chưa có dữ liệu) |
| Trạng thái lỗi | _CHƯA ĐIỀN_ (mất mạng, API fail — hiển thị gì) |
| Dữ liệu mẫu | _CHƯA ĐIỀN_ (lấy đâu để dùng thử) |
| Tên / domain / giọng | _CHƯA ĐIỀN_ |
| Nơi deploy | _CHƯA ĐIỀN_ |

## 8. Nguồn

<!-- Đường phỏng vấn: `context/INTERVIEW.md` (14 mục có bằng chứng).
     Đường intake: liệt kê file intake đã dịch — bảng truy vết đầy đủ ở INTERVIEW.md;
     vòng ≥2 thêm `intake/loops/l<N>/_PROPOSAL.md` + tài liệu Authority thả thêm. -->

- _CHƯA ĐIỀN_

---

## 9. Change log

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-21 | Tạo từ template VIPER | — |
