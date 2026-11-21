---
type: demos
tier: T2
---

# DEMOS — video demo cuối vòng

> Pha R của **mọi vòng**, cả hai đường vào, kể cả vòng intake chỉ V+I: quay một video đi trọn kịch bản
> demo của vòng trên sản phẩm thật, ghi một mục ở đây, rồi mới đóng vòng. `gate.py R` kiểm mục của vòng
> hiện tại; `repeat.py --go` từ chối quay vòng khi gate R còn đỏ. Luật: `VIPER.md §1.5` · cách quay:
> `/viper-repeat` Bước 2.
>
> Sổ **cộng dồn**, không reset, không archive: mỗi vòng thêm một mục `## Vòng N` ở cuối file, mục vòng
> cũ giữ nguyên. File demo nằm ở `demos/vong-<N>/` — video không commit (`.gitignore`), nên sổ này mới
> là vết trong git.

## Cách ghi một mục

| Dòng | Luật |
|---|---|
| `## Vòng N — <tên vòng>` | Đúng số vòng ở `STATE.md`; gate chỉ đọc mục của vòng hiện tại |
| `Ngày quay` | Sau `smoke` lượt cuối — video quay đúng thứ sẽ đóng vòng |
| `Môi trường` | **Bắt buộc.** Vòng đã deploy → `production <URL>` + tài khoản demo (không quay dữ liệu người dùng thật). Chưa deploy → `local` (`make dev`, seed mới tinh ở `deployment/local/`). Ghi commit đã quay |
| `Kịch bản` | *(intake)* `intake/loops/l<N>/_PROPOSAL.md §2` · *(phỏng vấn)* `PRD.md §3` theo thứ tự luồng lõi `ARCHITECTURE.md §7` |
| `Tệp` | Mọi file nằm ở `demos/vong-<N>/`, có thật, không rỗng — nhiều experience thì mỗi experience một file. Có UI → ít nhất một video (`.webm` · `.mp4` · `.mov`); `KHÔNG CÓ UI` → bản ghi terminal `.log` |
| Bảng bước | Mỗi bước = một chương video. **Mọi AC của vòng** (`PRD.md §3`) có mặt ít nhất ở một dòng; AC chỉ test bắt được → dòng `ngoài video` + tên test. Cột `Kết quả`: `✓` · `✓ test` · `dời — DECISIONS <ngày>` (AC không giao được, đã đẩy `ROADMAP.md`). Còn `✗` → gate R đỏ: sửa rồi quay lại |

Mẫu một mục (bỏ khối comment khi chép):

<!--
## Vòng 2 — Nhắc lịch trước hẹn

Ngày quay  : 2026-08-20
Môi trường : local — make dev, seed "gara-3-khach" · commit 3f2a9c1
Kịch bản   : intake/loops/l2/_PROPOSAL.md §2
Tệp        : demos/vong-2/web-owner.webm (2:41)

| Bước | Làm gì | Thấy gì | AC | Kết quả |
|---|---|---|---|---|
| 1 | Chủ gara mở Lịch tuần | 3 lịch hẹn seed, lịch anh Minh 9:00 thứ Hai | AC-1 | ✓ |
| 2 | Bật nhắc lịch cho lịch anh Minh | Nhãn "Sẽ nhắc 8:00 Chủ nhật" | AC-2 | ✓ |
| 3 | Đặt thêm lịch vào khung 9:00 thứ Hai | Báo "Khung giờ đã kín", lịch không thêm | AC-3 | ✓ |
| — | ngoài video: email nhắc không chứa số điện thoại — make test, ca reminder_no_phone | — | AC-4 | ✓ test |
-->

---

<!-- Mục của từng vòng nằm dưới đây — vòng mới thêm ở cuối, không sửa mục vòng cũ. -->
