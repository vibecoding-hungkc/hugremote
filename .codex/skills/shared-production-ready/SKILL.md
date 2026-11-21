---
name: shared-production-ready
description: >
  Checklist production-ready 4 nhóm cho sản phẩm VIPER, bản không phụ thuộc stack: nền kỹ thuật
  (env/secret, migration có version, health check, error tracking, structured log, backup),
  auth + bảo mật (managed auth, validate input, rate limit, HTTPS, phân quyền),
  CI/CD + test tối thiểu (push là deploy, smoke test, test luồng tiền/dữ liệu),
  đo phản ứng thị trường (analytics, event tracking, kênh feedback, ngưỡng go/pivot/kill).
  Nạp skill này ở pha P (Polish & Publish) trước khi deploy, hoặc khi cần biết "production ready" nghĩa là gì.
  Cách làm cụ thể theo từng stack nằm ở stack-<tên>/SKILL.md §5.
---

# Production Ready — 4 nhóm

> Gate của pha P. Tick vào `context/PRODUCTION-READY.md`.
> Mục gắn `(sau deploy)` — backup · HTTPS · push-là-deploy · analytics đang đếm — chỉ làm được khi production đã sống, nên **không** chặn lần deploy đầu (gate `P1`). Cả 4 nhóm phải xanh toàn bộ trước khi **rời pha P** (gate `P2`). Chi tiết: `VIPER.md §1.1`.
>
> Nguyên tắc: sản phẩm 1 tuần vẫn chạm dữ liệu người thật. "Làm nhanh nên bỏ qua" không phải lý do —
> bỏ qua thì ghi vào mục "Đã cố tình bỏ qua" kèm điều kiện làm lại.

---

## Nhóm 1 — Nền kỹ thuật

### Env/secret tách khỏi code
Không key nào trong repo. `.env` trong `.gitignore`, `deployment/.env.example` liệt kê đủ tên biến. Secret production đặt ở dashboard PaaS.
**Kiểm**: `git log -p | grep -iE '(api[_-]?key|secret|password|token)\s*=\s*["\x27][A-Za-z0-9]'` — không ra gì.

### Migration có version
Schema đổi bằng file migration đánh số, chạy qua `make migrate`. Không sửa tay trên production.
**Nguyên tắc cộng-trước-xoá-sau**: thêm cột mới → deploy code dùng cột mới → deploy sau mới xoá cột cũ. Làm vậy mới rollback được.

### Health check
Endpoint trả trạng thái app + kết nối DB. PaaS dùng nó để biết instance sống hay chết.
**Kiểm**: `curl -s $APP_URL/health` trả 200 kèm trạng thái DB.

### Error tracking
Lỗi production tự báo về một nơi, không phải chờ người dùng kêu. Sentry là mặc định hợp lý (free tier đủ cho MVP).
**Kiểm**: cố tình ném một lỗi trên production, thấy nó xuất hiện trong dashboard.

### Structured log
Log JSON có timestamp + mức độ + request id. Đủ để lần lại một lỗi mà không cần đoán.
Không log dữ liệu nhạy cảm (mật khẩu, token, số thẻ).

### Backup DB
Tự động (đa số PaaS Postgres có sẵn — bật lên). **Đã thử khôi phục một lần** — backup chưa thử khôi phục thì coi như chưa có.

---

## Nhóm 2 — Auth + bảo mật

Chi tiết ở `context/shared/SECURITY.md`. Tóm tắt:

| Mục | Tối thiểu |
|---|---|
| Đăng nhập | Managed provider (Clerk / Supabase Auth / Auth.js / provider của stack). **Không tự viết lưu mật khẩu** |
| Validate input | Schema validation ở **tầng server** cho mọi dữ liệu từ ngoài. Validate ở client chỉ để trải nghiệm |
| Phân quyền | Mỗi truy vấn kiểm "người này có quyền với bản ghi này không", không chỉ "đã đăng nhập chưa" |
| Rate limit | Ít nhất cho đăng nhập, đăng ký, endpoint ghi, endpoint gửi email/SMS |
| HTTPS | Bắt buộc, redirect http → https |
| Response lỗi | Không lộ stack trace hay thông tin nội bộ |

