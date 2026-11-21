# intake/ — cửa nhận tài liệu từ Authority (đường intake vào pha V)

> Quy trình đầy đủ: [VIPER.md §1.3](../VIPER.md). Ở **vòng 1** đây là đường vào
> **thứ hai** của pha V: thay vì phỏng vấn 14 mục, Authority thả bộ tài liệu
> MESH-render vào đây, meta dịch sang `context/` rồi đi tiếp prototype → challenge
> → khoá scope. Từ **vòng ≥2** thì `loops/` (mục cuối) là cửa vào **duy nhất**.

## Hợp đồng thả file

| File / thư mục | Vai trò | Bắt buộc? |
|---|---|---|
| `PRD.md` | Sản phẩm: problem · personas · capabilities · out-of-scope · hypotheses | **Bắt buộc — là trigger.** Có file này (không rỗng, đã resolve hết `{{…}}`) thì `/viper-validate` đi đường intake |
| `ARCHITECTURE.md` | Boundaries · experiences · topology · contracts | Tuỳ chọn |
| `TECHSTACK.md` | Tech choices per-target — **thắng default của stack skill** | Tuỳ chọn |
| `ROADMAP.md` | Phase priority + wave sequence | Tuỳ chọn |
| `design-systems/<ds-name>/` | Gói design system: `DESIGN-SYSTEM.md` + `tokens.json` (+ `components/<tên>.md`, `screens/`). Đặc tả từng phần: `_DESIGN-SYSTEM-TEMPLATE.md` · `_TOKENS-TEMPLATE.json` · `components/_COMPONENT-TEMPLATE.md` | Tuỳ chọn — **có thì là hợp đồng**: `context/DESIGN-SYSTEM.md` phải dịch trung thành (không bịa token, không bỏ rơi, không lệch giá trị), hook `scripts/guard_ds.py` chặn ngay lúc ghi file |

Thiếu file tuỳ chọn nào → meta dựng phần đó như pha V thường (vẫn đang pha V nên
**vẫn được hỏi Authority**), hoặc tự quyết + 1 dòng `context/DECISIONS.md`.

## Luật của thư mục này

1. **`_*-TEMPLATE.md` là ĐẶC TẢ ĐỊNH DẠNG, không phải chỗ điền.** Chúng mô tả cấu trúc
   render output của MESH (`scripts/aggregate-render.py`) để meta biết cách đọc drop
   thật. Giữ nguyên, đừng sửa, đừng đổi tên thành file drop. (`loops/_TEMPLATE.md` và
   `loops/_PROPOSAL-DETAIL-TEMPLATE.md` cũng vậy — mẫu, không phải bản của vòng nào.)
2. **Drop phải là render đã resolve** — không còn placeholder `{{…}}` nào. Copy nguyên
   template vào làm drop sẽ bị `gate.py V` bắt.
