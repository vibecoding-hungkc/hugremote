---
type: decisions
tier: T1
append_only: true
last_reviewed: "2026-11-21"
---

# DECISIONS — hugremote

> **Append-only.** Không sửa dòng cũ; quyết định mới đè quyết định cũ thì thêm dòng mới và ghi `thay cho: <ngày>`.
>
> File này **thay thế cho việc hỏi Authority**. Từ pha I trở đi, gặp mơ hồ → chọn phương án hợp lý nhất theo
> `PRD.md` / `ARCHITECTURE.md` / `TECHSTACK.md` → ghi một dòng ở đây → đi tiếp.
> Authority đọc một lượt cuối buổi, không bị ngắt giữa dòng.

**Khi nào phải ghi**: stack, thư viện chính, mô hình dữ liệu, cách tính tiền, auth, cách xử ca biên, đánh đổi hiệu năng, bất cứ thứ gì mà 3 ngày sau nhìn lại sẽ hỏi "sao lúc đó làm thế?".

**Khi nào không cần**: đặt tên biến, chia file, chọn thư viện tiện ích nhỏ đổi lúc nào cũng được.

---

| Ngày | Quyết định | Lý do | Giả định đang mang | Đảo ngược được? |
|---|---|---|---|---|
| (template) | Dùng quy trình VIPER cho dự án này | Sản phẩm nhỏ, solo, cần ra trong 1 tuần để test phản ứng | Phạm vi khoá được trong 2h ở pha V | Có — chuyển sang MESH nếu vượt ngưỡng |

<!-- Dòng seed trên cố ý ghi ngày là "(template)" để gate V KHÔNG đếm nó —
     gate đòi ≥2 quyết định có ngày ISO do chính dự án này ghi ra. -->

<!-- Mẫu dòng:
| 2026-08-01 | Xoá mềm thay vì xoá cứng cho đơn hàng | Cần khôi phục khi khách gọi lại; AC-4 nhắc "huỷ nhầm" | Lượng đơn nhỏ, không lo phình bảng trong Phase 1 | Có — đổi sang xoá cứng kèm migration |
| 2026-08-01 | Clerk cho auth thay vì tự viết | Mất 20 phút thay vì 1 ngày; PRD §7 chốt đăng nhập Google | Chấp nhận phụ thuộc bên thứ ba + chi phí khi scale | Khó — đổi provider phải migrate user |
-->
