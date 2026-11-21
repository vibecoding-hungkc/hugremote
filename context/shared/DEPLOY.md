---
type: deploy
tier: T1
status: DRAFT
last_reviewed: "2026-11-21"
---

# DEPLOY — hugremote

> Điền ở pha P. Viết cho lúc 11 giờ đêm production hỏng và không ai còn bình tĩnh.

---

## 1. Nơi chạy

| Thành phần | Ở đâu | URL / định danh |
|---|---|---|
| App | _CHƯA ĐIỀN_ | |
| Database | _CHƯA ĐIỀN_ | |
| Dịch vụ ngoài | | |

## 2. Deploy

```bash
make deploy
```

Cơ chế: _CHƯA ĐIỀN_ (push `main` là tự deploy / lệnh CLI / bấm trên dashboard)

Deploy xong tự động chạy: _CHƯA ĐIỀN_ (migration? smoke test?)

## 3. Biến môi trường production

Danh sách đầy đủ ở `deployment/.env.example`. Nơi đặt giá trị thật: _CHƯA ĐIỀN_

| Biến | Bắt buộc? | Lấy ở đâu |
|---|---|---|
| _CHƯA ĐIỀN_ | | |

Kiểm nhanh trước khi deploy:

```bash
make doctor    # in ra biến nào thiếu, kết nối nào hỏng
```

## 4. Migration

```bash
make migrate
```

- Chạy **trước** khi code mới lên, hoặc trong bước deploy — không chạy tay trên production.
- Migration phải **cộng thêm trước, xoá sau**: thêm cột mới → deploy code dùng cột mới → deploy sau mới xoá cột cũ. Làm vậy mới rollback được.
- Migration có rollback không: _CHƯA ĐIỀN_

## 5. Rollback

```
Lệnh          : _CHƯA ĐIỀN_
Mất bao lâu   : _CHƯA ĐIỀN_
Dữ liệu       : _CHƯA ĐIỀN_ (rollback code có kéo theo rollback schema không)
Đã thử chưa   : ☐ (rollback chưa thử một lần = chưa có rollback)
```

## 6. Kiểm sau khi deploy

- [ ] Health check trả OK
- [ ] Đi hết luồng lõi trên production một lần bằng tay
- [ ] Error tracking không có lỗi mới
- [ ] Analytics ghi nhận được lượt truy cập

Hỏng bước nào → rollback trước, tìm nguyên nhân sau.

## 7. Khi production hỏng

```
1. make doctor  → xem env/kết nối
2. Đọc error tracking → biết lỗi gì
3. Lỗi từ bản vừa deploy?  → rollback ngay, không cố sửa nóng
4. Lỗi từ dịch vụ ngoài?   → xem trang trạng thái của họ, bật chế độ suy giảm nếu có
5. Ghi lại vào STATE.md §Blocker + DECISIONS.md nếu phải quyết gì đó
```
