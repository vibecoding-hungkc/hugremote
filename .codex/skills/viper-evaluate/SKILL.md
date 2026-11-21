---
name: viper-evaluate
description: "Pha E — đọc số liệu, thu phản hồi, fix bug, tối ưu, thử nghiệm — CHỈ chạy khi người dùng gõ /viper-evaluate hoặc $viper-evaluate."
---

# /viper-evaluate — Pha E

> **LUẬT #2 — KHÔNG HỎI AUTHORITY.** Mơ hồ → tự quyết + ghi `DECISIONS.md`.
> Tính năng mới → `ROADMAP.md` backlog, không chèn vào vòng này.

## Bước 0 — Vòng này có chạy pha E không?

**Chế độ intake** (`context/INTERVIEW.md` mang `NGUỒN: INTAKE`): `intake/loops/l<N>/_PROPOSAL.md` dòng `Pha vòng này` không có `E` → dừng tại đây, đi `/viper-repeat`. Vòng chưa deploy thì không có người dùng thật, không có gì để đo ([VIPER.md §1.4](../../VIPER.md)); `gate.py E` cũng tự bỏ qua.

**Đường phỏng vấn**: pha này **tuỳ chọn** và lặp lại được, chạy từ D2 đến D5.

Đi tiếp thì **việc đầu tiên**: sửa `STATE.md` → `Pha hiện tại : E` — hook `guard_ask` + `gate.py` đọc dòng này.

Mỗi lần chạy là một lượt: đọc số → chọn một việc → làm → đo lại. (Lượt ở đây không phải "vòng" V-I-P-E-R.)

Sản phẩm dựng ra để **trả lời một câu hỏi**, không phải để tồn tại. Pha này là lúc lấy câu trả lời.

## Bước 1 — Đọc số liệu

```
Analytics       → truy cập, nguồn đến
Event tracking  → bắt đầu luồng lõi / hoàn tất / bỏ giữa chừng ở bước nào / quay lại
Error tracking  → lỗi gì đang xảy ra với người dùng thật
Kênh feedback   → họ nói gì
```

Ghi vào **sổ EXPERIMENTS của vòng**, mục `§Số liệu theo ngày` — vòng 1: `context/EXPERIMENTS.md`; vòng N ≥2: `context/EXPERIMENTS-v<N>.md` (`repeat.py` tạo khi mở vòng; sổ vòng cũ nguyên vẹn, đọc trực tiếp làm insight). Phản hồi người dùng ghi **nguyên văn**, không tóm tắt theo ý mình — câu chửi có giá trị hơn lời khen, và tóm tắt là chỗ thiên kiến chui vào.

## Bước 2 — Đối chiếu giả thuyết

Mở sổ EXPERIMENTS của vòng, mục `§Giả thuyết`. Với mỗi giả thuyết: số liệu đang nói nó đúng, sai, hay chưa đủ dữ liệu để nói gì?

**Ngưỡng đã ghi từ trước** (`PRD.md §6`). Không sửa ngưỡng sau khi nhìn số — đó là cách tự lừa mình một cách lịch sự.

Chưa đủ dữ liệu là một kết luận hợp lệ. Ghi vậy, đừng ép ra kết luận.

## Bước 3 — Chọn đúng MỘT việc

Xếp theo thứ tự này, làm việc đầu tiên gặp:

| Ưu tiên | Loại | Ví dụ |
|---|---|---|
| 1 | Lỗi chặn người dùng dùng được | Lỗi trong error tracking, luồng lõi gãy |
| 2 | Chỗ người dùng gãy nhiều nhất | Tỷ lệ bỏ cao ở một bước cụ thể |
| 3 | Thứ họ hỏi/kêu nhiều nhất | Cùng một góp ý lặp lại ≥3 lần |
| 4 | Đo thêm thứ đang mù | Không biết vì sao họ rời đi |
| 5 | Tối ưu | Tốc độ, giao diện |

Làm **một** việc rồi đo lại. Làm năm việc cùng lúc thì số liệu đổi mà không biết vì cái nào.

Việc chọn là tính năng mới → **không phải việc của pha E**. Đẩy `ROADMAP.md` backlog.

## Bước 4 — Làm

Vẫn theo `CONVENTIONS.md`. Đổi thứ động tới người dùng → `make check && make test` rồi deploy.

Thử nghiệm có chủ đích (đổi cách diễn đạt, đổi thứ tự bước, bỏ một trường) → ghi trước vào sổ EXPERIMENTS của vòng, mục `§Thử nghiệm đã chạy`: thử gì, vì sao, kỳ vọng thấy gì.

## Bước 5 — Đo lại

Deploy xong → dùng thử lại phần vừa đổi (không cần chạy đủ `/viper-dogfood` cho thay đổi nhỏ, nhưng phải tự bấm thử).

Ghi kết quả vào sổ EXPERIMENTS của vòng. Đổi rồi mà số không nhúc nhích cũng là kết quả — ghi lại, đừng lặng lẽ bỏ qua.

## Bước 6 — Vòng tiếp hoặc dừng

- Còn thời gian trong tuần và còn việc ưu tiên cao → chạy lại `/viper-evaluate`
- Hết tuần, hoặc số liệu đã đủ để quyết → `/viper-repeat` cho pha R: quyết go/pivot/kill, quay video demo cuối vòng (`VIPER.md §1.5`); GO/PIVOT thì đóng vòng này, mở vòng mới

## Ranh giới

- Không thêm tính năng. Đây là pha học, không phải pha xây.
- Không refactor lớn. Chưa biết sản phẩm có sống không thì đừng dọn nhà.
- Không sửa ngưỡng quyết định sau khi nhìn số liệu.
- Không tóm tắt phản hồi người dùng thành thứ dễ nghe hơn.