3. **Sau khi dịch, `context/` là nguồn sự thật** (luật #4). File ở đây là đầu vào
   đóng băng — không sửa tay sau khi `/viper-validate` đã dịch; muốn đổi thì Authority
   thả bản render mới rồi chạy lại `/viper-validate` (chỉ khi còn ở pha V).
4. **Cuối vòng** (`/viper-repeat` GO/PIVOT): các drop `*.md` ở gốc intake/ được **move**
   vào `context/archive/vong-N/intake/` — đường MESH-render chỉ dùng cho vòng 1.
   Riêng `design-systems/` và `loops/` ở lại: design system có version riêng, dùng
   chung nhiều vòng; `loops/` đánh số theo vòng nên tự nó là lưu trữ.

## Đường intake khác gì đường phỏng vấn?

Hai đường **không cùng bối cảnh**, nên đừng mang luật của đường này áp sang đường kia.
Đường phỏng vấn dựng cho tình huống Founder/PO có ý tưởng và muốn test thị trường
trong một tuần — mọi ràng buộc của nó là ràng buộc tốc độ. Đường intake nhận tài liệu
đã phân tích kỹ: sản phẩm có thể là **một hệ thống lớn, chia thành nhiều vòng để chạy
dần** ([VIPER.md §1.3–§1.4](../VIPER.md)).

| | Phỏng vấn | Intake |
|---|---|---|
| Nguồn hiểu sản phẩm | 14 mục hỏi Authority, mỗi mục có bằng chứng | Bộ tài liệu MESH-render ở đây |
| `INTERVIEW.md` | 14 khối `Trả lời:` + `Bằng chứng:` | Marker `NGUỒN: INTAKE` + bảng truy vết intake → context |
| Cỡ sản phẩm | Một app, một DB, một nơi deploy (luật #5) | Đa target theo ARCHITECTURE — `srcroot/{boundaries,web-experiences,mobile-experiences}/<tên>/`, không tự đẻ target ngoài danh sách |
| Số vòng | Không lập trước — vòng sau mở khi pha R quyết GO/PIVOT | **Lập ở vòng 1** từ wave sequence: `context/ROADMAP.md §1` + `loops/l<N>/_PROPOSAL.md` |
| Pha mỗi vòng | Trọn V-I-P-E-R trong tuần | **V + I bắt buộc**; P/E/R chỉ ở vòng Authority chốt, khai trong `_PROPOSAL.md` |
| Ngân sách | 1 tuần, khoá scope trong 2 tiếng | Mỗi vòng tự khai thời lượng theo cadence của wave |
| Số AC mỗi vòng | 3–7 (quá 7 là scope quá lớn) | Không trần — đổi lại mọi AC phải truy được về `CAPABILITIES-MAP.md` |
| Persona | 2–3 | Theo intake PRD, giữ mã `P-…` |
| Prototype | MỘT `prototype/index.html` | Mỗi experience một `prototype/<tên>/index.html`; vòng không đẻ màn mới thì bỏ qua |
| Stack | Chọn ở Bước 4, theo stack skill | Theo intake TECHSTACK — **thắng default của skill** |
| Design system | Pha V tự quyết token | Có `design-systems/<ds>/tokens.json` → **dịch trung thành**, hook `guard_ds` chặn bịa/lệch |
| Challenge pha V · khoá scope | Giữ nguyên | Giữ nguyên |

## `loops/` — cửa vào vòng ≥2

Từ vòng 2, pha V **không phỏng vấn** và **không dùng `intake/PRD.md`** nữa. Mỗi vòng
N ≥ 2 có thư mục `loops/l<N>/` (`l2/`, `l3/`…, `repeat.py --go` tạo sẵn). Cái nằm
trong đó khác nhau theo đường:

| | Phỏng vấn | Intake |
|---|---|---|
| Nguồn của vòng | Authority thả `.md` mô tả **thêm mới / thay đổi / bỏ đi** — đồng thời là **chữ ký chốt**; mẫu [`loops/_TEMPLATE.md`](loops/_TEMPLATE.md) | `_PROPOSAL.md` — **kế hoạch vòng lập sẵn ở vòng 1**; mẫu [`loops/_PROPOSAL-DETAIL-TEMPLATE.md`](loops/_PROPOSAL-DETAIL-TEMPLATE.md) — đủ chi tiết để pha V dịch chứ không đoán, kể cả kịch bản video demo cuối vòng |
| Authority phải làm gì mỗi vòng | Thả tài liệu (hoặc trả lời qua chat, meta ghi hộ) | Không gì cả — đã ký một lần cho cả kế hoạch ở vòng 1. Muốn đổi thì thả thêm `.md` |
| Gate V fail-closed nhờ | Thư mục phải có tài liệu thật | Dòng `Rà lại vòng N: <ngày>` ngày ≥ `Vòng mở` — meta phải thật sự rà lại kế hoạch khi mở vòng |

`loops/` **không bị move** cuối vòng: thư mục đánh số theo vòng tự nó là lưu trữ,
và `gate.py V` chỉ đọc đúng `l<N>` của vòng hiện tại — tài liệu vòng cũ không xanh
hộ vòng mới.
