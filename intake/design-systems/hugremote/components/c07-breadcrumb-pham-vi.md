# C7 — Breadcrumb phạm vi

| Field | Value |
|---|---|
| Mã | C7 |
| Nhóm | điều hướng |
| Mục đích | Cho biết đang đứng ở đâu (`máy › dự án`) và, ở màn chọn thư mục, cho bấm lại từng cấp đường dẫn để nhảy lên |
| Màn hình dùng | S2, S5, S6, S8 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.crumb` (hàng icon + chữ đậm + dấu `›` muted, `overflow:hidden` + `.crumb b{text-overflow:ellipsis}`) — dùng tĩnh (không bấm được) trong `topbar()` cho phạm vi `máy › dự án`; dùng động (mỗi đoạn là `<a class="btn ghost sm">`) trong `S5()` cho đường dẫn thư mục |
| Hiện thực pha I | `apps/web/src/components/ui/ScopeBreadcrumb.tsx` — `segments: { label: string; href?: string }[]; icon?: IconName` (segment cuối không có `href` — đang đứng tại đó) |

## Giải phẫu

Thứ tự đọc: **icon phạm vi** (tuỳ chọn — home/server cho máy) → **tên máy** (đậm) → **dấu phân cách `›`** (muted) → **tên dự án** (đậm) → **đường dẫn đầy đủ** (tuỳ chọn, mono, muted, ẩn trên mobile — `hide-mobile`). Biến thể đường dẫn thư mục (S5) lặp lại mẫu `segment <span class="sep">/</span> segment`, mỗi segment là một nút bấm được dẫn lên đúng cấp đó.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| thường | ✓ | Vừa đủ rộng, không cắt chữ |
| rút gọn giữa khi quá dài | ✓ | Đường dẫn rút gọn **ở giữa**: giữ phần đầu (gốc) và phần cuối (thư mục/file đang ở), giữa là `…` (hàm `midTrunc(path, 40)` trong prototype; pha I cắt theo bề rộng đo được, không theo số ký tự); `title` chứa đường dẫn đầy đủ. Tên máy/dự án (chữ đậm) vẫn cắt cuối bằng ellipsis vì ngắn |

## Token dùng

| Vị trí | Token |
|---|---|
| Chữ tên máy/dự án | `--color-text` |
| Dấu phân cách `›` | `--color-text-muted` |
| Đường dẫn đầy đủ | `--color-text-muted` |
| Khoảng cách icon/chữ/dấu | `--space-xs` |
| Cỡ chữ | `--text-sm` (chữ), `--text-xs` (đường dẫn mono) |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| tĩnh (thanh trên) | Không có phần tử bấm được riêng — cả cụm chỉ là ngữ cảnh hiển thị; bấm vào logo/thanh bên mới đổi phạm vi |
| bấm được (S5 chọn thư mục) | Mỗi đoạn là nút `.btn.ghost.sm` dẫn `href` lên đúng cấp thư mục đó; đoạn cuối (thư mục hiện tại) không có hành động further ngoài việc đã ở đó |

## Tiếp cận (a11y)

Bọc trong `<nav aria-label="Phạm vi hiện hành">` (tĩnh) hoặc tương đương cho biến thể đường dẫn — trình đọc màn hình biết đây là điều hướng ngữ cảnh, không phải tiêu đề trang. Mỗi đoạn bấm được (biến thể S5) là `<a>`/`<button>` thật, có vùng chạm `--tap` theo chuẩn C1 ghost-sm (ép lại `--tap` dưới 768px). Dấu phân cách `›`/`/` mang `aria-hidden` ngầm định (ký tự văn bản thường, không phải icon) nên không cần thêm thuộc tính ẩn riêng.

## Không được làm

- Không bỏ đường dẫn đầy đủ (mono, muted) trên desktop — đó là thông tin cần cho developer sao chép/đối chiếu, chỉ ẩn trên mobile vì chật chỗ.
- Không biến đoạn "đang đứng" (cuối cùng) thành liên kết dẫn tới chính nó.

---

**Đã xử (2026-11-22):** prototype ban đầu chỉ cắt cuối bằng CSS; đã thêm `midTrunc` để rút gọn giữa đúng mô tả §4.
