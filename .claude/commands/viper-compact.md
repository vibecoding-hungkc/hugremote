---
description: Vệ sinh tài liệu context/ — chạy báo cáo, gấp phần đã hết hiệu lực vào archive/ledger/ bằng tay, xác nhận gate không đỏ thêm
---

# /viper-compact — dọn sổ mà không phá mỏ neo

> **Không thuộc 5 pha.** Chạy lúc nào cũng được; đáng chạy nhất ở pha R, **trước** khi
> `/viper-repeat` quay vòng (`repeat.py --go` đòi working tree sạch).
> Không hỏi Authority trong suốt lệnh này.

VIPER cố ý **không reset** tài liệu khi quay vòng ([VIPER.md §1.2](../../VIPER.md)) — reset là mất trí nhớ giữa các vòng. Cái giá phải trả: sau 5–7 vòng, các sổ chỉ-thêm-không-bớt dài tới mức không ai đọc nữa, và tài liệu không ai đọc thì vô dụng y như tài liệu không có.

## Bước 1 — Đọc báo cáo

```bash
python3 scripts/compact.py
```

Chỉ đọc, không sửa gì, luôn exit 0. Ba phần:

| Phần | Là gì | Làm gì |
|---|---|---|
| **A. Rác tích tụ** | Dòng đã hết hiệu lực với gate, kèm đích gấp | Gấp ở Bước 2 |
| **B. Mục mồ côi** | Token chết, component trỏ màn không còn, AC lệch giữa PRD và ROADMAP, link gãy, `_CHƯA ĐIỀN_` sót | Sửa tay — đây là **lỗi**, không phải rác |
| **C. Dòng neo** | Thứ gate đang đọc bằng regex | **Đọc trước khi đụng vào bất cứ gì** |

## Bước 2 — Gấp bằng tay

Đích: `context/archive/ledger/<DOC>.md`, tạo tay khi cần. **Không** đổ vào `context/archive/vong-<N>/` — thư mục đó là snapshot theo vòng và kiêm luôn cờ "vòng N đã đóng" (`repeat.py` dựa vào sự tồn tại của nó để không đóng vòng hai lần).

Mỗi lần gấp: **cắt** dòng khỏi file sống, **dán** vào file ledger tương ứng, và để lại **một dòng trỏ** ở chỗ cũ:

```markdown
<!-- Dòng của vòng 1–4 đã gấp: context/archive/ledger/DECISIONS.md -->
```

Ba luật, vi phạm cái nào cũng hỏng:

1. **Không đụng bất cứ thứ gì ở phần C.** Nặng nhất là dòng chốt stack trong `DECISIONS.md` — `gate.py V` grep **cả file** tìm nó ở **mọi vòng**, xoá là gate V đỏ vĩnh viễn và không có đường sửa ngoài viết tay lại.
2. **Không gấp bằng cách bọc `<!-- -->`.** `read_live()` bỏ sạch comment trước khi đếm, nên nội dung bọc comment **biến mất khỏi mọi phép đếm của gate** trong khi nhìn file vẫn thấy nó — kiểu hỏng khó tìm nhất. Muốn giữ thì **chuyển sang ledger**, đừng giấu tại chỗ.
3. **Đừng đụng tiêu đề `##`.** Nhiều tiêu đề là mỏ neo regex (phần C liệt kê đủ). Đổi chữ hay đổi số là gate mù ngay, mà mù **im lặng**.

Phần B thì sửa thật, đừng gấp: token không ai dùng thì xoá khỏi §2 (hoặc dùng nó), component trỏ màn không còn thì sửa ô "Dùng ở màn", AC lệch giữa `PRD §3` và `ROADMAP §2` thì đồng bộ lại.

## Bước 3 — Xác nhận không làm hỏng gì

```bash
python3 scripts/gate.py            # pha hiện tại
python3 scripts/gate.py V          # và pha V, vì phần lớn mỏ neo nằm ở gate V
python3 scripts/compact.py         # phần A đã vơi, phần B đã sạch
```

**Kết quả phải giống hệt trước khi gấp.** Đỏ thêm một mục nào là đã cắt nhầm một mỏ neo — `git diff` để tìm, khôi phục dòng đó, rồi chạy lại. Đây là lý do lệnh này bắt chạy gate **trước và sau**, không phải chỉ sau.

## Bước 4 — Commit riêng

Commit một mình, đừng trộn với thay đổi code:

```
vệ sinh tài liệu vòng <N> — gấp <x> dòng vào archive/ledger/, sửa <y> mục mồ côi
```

Gấp lẫn vào commit tính năng thì lần sau ai đó thấy gate đỏ sẽ không biết đỏ vì code hay vì dọn nhầm.

## Ranh giới

- **Không dọn khi đang giữa pha I hoặc P.** Đang code mà tài liệu đổi chỗ thì mất dấu; dọn ở pha R hoặc đầu pha V.
- **Không gấp sổ EXPERIMENTS của vòng hiện tại và vòng ngay trước.** Pha R còn đọc chúng để quyết go/pivot/kill, và dogfood vòng ≥2 còn đọc `archive/vong-*/PRD.md` cho lượt regression.
- **Không xoá `context/archive/vong-<N>/`.** Đó là cờ "vòng N đã đóng"; mất nó thì `repeat.py --go` chạy lại được lần hai trên cùng một vòng.
- **Không tự sửa `compact.py` cho nó ghi hộ.** Đoán sai một lần trên sổ append-only là mất vĩnh viễn thứ không ai nhớ để khôi phục — đó là lý do nó không có `--go`.
