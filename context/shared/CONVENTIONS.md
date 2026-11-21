---
type: conventions
tier: T2
last_reviewed: "2026-11-21"
---

# CONVENTIONS — hugremote

> Quy ước chung, không phụ thuộc stack. Quy ước riêng của stack nằm ở `.claude/skills/stack-<tên>/SKILL.md §3, §7`.
> Ngắn gọn có chủ đích — quy ước dài không ai đọc.

---

## 1. Cấu trúc

- Ranh giới module theo `ARCHITECTURE.md §8`. Để logic sai tầng là lỗi, không phải chuyện phong cách.
- Một file làm một việc. File quá 300 dòng là tín hiệu tách, không phải luật cứng.
- Chỉ **một tầng** chạm database.
- Gọi dịch vụ ngoài đi qua một chỗ duy nhất.

## 2. Giao diện (khi có UI)

- Màu / cỡ chữ / khoảng cách / bo góc lấy từ token `DESIGN-SYSTEM.md §2` — hardcode giá trị mới là lỗi, không phải chuyện thẩm mỹ.
- Khối UI lắp từ kho component `DESIGN-SYSTEM.md §4`; cần khối mới → thêm vào kho trước (kèm trạng thái bắt buộc), rồi mới dùng.
- Trạng thái rỗng / lỗi / đang tải theo khuôn `DESIGN-SYSTEM.md §5` — không tự chế kiểu báo lỗi riêng cho từng màn.
- Đổi token sau khi Authority đã chốt prototype → 1 dòng `DECISIONS.md` (luật #3).

## 3. Đặt tên

- Tên theo ngôn ngữ nghiệp vụ, không theo tầng kỹ thuật: `bookingConflict`, không phải `dataProcessor2`.
- Dùng đúng thuật ngữ trong `PRD.md`. PRD gọi "lịch hẹn" thì code là `appointment`, không phải chỗ `booking` chỗ `schedule`.
- Đặt tên bằng tiếng Anh cho identifier; tiếng Việt cho nội dung hiển thị và comment giải thích **vì sao**.

## 4. Comment

- Comment giải thích **vì sao**, không giải thích **cái gì** (code đã nói cái gì rồi).
- Chỗ nào làm khác lẽ thường → comment kèm tham chiếu: `// Xoá mềm — xem DECISIONS.md 2026-08-01`.
- Không để code chết dạng comment. Xoá đi, git nhớ hộ.

## 5. Xử lý lỗi

- Không nuốt lỗi. `catch` mà không log và không xử lý là cấm.
- Lỗi người dùng thấy: tiếng Việt, nói được **phải làm gì tiếp**, không hiện stack trace.
- Lỗi hệ thống: log đủ ngữ cảnh để lần lại (ai, làm gì, dữ liệu nào).

## 6. Git

- Commit nhỏ, một ý một commit.
- Message tiếng Việt, thể chủ động: `thêm màn hình tạo lịch hẹn`, không phải `updates`.
- Quyết định không hiển nhiên → commit kèm tham chiếu: `# DECISION: DECISIONS.md 2026-08-01`.
- Code lệch tài liệu → sửa tài liệu **trong cùng commit** (luật #4).

## 7. Phụ thuộc

- Thêm thư viện là một quyết định — ghi `DECISIONS.md` nếu nó động tới kiến trúc hoặc khó gỡ ra.
- Ưu tiên thứ có sẵn trong framework hơn thư viện mới.
- Không thêm thư viện chỉ để dùng một hàm.

## 8. Trước khi nói "xong"

```
make check   xanh
make test    xanh
/viper-dogfood đã chạy, phát hiện đã xử hoặc đã ghi vào STATE.md
```

Thiếu một trong ba là chưa xong (luật #8).
