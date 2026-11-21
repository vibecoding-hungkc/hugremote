---
type: dogfood-plan
tier: T1
last_reviewed: "2026-11-21"
---

# DOGFOOD PLAN — hugremote

> **Lập ở pha V của MỖI vòng, trước khi khoá scope** — viết lại cho vòng mới, không nối thêm (bản vòng
> trước: `context/archive/vong-N/`). `/viper-dogfood` chạy đúng theo file này. `gate.py V` kiểm §1–§3,
> `gate.py I` / `P2` kiểm §4. Danh mục vai, tín hiệu bật, luật chia đợt: skill `viper-roles`.
> **Một trang.** Authority đọc §1–§2 để biết vòng này được thử bằng con mắt nào.

Vòng: 1

## 1. Chọn vai

<!-- MỌI vai trong danh mục (.claude/skills/viper-roles/roles/) một dòng — tắt cũng phải có căn cứ, để
     thấy là đã cân nhắc chứ không phải quên. Không vai nào bật mặc định, TRỪ `smoke` — luôn bật.
     Cột Bật: `bật` | `tắt`. Căn cứ trỏ tín hiệu thật, kèm file + mục:
       | `mobile` | tắt | PERSONAS §1 — cả hai persona dùng máy tính tại quầy; PRD không đòi responsive |
       | `money`  | bật | PRD §7 — thu cọc 50.000 ₫ khi đặt lịch, vòng này đưa thanh toán vào |
     Có experience ở ARCHITECTURE §3 (app mobile) → `mobile` phải bật. Marker KHÔNG CÓ UI →
     `picky`, `mobile`, `a11y` phải tắt. Vai ngoài danh mục: thêm thẻ trước (viper-roles §5). -->

| Vai | Bật | Căn cứ |
|---|---|---|
| `smoke` | bật | luôn bật — luồng lõi và mọi AC đã giao không được gãy |
| `newbie` | _CHƯA ĐIỀN_ | |
| `edge` | _CHƯA ĐIỀN_ | |
| `picky` | _CHƯA ĐIỀN_ | |
| `a11y` | _CHƯA ĐIỀN_ | |
| `locale` | _CHƯA ĐIỀN_ | |
| `mobile` | _CHƯA ĐIỀN_ | |
| `power` | _CHƯA ĐIỀN_ | |
| `rushed` | _CHƯA ĐIỀN_ | |
| `breaker` | _CHƯA ĐIỀN_ | |
| `concurrent` | _CHƯA ĐIỀN_ | |
| `money` | _CHƯA ĐIỀN_ | |
| `operator` | _CHƯA ĐIỀN_ | |
| `integrator` | _CHƯA ĐIỀN_ | |

## 2. Vai bật làm gì

<!-- Một dòng cho MỖI vai bật ở §1. Đợt 0 = `smoke` một mình, chạy ĐẦU TIÊN (gãy luồng lõi thì sửa trước).
     Đợt ≥1: tối đa 3 vai một đợt (3 khe); vai cần cảnh sạch đi trước, vai ghi dữ liệu chung đi sau,
     seed lại giữa đợt. Tài khoản: mỗi vai một cái, không dùng chung (seed: deployment/local/README.md).
     "Việc vòng này": soi AC/luồng/màn NÀO của vòng này — không chép lại kịch bản của thẻ vai.
       | `money` | 2 | P-OWNER | `money@dogfood.local` | shop-web · localhost:3000 | AC-4 thanh toán cọc: cổng lỗi, bấm 2 lần, hoàn cọc khi huỷ | -->

| Vai | Đợt | Persona | Tài khoản | Nơi thử | Việc vòng này |
|---|---|---|---|---|---|
| `smoke` | 0 | _CHƯA ĐIỀN_ | `smoke@dogfood.local` | | đi hết §3 |

## 3. Danh sách smoke hồi quy

<!-- Luồng lõi (ARCHITECTURE §7) + MỌI AC đã giao ở các vòng trước (archive/vong-*/PRD.md §3) + AC vòng
     này. Mỗi dòng 2–4 bước, chấm được PASS/FAIL. Vòng ≥2 bắt buộc có dòng "Từ vòng" nhỏ hơn vòng hiện
     tại — đó là phần HỒI QUY. Không bao giờ xoá dòng của vòng cũ chỉ vì nó không đổi: không đổi mới
     là thứ cần giữ.
       | 3 | AC-2 (vòng 1) — không đặt trùng giờ | 1 | owner → đặt 9:00 thợ A → đặt lại 9:00 thợ A | báo trùng, không tạo lịch | -->

| # | Luồng / AC | Từ vòng | Bước kiểm | Kỳ vọng |
|---|---|---|---|---|
| 1 | _CHƯA ĐIỀN_ (luồng lõi) | 1 | | |

## 4. Kết quả

<!-- /viper-dogfood ghi — mỗi lượt của mỗi vai một dòng. Nơi: `local` (pha I) | `production` (pha P2).
     Trình duyệt: đúng như dòng đầu báo cáo của khe (mcp__pw-slot-k__ · mobile · curl). `smoke` có hai
     dòng mỗi pha: lượt đầu (đợt 0) và lượt cuối sau khi sửa. -->

| Ngày | Vai | Nơi | Trình duyệt | Nặng | Vừa | Nhẹ | Ghi chú |
|---|---|---|---|---|---|---|---|
