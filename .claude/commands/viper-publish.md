---
description: Pha P (nửa sau) — deploy lên PaaS, smoke test trên production, chốt rollback
---

# /viper-publish — Pha P, nửa sau

> **LUẬT #2 áp dụng, VỚI MỘT NGOẠI LỆ QUAN TRỌNG:** deploy là hành động **hướng ra ngoài**.
> Trước khi đẩy lên production lần đầu, **hỏi Authority một lần** để xác nhận. Đây đúng là ngoại lệ số 2 —
> `.claude/settings.json` cũng đặt `make deploy` vào nhóm `ask` để chặn nhầm.
> Sau lần xác nhận đó, các lần deploy tiếp theo trong ngày không cần hỏi lại.

Đích: production sống, luồng lõi chạy được trên đó, biết cách rollback.

## Bước 0 — Vòng này có chạy pha P không?

**Chế độ intake** (`context/INTERVIEW.md` mang `NGUỒN: INTAKE`): `intake/loops/l<N>/_PROPOSAL.md` dòng `Pha vòng này` không có `P` → **không deploy ở vòng này**, dừng tại đây, đi `/viper-repeat` ([VIPER.md §1.4](../../VIPER.md)). Đường phỏng vấn: luôn đi tiếp.

Đi tiếp thì **việc đầu tiên**: sửa `STATE.md` → `Pha hiện tại : P2` — hook `guard_ask` + `gate.py` đọc dòng này.

## Bước 1 — Điều kiện vào

```bash
python3 scripts/gate.py P1
make check && make test
```

Gate `P1` phải xanh — tức mọi mục `PRODUCTION-READY.md` **không** gắn `(sau deploy)`. Chưa xanh → quay lại `/viper-polish`. Deploy sớm chỉ đổi bug ở local lấy bug trên production.

Bốn mục gắn `(sau deploy)` — backup đã thử khôi phục · HTTPS · push-là-deploy · analytics đang đếm — **cố tình chưa tick ở đây**, vì chúng cần production tồn tại rồi mới làm được. Chúng thuộc gate `P2` ở Bước 8.

## Bước 2 — Chuẩn bị hạ tầng

Theo `stack-<tên>/SKILL.md §6`:

1. Tạo project trên PaaS, nối repo
2. Tạo database, lấy chuỗi kết nối
3. Đặt **đủ** biến môi trường (đối chiếu `deployment/.env.example` — thiếu một biến là hỏng lúc chạy thật)
4. Đặt migration vào bước deploy (build hook / start command / release command), **không chạy tay**

Tạo tài khoản, kết nối thanh toán, đăng ký domain là **hành động hướng ra ngoài** → hỏi trước khi làm.

## Bước 3 — Điền DEPLOY.md trước khi bấm

`context/shared/DEPLOY.md` phải đầy đủ **trước** lần deploy đầu, không phải sau. Lúc production hỏng không ai còn bình tĩnh viết tài liệu:

- §1 nơi chạy · §2 cơ chế deploy · §3 biến môi trường · §4 migration · §5 **rollback**

## Bước 4 — Deploy

```bash
make doctor    # biến nào thiếu, kết nối nào hỏng
make deploy
```

Theo dõi log deploy tới khi xong. Hỏng → đọc log, sửa, deploy lại. Không bỏ dở giữa chừng.

## Bước 5 — Kiểm sau deploy

Theo `DEPLOY.md §6`:

```bash
curl -s "$APP_URL/health"        # phải 200
```

- [ ] Health check OK
- [ ] Đi hết luồng lõi trên production **bằng tay** một lần
- [ ] Error tracking không có lỗi mới
- [ ] Analytics ghi nhận được lượt truy cập
- [ ] Phép thử phân quyền chạy lại **trên production** (tài khoản A không chạm được dữ liệu B)

Hỏng bước nào → **rollback trước, tìm nguyên nhân sau**.

## Bước 6 — Thử rollback một lần

Rollback chưa thử thì coi như chưa có. Ngay khi production còn sạch:

```
1. Rollback về bản trước
2. Xác nhận vẫn chạy
3. Deploy lại bản mới nhất
4. Ghi thời gian thực tế vào DEPLOY.md §5, tick "đã thử"
```

Mười phút bây giờ đổi lấy sự bình tĩnh vào một đêm nào đó.

## Bước 7 — Dogfood trên production

```
/viper-dogfood
```

Lần này chạy trên URL production, không phải localhost. Môi trường thật hay lộ ra thứ local không có: biến thiếu, CORS, HTTPS, độ trễ, giới hạn của PaaS.

Theo `context/DOGFOOD-PLAN.md` của vòng: **`smoke` bắt buộc** — đi hết §3 trên production thật (đây chính là smoke test production, kể cả AC của mọi vòng trước). Các vai khác: chạy những vai mà môi trường thật đổi được kết quả (`mobile`, `edge` mạng thật, `integrator` gọi bên thứ ba thật, `money` cổng sandbox của production) — vai đọc giao diện thuần như `picky` không cần chạy lại. Tài khoản `@dogfood.local` trên production phải bị loại khỏi analytics (`PRODUCTION-READY.md` nhóm 4). Ghi kết quả vào §4 với cột Nơi = `production` — `gate.py P2` đòi dòng `smoke` ở đó.

## Bước 8 — Chốt

Bốn mục `(sau deploy)` trong `PRODUCTION-READY.md` bây giờ mới làm được — làm thật rồi tick, không tick chay:

1. **Backup DB**: bật backup tự động trên PaaS, rồi **thử khôi phục một lần** vào database tạm (xoá sau khi xong) — backup chưa từng khôi phục là chưa có backup
2. **HTTPS** redirect đã bật · **push-là-deploy** đã chạy thật ở Bước 4 · **analytics** đang đếm (đã kiểm ở Bước 5)

Tick xong, kiểm gate rời pha:

```bash
python3 scripts/gate.py P2
```

Cập nhật `STATE.md`: URL production, tick gate P, chuyển pha `E`.

Báo Authority: URL, đã kiểm gì, rollback ra sao, còn gì cố tình bỏ qua.

Mở công khai cho người dùng thật hay chưa — **Authority quyết**, không tự làm.

## Ranh giới

- Không deploy khi `make check` đỏ.
- Không sửa nóng trực tiếp trên production. Sửa ở repo, deploy lại.
- Không chạy migration tay trên production.
- Không dùng dữ liệu production để thử.
