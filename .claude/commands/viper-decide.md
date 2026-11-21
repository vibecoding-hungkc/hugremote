---
description: Append một dòng vào DECISIONS.md — thứ thay thế cho việc hỏi Authority
---

# /viper-decide

Ghi một quyết định. Đây là **nghi thức thay cho câu hỏi** (luật #2): thay vì dừng lại hỏi, tự quyết rồi để lại vết ở đây cho Authority đọc theo lô cuối buổi.

Cũng dùng ở pha R để ghi quyết định go / pivot / kill.

## Khi nào phải ghi

Stack, thư viện chính, mô hình dữ liệu, cách tính tiền, auth, cách xử ca biên, đánh đổi hiệu năng — bất cứ thứ gì mà ba ngày sau nhìn lại sẽ hỏi "sao lúc đó làm thế?".

## Khi nào không cần

Đặt tên biến, chia file, chọn thư viện tiện ích nhỏ đổi lúc nào cũng được. Ghi mọi thứ thì `DECISIONS.md` thành nhật ký, không ai đọc, mất luôn tác dụng.

## Cách ghi

Append vào `context/DECISIONS.md`, **không sửa dòng cũ**. Quyết định mới đè quyết định cũ → thêm dòng mới ghi `thay cho: <ngày>`.

```markdown
| <ngày> | <quyết định> | <lý do> | <giả định đang mang> | <đảo ngược được?> |
```

| Cột | Viết gì |
|---|---|
| Quyết định | Cụ thể, làm được. "Xoá mềm cho đơn hàng" — không phải "cải thiện cách xoá" |
| Lý do | Ràng buộc thật, dẫn về AC/PRD nếu có |
| Giả định | Điều đang tin là đúng mà chưa kiểm chứng. **Cột quan trọng nhất** — nó cho Authority biết chỗ nào cần soi |
| Đảo ngược được? | Có / Khó (nói rõ khó ở đâu) / Không |

## Ví dụ

```markdown
| 2026-08-01 | Xoá mềm thay vì xoá cứng cho lịch hẹn | AC-4 nhắc "huỷ nhầm phải khôi phục được" | Lượng bản ghi nhỏ, không lo phình bảng trong Phase 1 | Có — đổi sang xoá cứng kèm migration |
| 2026-08-01 | Clerk cho auth thay vì Auth.js | 20 phút thay vì 1-2 tiếng; PRD §7 chốt đăng nhập Google | Chấp nhận phụ thuộc bên thứ ba + chi phí khi scale | Khó — đổi provider phải migrate user |
| 2026-08-01 | Không làm thông báo email tuần này | Ngoài AC; đẩy ROADMAP Phase 2 | Người dùng chấp nhận tự vào xem trong tuần đầu | Có |
```

## Ở pha R

Quyết định cuối tuần ghi thêm một dòng, và copy vào sổ EXPERIMENTS của vòng (vòng 1: `EXPERIMENTS.md`; vòng N ≥2: `EXPERIMENTS-v<N>.md`), mục `§Quyết định cuối tuần`:

```markdown
| <ngày> | GO / PIVOT / KILL cho Phase 2 | <số liệu thật vs ngưỡng ở PRD §6> | <giả định còn lại> | — |
```

Kèm theo: cập nhật `ROADMAP.md` (§1 kế hoạch vòng nếu đường intake, §3 backlog) với việc cụ thể (nếu GO), hoặc ghi rõ dừng ở đâu và giữ lại gì (nếu KILL). GO / PIVOT → mở vòng mới bằng `/viper-repeat` — không code tiếp trên vết vòng cũ.
