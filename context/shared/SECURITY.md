---
type: security-baseline
tier: T1
last_reviewed: "2026-11-21"
---

# SECURITY — hugremote

> Baseline tối thiểu. Sản phẩm test thị trường vẫn chạm dữ liệu người thật — không có ngoại lệ "làm nhanh nên bỏ qua".
> Checklist tick ở `PRODUCTION-READY.md §Nhóm 2`.

---

## 1. Secret

- **Không** secret trong code, trong commit, trong log, trong client bundle.
- `.env` nằm trong `.gitignore` (mọi cấp, kể cả `deployment/local/.env`). `deployment/.env.example` chỉ có tên biến và mô tả, không có giá trị thật.
- Secret của production đặt ở dashboard của PaaS, không ở máy cá nhân.
- Lỡ commit secret → **coi như đã lộ**: xoay key mới ngay, đừng chỉ xoá commit.

## 2. Đầu vào

- Mọi dữ liệu từ ngoài (form, query param, header, webhook) đều validate bằng schema ở **tầng server**.
- Validate ở client là để trải nghiệm, không phải để bảo mật. Luôn validate lại ở server.
- Query database qua tham số hoặc ORM, không nối chuỗi SQL.
- Upload file: giới hạn kích thước, kiểm loại file, không lưu vào thư mục web-accessible.

## 3. Danh tính và phân quyền

- Đăng nhập dùng managed provider. Không tự viết lưu mật khẩu.
- Mỗi truy vấn đọc/ghi dữ liệu người dùng phải kiểm **người đang đăng nhập có quyền với bản ghi này không** — không chỉ kiểm "đã đăng nhập".
- Test tay một lần: đăng nhập tài khoản A, đổi id trên URL sang bản ghi của B, phải bị chặn.
- Session hết hạn được, đăng xuất được.

## 4. Đường ra

- HTTPS bắt buộc, redirect http → https.
- Rate limit ít nhất cho: đăng nhập, đăng ký, endpoint ghi dữ liệu, endpoint gửi email/SMS.
- CORS chỉ mở cho domain của mình.
- Không trả stack trace hay thông tin nội bộ ra response lỗi.

## 5. Dữ liệu

- Chỉ thu thập dữ liệu thực sự cần cho AC trong PRD. Không "lưu sẵn cho sau này".
- Dữ liệu nhạy cảm (số điện thoại, địa chỉ, thông tin thanh toán): nói rõ trong sản phẩm là lưu gì, dùng làm gì.
- Backup có, và **đã thử khôi phục một lần** — backup chưa thử khôi phục thì coi như chưa có.
- Không dùng dữ liệu production để test ở local.

## 6. Phụ thuộc

- Chạy audit của package manager trước khi publish; lỗ hổng nghiêm trọng thì vá hoặc đổi thư viện.
- Không cài thư viện lạ chỉ vì một hàm tiện.

---

## Ngoại lệ đã chấp nhận

Mục nào cố tình bỏ qua thì ghi ở đây kèm điều kiện làm lại. Để trống mà lờ đi là cách sản phẩm chết.

| Mục | Vì sao chấp nhận | Rủi ro | Làm lại khi |
|---|---|---|---|
| | | | |
