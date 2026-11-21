# Tài liệu vòng — mẫu cho `intake/loops/l<N>/` (vòng ≥2)

> Từ vòng 2, pha V **không phỏng vấn nữa** ([VIPER.md §1.3](../../VIPER.md)). Dự án đã
> hình thành, insight nằm ở số liệu (`context/EXPERIMENTS*.md`) — Authority chỉ cần
> mô tả điều mình muốn cho vòng mới bằng cách thả 1 hay nhiều file `.md` vào
> `intake/loops/l<N>/` (vòng 2 → `l2/`, vòng 3 → `l3/`…).
>
> Viết tự do — các mục dưới chỉ là gợi ý. Muốn làm lại từ đầu quy mô lớn? Cứ thả
> bản mô tả đầy đủ (dù dài) vào cùng thư mục.

**Vai trò của file này khác nhau theo đường vào** ([VIPER.md §1.3–§1.4](../../VIPER.md)):

| | Đường phỏng vấn | Đường intake |
|---|---|---|
| Tài liệu vòng ở đây | **Bắt buộc** — nguồn duy nhất của vòng, đồng thời là **chữ ký chốt** của Authority cho vòng đó; `gate.py V` fail-closed tới khi có | **Tuỳ chọn** — kế hoạch vòng đã lập ở vòng 1 và nằm ở [`_PROPOSAL.md`](_PROPOSAL-DETAIL-TEMPLATE.md); file thả thêm ở đây là **bổ sung / điều chỉnh**, meta áp lên kế hoạch |
| Gate V vòng ≥2 đọc gì | thư mục này | `_PROPOSAL.md` + dòng `Rà lại vòng N` |

Cả hai đường đều dùng đúng các mục dưới đây.

## Thêm mới

Tính năng / luồng / màn hình muốn có thêm ở vòng này. Nếu bắt nguồn từ số liệu hay
phản hồi vòng trước, dẫn lại một dòng (không bắt buộc — meta sẽ tự đối chiếu).

## Thay đổi

Thứ đang chạy nhưng muốn khác đi: hành vi, giao diện, luồng, quy tắc nghiệp vụ.

## Bỏ đi

Thứ muốn cắt khỏi sản phẩm. Nói rõ dữ liệu người dùng đang có ở phần bị cắt thì
xử lý sao (giữ đọc-được / export / xoá).

## Legacy được phép phá

Mặc định vòng mới **không được phá** thứ người dùng đang xài (luồng, API, dữ liệu —
xem `context/BACKWARD-COMPATIBILITY-CHECKLIST.md`). Chỗ nào Authority cho phép phá
thì liệt kê ở đây: phá gì + người/dữ liệu đang dùng di trú thế nào. Không ghi ở đây
(và không chốt qua chat ở pha V) thì meta phải giữ tương thích.

## Ghi chú

Ràng buộc, deadline, ngân sách, cảm nhận — bất cứ gì muốn meta biết.

---

## Ba luật của thư mục `l<N>/`

1. **File `_*.md` không được tính là tài liệu vòng** — mẫu này và ghi chú nháp đặt tên
   bắt đầu bằng `_`. `gate.py V` chỉ đếm file thật, và file thật không được còn
   placeholder `{{…}}`. Ngoại lệ duy nhất: `_PROPOSAL.md` — kế hoạch vòng của đường
   intake, gate đối xử riêng ([`_PROPOSAL-DETAIL-TEMPLATE.md`](_PROPOSAL-DETAIL-TEMPLATE.md)).
2. **Authority trả lời qua chat thì meta ghi hộ**: tạo file trong `l<N>/` (ví dụ
   `tu-chat-2026-08-10.md`), dòng đầu ghi `Nguồn: chat với Authority, <ngày ISO>`,
   nội dung **trích nguyên văn** lời Authority — không diễn giải. Chỉ được ghi hộ
   khi đang ở pha V.
3. **Đóng băng sau khoá scope**: khoá scope vòng N xong thì `l<N>/` không sửa nữa —
   muốn đổi ý giữa vòng là ngoài scope, ghi `context/ROADMAP.md` chờ vòng sau.
   Thư mục đánh số theo vòng nên tự nó là lưu trữ; gate chỉ đọc đúng `l<N>` của
   vòng hiện tại — tài liệu vòng cũ không xanh hộ vòng mới.
