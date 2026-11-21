# Component — mẫu cho `intake/design-systems/<ds-name>/components/<tên>.md`

> **ĐẶC TẢ ĐỊNH DẠNG, không phải chỗ điền.** Mỗi component trong gói design system của
> Authority là **một file** trong thư mục này. Giữ nguyên file mẫu, đừng đổi tên thành
> component thật.
>
> Thư mục `components/` là **tuỳ chọn**: gói chỉ có `DESIGN-SYSTEM.md` + `tokens.json`
> cũng đi được đường intake. Có thì pha V dịch sang `context/DESIGN-SYSTEM.md §4`
> ([VIPER.md §1.3](../../../VIPER.md)) — **đúng danh sách, không bịa thêm khối, không
> bỏ khối nào**; khối nào không màn hình nào của vòng này dùng thì ghi rõ vòng nào dùng
> (cột "Dùng ở màn") thay vì xoá.

---

## Cách dịch sang `context/DESIGN-SYSTEM.md §4`

Bảng §4 mà `gate.py V` đọc có đúng bốn cột:

```
| # | Component | Dùng ở màn | Trạng thái bắt buộc |
| C1 | Nút chính | S1, S2 | mặc định · đang gửi (khoá lại) · bị vô hiệu |
```

| Cột | Lấy từ mục nào của file này |
|---|---|
| `#` | `Mã` — giữ nguyên `C<số>` của gói; gói không đánh mã thì meta đánh theo thứ tự đọc |
| `Component` | `Tên` |
| `Dùng ở màn` | `Màn hình dùng` → đổi sang mã màn `S<số>` của `context/PROTOTYPE.md §1`. **Gate đòi mỗi component có ít nhất một màn** — không màn nào dùng là component tưởng tượng |
| `Trạng thái bắt buộc` | `Trạng thái` — nối bằng ` · ` |

Mục `Token dùng` không lên bảng §4 nhưng phải **đối chiếu**: token nào component cần mà
`tokens.json` không có là gói thiếu → hỏi Authority (đang pha V), đừng tự thêm token.

---

## Cấu trúc chuẩn của một file component

```markdown
# {{C1}} — {{Tên component, ví dụ: Nút chính}}

| Field | Value |
|---|---|
| Mã | {{C1}} |
| Nhóm | {{action \| input \| hiển thị \| điều hướng \| phản hồi}} |
| Mục đích | {{Một câu: khối này giải quyết việc gì cho người dùng}} |
| Màn hình dùng | {{Tên hoặc mã màn trong gói — meta đổi sang S<số> khi dịch}} |
| Persona chạm tới | {{P-XXX, P-YYY — bỏ field nếu gói không khai}} |

## Giải phẫu

{{Các phần cấu thành, theo thứ tự đọc: icon (tuỳ chọn) → nhãn → chỉ báo đang tải.
  Nói rõ phần nào bắt buộc, phần nào tuỳ chọn.}}

## Trạng thái

> Đây là mục hay bị bỏ sót nhất, và là mục gate soi. Nút không có trạng thái "đang gửi"
> thì người dùng bấm hai lần — đúng ca biên đã chốt ở `context/ARCHITECTURE.md §6`.

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| mặc định | ✓ | {{...}} |
| đang gửi | ✓ | {{khoá lại, hiện chỉ báo, không nhận bấm lần hai}} |
| bị vô hiệu | ✓ | {{...}} |
| lỗi | {{✓ hoặc để trống}} | {{câu báo lỗi lấy khuôn từ DESIGN-SYSTEM §5}} |

## Token dùng

Chỉ tên token có trong `tokens.json` — component **không** được mang giá trị riêng.

| Vị trí | Token |
|---|---|
| Nền | `--color-primary` |
| Chữ | `--color-on-primary` |
| Bo góc | `--radius` |
| Đệm trong | `--space-sm` `--space-md` |

## Biến thể

{{Kích cỡ / mức nhấn mạnh, nếu gói có. Không có thì ghi `—`.
  Biến thể phải dùng lại token, không đẻ giá trị mới.}}

| Biến thể | Khác gì bản mặc định |
|---|---|

## Tiếp cận (a11y)

{{Vùng chạm tối thiểu, nhãn cho trình đọc màn hình, thứ tự tab, cặp tương phản phải đạt
  — cặp nào thì ghi tên hai token để §3 của DESIGN-SYSTEM.md kiểm được.}}

## Không được làm

{{Ranh giới: dùng khối này cho việc gì là sai, biến thể nào cố tình không có.
  Đây là chỗ ngăn "tiện tay đẻ thêm một kiểu nút nữa".}}
```

---

## Ba luật

1. **Một component một file.** Tên file theo tên component dạng kebab-case (`nut-chinh.md`),
   không gộp nhiều khối vào một file — gộp thì lúc dịch sang §4 không tách nổi dòng.
2. **Component không mang giá trị riêng.** Mọi màu/cỡ/khoảng cách trỏ về token trong
   `tokens.json`. Gặp giá trị viết thẳng trong gói → đó là lỗ hổng của gói, ghi vào
   `## Lỗ hổng & cách xử` của `context/INTERVIEW.md` rồi hỏi Authority ở pha V.
3. **Kho component là danh sách ĐÓNG.** Prototype và pha I chỉ được lắp từ đây; cần khối
   mới thì thêm vào `context/DESIGN-SYSTEM.md §4` trước (kèm 1 dòng `DECISIONS.md`),
   không vẽ thẳng vào màn hình. Hook `scripts/guard_ds.py` canh phía token; phần "vẽ khối
   ngoài kho" thì gate `V` bắt qua cột "Dùng ở màn".
