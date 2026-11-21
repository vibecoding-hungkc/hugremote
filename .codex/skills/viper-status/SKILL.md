---
name: viper-status
description: "In trạng thái hiện tại — pha, gate còn thiếu, AC, blocker, quyết định gần đây — CHỈ chạy khi người dùng gõ /viper-status hoặc $viper-status."
---

# /viper-status

Đọc nhanh, không sửa gì. Dùng khi mở phiên mới, hoặc khi thấy rối không biết đang ở đâu.

## Chạy

```bash
python3 scripts/gate.py        # tự đọc pha từ STATE.md, in ✓/✗ từng mục
```

Rồi đọc thêm:

- `STATE.md` (khối trạng thái đầu file — pha, vòng, ngày, URL; blocker ở cuối)
- `context/INTERVIEW.md` — có marker `NGUỒN: INTAKE` không → **đường vào** là intake hay phỏng vấn
- `intake/loops/l<N>/_PROPOSAL.md` (chế độ intake) — dòng `Pha vòng này`, `UI vòng này`, phạm vi vòng
- `context/ROADMAP.md` — §1 kế hoạch vòng (đang ở vòng mấy trên tổng mấy), §2 đếm `☐` còn lại
- `context/DECISIONS.md` (5 dòng cuối)

## Báo cáo theo dạng này

```
Pha        : <V|I|P|E|R>  ngày <n>
Vòng       : <N> / <tổng theo ROADMAP §1, hoặc "—" nếu chưa lập kế hoạch>
Phase      : <tên> · mở ở vòng <N> · Authority chốt <ngày | CHƯA>   ← STATE + SOLUTION.md
Đường vào  : <phỏng vấn | intake>
Pha vòng này: <V, I | V, I, P | V, I, P, E, R>   ← intake: từ _PROPOSAL.md
Stack      : <tên>
Local      : <URL hoặc chưa có>
Production : <URL hoặc chưa có>

Gate <pha> : <x>/<y> mục xong
  ✗ <mục còn thiếu>

AC         : <x>/<y> xong
Blocker    : <số> — <tóm tắt>
Chưa xử từ dogfood: <số>

Việc tiếp theo: <một việc cụ thể>
```

## Quy tắc

- **"Việc tiếp theo" phải là một việc cụ thể**, không phải "tiếp tục pha I". Nói được ngay là bấm vào đâu làm gì.
- Có blocker → nêu lên đầu.
- Gate đã xanh hết mà `STATE.md` chưa chuyển pha → nói rõ nên chuyển.
- **Pha kế tiếp không nằm trong `Pha vòng này`** (chế độ intake) → nói rõ: vòng này xong ở pha I, việc tiếp theo là `/viper-repeat`, không phải `/viper-polish`.
- Không tự sửa `STATE.md` trong lệnh này. Chỉ đọc và báo.
