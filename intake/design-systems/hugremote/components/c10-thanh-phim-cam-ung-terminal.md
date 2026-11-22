# C10 — Thanh phím cảm ứng terminal

| Field | Value |
|---|---|
| Mã | C10 |
| Nhóm | input |
| Mục đích | Cho gõ được các phím shell/TUI mà bàn phím ảo không có (Esc, Tab, Ctrl, mũi tên, F1–F12) mà không bị bàn phím ảo che mất vùng terminal |
| Màn hình dùng | S6 |
| Persona chạm tới | P-MOBILE, P-TEAM |
| Hiện thực prototype | class `.keybar` (ẩn mặc định, chỉ `display:block` dưới 768px) > `.keys` (hàng chính, cuộn ngang) + `.drawer` (ngăn mở rộng, nhóm theo `.grp`) — dựng bằng hàm `keybar()` (dòng 1046); mỗi phím là `.key` qua hàm con `k(label, cls, act, title)`; giữ Ctrl là toggle trạng thái `ui.ctrl` (`.key.on`) |
| Hiện thực pha I | `apps/web/src/components/ui/TerminalKeybar.tsx` — `expanded: boolean; onToggleExpand: () => void; ctrlHeld: boolean; onToggleCtrl: () => void; onKey: (code: string) => void` |

## Giải phẫu

Thứ tự đọc, **hàng chính luôn hiện** (không cuộn dọc, chỉ ngang khi tràn): `^C` → `Esc` → `Tab` → `Ctrl` (toggle giữ) → `↑` `↓` `←` `→` → `↵` → icon mở/thu ngăn mở rộng (cuối hàng). **Ngăn mở rộng** (khi mở) xếp theo nhóm có nhãn nhỏ phía trên mỗi nhóm: Tổ hợp Ctrl (`^D ^Z ^L ^A ^E ^W ^U ^K ^R`) → Phím chức năng F1–F12 → Ký tự shell (`| > && ~ / - $ * " ' { } ( ) [ ]`) → Lệnh nhanh (`ls -la ↵`, `cd .. ↵`, `git status ↵`, `clear ↵`, `claude ↵`) → Cuộn (`Home End PgUp PgDn`).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| thu gọn | ✓ | Chỉ hàng chính hiện; icon cuối hàng mở ngăn |
| mở rộng | ✓ | Thêm `.drawer` bên dưới hàng chính, các nhóm phím hiển thị đầy đủ |
| Ctrl đang giữ | ✓ | `.key.on` — nền `--color-primary`, chữ `--color-on-primary`, viền `--color-primary`; phím kế tiếp gõ sẽ kèm Ctrl |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền thanh | `--color-surface` |
| Viền trên thanh | `--color-divider` |
| Nền phím mặc định | `--color-surface-raised` |
| Viền phím | `--color-divider` |
| Nền/chữ phím đang giữ (Ctrl) | `--color-primary` / `--color-on-primary` |
| Chiều rộng/cao tối thiểu phím | `--tap` |
| Bo góc phím | `--radius` |
| Font phím | `--font-mono` |
| Cỡ chữ phím | `--text-sm` |
| Chữ nhãn nhóm trong ngăn | `--color-text-muted` (`--text-xs`) |
| Đệm thanh | `--space-xs` |
| Khoảng cách phím | `--space-xs` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| hàng chính | Cố định 10 phím/icon, không nhóm, cuộn ngang nếu màn quá hẹp |
| ngăn mở rộng | Phím xếp theo nhóm có nhãn, tự xuống dòng (`flex-wrap:wrap`) thay vì cuộn ngang |

## Tiếp cận (a11y)

Mỗi phím vùng chạm tối thiểu `--tap` (44×44px). Phím mang nhãn văn bản thật (`^C`, `Esc`…) chứ không chỉ icon — tự đủ nghĩa cho trình đọc màn hình. Phím icon duy nhất (mở/thu ngăn) có `title`/`aria-label` nêu rõ "Thêm phím: Ctrl, F1–F12, ký tự shell, lệnh nhanh" khi thu, "Thu gọn bảng phím" khi mở. Chạm vào vùng terminal (không phải thanh phím) mở bàn phím ảo hệ thống — khi đó vùng terminal phải tự co theo `visualViewport` để dòng con trỏ luôn thấy (AC-11), không để bàn phím ảo đè lên.

## Không được làm

- Không hiện thanh phím này trên desktop (≥768px) — `.keybar { display:none }` mặc định, chỉ bật trong media query hẹp.
- Không gộp hàng chính và ngăn mở rộng thành một khối cuộn dọc — ngăn mở rộng phải xếp lưới (`wrap`) để thấy hết nhóm mà không cuộn.
- Không bỏ nhãn chữ trên phím để thay toàn bộ bằng icon — developer cần đọc đúng tên phím khi gõ nhanh.
