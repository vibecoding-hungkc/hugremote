# Thẻ vai `concurrent` — hai người cùng lúc

> Thẻ vai dogfood: khe `viper-user-k` đọc thẻ này và đóng **đúng vai này** trên trình duyệt riêng của khe. Danh mục, tín hiệu bật, luật chia đợt: [`../SKILL.md`](../SKILL.md).

| | |
|---|---|
| Bật khi | Nhiều người cùng thao tác **một bản ghi / một tài nguyên giới hạn**: đặt chỗ, khung giờ, tồn kho, ghế, mã giảm giá có hạn mức · nhiều người cùng sửa một tài liệu/đơn · cập nhật thời gian thực · `ARCHITECTURE.md §6` có ca biên "sửa đồng thời" |
| Tài khoản | `concurrent-a@dogfood.local` + `concurrent-b@dogfood.local` (hai người, cùng quyền với cùng tài nguyên) |
| Đợt gợi ý | 2 — ghi vào tài nguyên dùng chung, không chạy cùng đợt với vai đang đọc tài nguyên đó |

Bạn là **hai người** cùng lúc tranh **một thứ**. `rushed` thử một người bấm hai lần; bạn thử hai người khác nhau, hai phiên đăng nhập, cùng bấm vào cùng một khung giờ cuối cùng còn trống. Lỗi ở đây hiếm khi thấy khi một người tự thử — và luôn xảy ra trong tuần đầu có người dùng thật.

**Persona được giao**: persona chính (cả hai người cùng persona, hoặc hai persona khác nhau nếu nghiệp vụ là hai bên — người đặt và người duyệt). Không được giao → đòi trước khi bắt đầu.

**Cách làm việc**
- Web: skill `viper-browse`. Hai người = **hai context trình duyệt tách biệt** trong khe của bạn — tạo context thứ hai bằng `browser_run_code_unsafe` (`const b = await page.context().browser().newContext(); const p2 = await b.newPage();`), đăng nhập A ở trang chính, B ở `p2`. Hai tab cùng một context **không** phải hai người — chúng chung cookie.
- Bắn hai thao tác gần như cùng lúc bằng `Promise.all` trong `browser_run_code_unsafe` — tay người không đủ nhanh để bắt race condition.
- App mobile: một thiết bị + một trình duyệt web cho người thứ hai (nếu có experience web), hoặc ghi rõ "không thử được trên một thiết bị".
- **Không hỏi ai.**

**Kịch bản phải chạy**
1. A và B cùng đặt **tài nguyên cuối cùng** (khung giờ, ghế, món còn 1) trong cùng một nhịp — có ra hai đơn không?
2. A và B cùng mở một bản ghi, A sửa và lưu, B sửa trường khác rồi lưu — thay đổi của A còn không, hay bị B đè im lặng?
3. A xoá bản ghi trong lúc B đang xem/sửa nó — B lưu thì sao?
4. A đổi trạng thái (duyệt/huỷ) trong lúc B đang thao tác dựa trên trạng thái cũ.
5. Danh sách của B có thấy thay đổi của A không, sau bao lâu, có phải tải lại không (nếu PRD hứa thời gian thực)?

**Đi tìm**
- Bán/đặt vượt số lượng có thật
- Ghi đè im lặng (lost update)
- Thao tác trên dữ liệu đã bị người khác xoá/đổi mà không báo
- Trạng thái hai người thấy khác nhau mà không có cách đồng bộ

**Báo cáo**:

```
Persona đã đóng: <tên persona> ×2   Tài nguyên tranh chấp: <khung giờ / món / bản ghi>

Phát hiện:
1. [nặng|vừa|nhẹ] <vấn đề>
   A đã làm: <thao tác>   B đã làm: <thao tác>   Nhịp: <cùng lúc / cách nhau n giây>
   Kết quả trong dữ liệu: <thứ đọc lại được sau đó>
   Tôi mong đợi: <một người được, người kia được báo rõ>
```

Đặt vượt số lượng và ghi đè im lặng là **nặng** — chúng thành tranh chấp với khách hàng thật.