**Phép thử phân quyền bắt buộc**: đăng nhập tài khoản A, đổi id trên URL sang bản ghi của B → phải bị chặn. Đây là lỗ hổng phổ biến nhất của MVP.

---

## Nhóm 3 — CI/CD + test tối thiểu

### Push là deploy
Merge vào `main` → tự lên production. Không deploy tay từ máy cá nhân.

### `make check` chạy trong CI
Lint + typecheck + build. Đỏ thì chặn deploy.

### Smoke test
Luồng lõi ở `ARCHITECTURE.md §7` chạy tự động và pass. Một test đi hết đường chính còn giá trị hơn 50 unit test cho hàm tiện ích.

### Test cho luồng tiền/dữ liệu quan trọng
Chỗ nào sai là mất tiền hoặc mất dữ liệu thì phải có test: tính tiền, trừ kho, huỷ/hoàn, xoá dữ liệu, gửi hai lần.

### Không đặt mục tiêu coverage %
Coverage cao không đồng nghĩa an toàn. Test đúng chỗ quan trọng, không test cho đủ số.

---

## Nhóm 4 — Đo phản ứng thị trường

Đây là nhóm hay bị bỏ nhất, và cũng là nhóm khiến cả tuần trở nên vô nghĩa nếu thiếu — không đo thì cuối tuần không có căn cứ quyết go hay kill.

### Analytics
Đang đếm lượt truy cập + nguồn đến. Plausible / PostHog / GA — chọn cái nào cũng được, miễn đang chạy.

### Event tracking
Các hành vi then chốt đều có event:

| Event | Vì sao cần |
|---|---|
| Bắt đầu luồng lõi | Mẫu số của tỷ lệ hoàn tất |
| Hoàn tất luồng lõi | Chỉ số quan trọng nhất — sản phẩm có giải quyết được vấn đề không |
| Bỏ giữa chừng (kèm bước nào) | Biết chỗ nào người dùng gãy |
| Quay lại lần 2 | Tín hiệu giá trị thật, không phải tò mò |

### Kênh feedback
Người dùng phản hồi được ngay trong sản phẩm. Một nút "góp ý" mở form là đủ.

### Ngưỡng quyết định
Con số nào thì go, số nào thì pivot, số nào thì kill — ghi **trước khi** nhìn số liệu (nguồn: `PRD.md §6`). Ghi sau thì đọc số nào cũng thấy mình đúng.

---

## Trình tự chạy pha P

```
1. Đọc context/PRODUCTION-READY.md — xem còn thiếu gì
2. Làm từ nhóm 1 → 4 (nhóm 1 là nền, thiếu nó thì các nhóm sau vô nghĩa)
3. make check && make test    → xanh
4. gate.py P1                 → sẵn sàng deploy lần đầu
5. Điền DEPLOY.md §1–§5, KỂ CẢ rollback   ← trước khi bấm deploy, không phải sau
6. make deploy                → production sống
7. Kiểm sau deploy theo context/shared/DEPLOY.md §6, rồi THỬ rollback một lần
8. /viper-dogfood             → dùng thử trên production
9. Tick nốt mục (sau deploy), rồi gate.py P2 → rời pha P
```

**Rollback phải viết trước khi deploy.** Lúc production hỏng không ai còn bình tĩnh vừa tìm nguyên nhân vừa nghĩ cách lùi. Bốn mục gắn `(sau deploy)` trong checklist là ngoại lệ duy nhất được để lại sau bước 6 — vì chúng cần production tồn tại rồi mới làm được.

## Bỏ qua có trách nhiệm

Mục nào cố tình không làm → ghi vào `PRODUCTION-READY.md §Đã cố tình bỏ qua`: bỏ mục gì, vì sao, rủi ro gì, làm lại khi nào. Để trống mà lờ đi là cách sản phẩm chết ba tuần sau.
