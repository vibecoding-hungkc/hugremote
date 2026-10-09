# 🐴 Mẫu Giao Diện Tương Tác Cài Đặt HugRemote (`install.sh`)

Tài liệu này mô tả kịch bản và giao diện dòng lệnh (CLI Interactive Mockup) khi người dùng chạy script cài đặt:

```bash
curl -fsSL https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/packaged/install.sh | bash
```

---

## 🖥️ Kịch Bản Hiển Thị Trên Terminal

Sau khi script kiểm tra môi trường và build xong mã nguồn, màn hình sẽ dừng lại và hiển thị bảng hỏi tương tác như sau:

```text
========================================================
 ⚙️  THIẾT LẬP CẤU HÌNH BAN ĐẦU CHO HUGREMOTE
========================================================

┌────────────────────────────────────────────────────────────────────────┐
│ 1. 🌐 ĐỊA CHỈ LẮNG NGHE (HOST / BIND ADDRESS)                         │
├────────────────────────────────────────────────────────────────────────┤
│  [1] 127.0.0.1  (Khuyên dùng)                                          │
│      Chỉ cho phép truy cập cục bộ và qua Cloudflare Tunnel / Nginx.    │
│      Đảm bảo an toàn Zero-Trust tuyệt đối, không lộ port ra ngoài.     │
│                                                                        │
│  [2] 0.0.0.0                                                           │
│      Lắng nghe trên mọi card mạng IPv4 (truy cập từ thiết bị cùng LAN).│
│                                                                        │
│  [3] ::                                                                │
│      Lắng nghe trên tất cả địa chỉ cả IPv4 và IPv6.                    │
└────────────────────────────────────────────────────────────────────────┘
👉 Chọn Host [1-3] (Mặc định: 1 [127.0.0.1]): _

──────────────────────────────────────────────────────────────────────────

┌────────────────────────────────────────────────────────────────────────┐
│ 2. 🔐 PHƯƠNG THỨC XÁC THỰC (AUTHENTICATION MODE)                      │
├────────────────────────────────────────────────────────────────────────┤
│  [1] password   (Khuyên dùng khi public ra Internet)                   │
│      • Không lưu mật khẩu thô trong cấu hình.                          │
│      • Mật khẩu khởi tạo ban đầu: 123456                               │
│      • Bắt buộc đổi mật khẩu mới ngay lần đăng nhập đầu tiên.          │
│      • Mật khẩu mới được băm PBKDF2-SHA512 lưu an toàn trên đĩa.       │
│                                                                        │
│  [2] none       (Không mật khẩu)                                       │
│      Chỉ phù hợp khi chạy thử nghiệm localhost hoặc đã có              │
│      Cloudflare Access / Zero Trust bảo vệ ở tầng ngoài.               │
│                                                                        │
│  [3] google     (Đăng nhập tài khoản Google OAuth 2.0)                 │
│      Chỉ các email được cấp quyền mới có thể đăng nhập.                │
└────────────────────────────────────────────────────────────────────────┘
👉 Chọn chế độ Auth [1-3] (Mặc định: 1 [password]): _
```

---

### 🔹 Trường hợp người dùng chọn `[1] password` (Mặc định)

Màn hình sẽ hiển thị xác nhận ngắn gọn:

```text
✓ Đã chọn: Xác thực bằng mật khẩu (Khởi tạo: 123456, bắt buộc đổi lần đầu)
```

---

### 🔹 Trường hợp người dùng chọn `[3] google`

Script sẽ hỏi thêm các thông tin OAuth:

```text
👉 Nhập Public URL ứng dụng (ví dụ: https://hugremote.yourdomain.com): _
👉 Nhập Google Client ID: _
👉 Nhập Google Client Secret: _
👉 Nhập danh sách Email được phép (cách nhau bởi dấu phẩy, ví dụ: me@gmail.com,dev@company.com): _
```

---

### 🔹 Cấu hình Cổng (Port)

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 3. 🔌 CỔNG KẾT NỐI (HTTP & WEBSOCKET PORT)                            │
└────────────────────────────────────────────────────────────────────────┘
👉 Nhập cổng muốn sử dụng (Mặc định: 8099): _
```

---

## 📋 Bảng Tóm Tắt & Xác Nhận Trước Khi Áp Dụng

```text
========================================================================
 📋 XÁC NHẬN CẤU HÌNH ĐÃ THIẾT LẬP
========================================================================
  • Host (Bind IP)       : 127.0.0.1
  • Cổng kết nối (Port)  : 8099
  • Chế độ xác thực      : password
  • Mật khẩu ban đầu     : 123456 (Bắt buộc đổi ở lần đầu đăng nhập)
  • Session Secret       : [Tự động tạo chuỗi ngẫu nhiên 32-byte an toàn]
  • Thư mục Workspace    : /home/user/projects
========================================================================
👉 Bấm [Enter] để áp dụng cấu hình và tạo Systemd service (hoặc 'n' để nhập lại): _
```

---

## 🛠️ Vị Trí Lưu Trữ Cấu Hình Sau Khi Hoàn Tất

1. **Systemd User Service File**: `~/.config/systemd/user/hugremote.service`
   - Tự động ghi các biến môi trường:
     - `HOST=127.0.0.1`
     - `PORT=8099`
     - `AUTH_MODE=password`
     - `SESSION_SECRET=<random_secret_generated_at_install>`
2. **File cấu hình môi trường dự phòng**: `~/.config/hugremote/.env` (với quyền `chmod 600`).
3. **Kích hoạt service**: Tự động gọi `systemctl --user daemon-reload` và hỏi người dùng có muốn khởi chạy service nền ngay lập tức hay không (`y/n`).

---

## 💡 Xử Lý Kỹ Thuật Khi Chạy Qua Pipe (`curl ... | bash`)

Khi người dùng chạy `curl ... | bash`, chuẩn đầu vào `stdin` của shell bị chiếm bởi nội dung script tải về từ curl. 
Do đó, script sẽ sử dụng kỹ thuật đọc trực tiếp từ terminal tty:

```bash
read -r -p "👉 Chọn [1-3]: " CHOICE </dev/tty
```

Nếu môi trường chạy hoàn toàn không có TTY (ví dụ chạy trong Dockerfile CI/CD không có terminal tương tác), script sẽ tự động nhận giá trị mặc định an toàn:
- `HOST=127.0.0.1`
- `AUTH_MODE=password`
- `PORT=8099`
