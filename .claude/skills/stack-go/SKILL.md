---
name: stack-go
description: >
  Stack Go cho VIPER: net/http + chi router + sqlc + goose migration + Postgres, deploy Fly.io/Render bằng
  Docker binary tĩnh. Chọn khi cần hiệu năng, binary gọn, ít phụ thuộc, hoặc chạy trên VPS rẻ.
  Nạp skill này khi TECHSTACK.md chốt stack-go, hoặc khi đang chọn stack ở pha V cho service cần nhẹ và nhanh.
  Gồm: scaffold, cấu trúc thư mục, 6 lệnh Makefile, preset production-ready, deploy Docker, forbidden patterns,
  snippet then chốt.
---

# Stack — Go

## 1. Khi nào chọn / không chọn

**Chọn khi**: cần hiệu năng hoặc dùng ít RAM · muốn một binary tĩnh chạy đâu cũng được · ít phụ thuộc, ít lỗi thời · quen Go nên viết nhanh.

**Không chọn khi**: sản phẩm nặng UI và một người làm — Go không có hệ sinh thái frontend, phải dựng thêm một frontend riêng, mất phần lớn ngày 1.

**Đánh đổi thật**: Go viết chậm hơn TypeScript/Python cho CRUD (không có ORM đầy đủ, phải viết SQL). Bù lại triển khai và vận hành nhẹ nhất. Với VIPER, chọn Go khi **ràng buộc vận hành** thật sự tồn tại, không phải vì thích ngôn ngữ.

## 2. Scaffold

```bash
go mod init <module-path>

go get github.com/go-chi/chi/v5
go get github.com/jackc/pgx/v5
go get github.com/joho/godotenv
go get github.com/getsentry/sentry-go
go get github.com/go-playground/validator/v10

go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest      # sinh code từ SQL
go install github.com/pressly/goose/v3/cmd/goose@latest  # migration có version
```

**DB local cho `make dev`** — tạo `deployment/local/docker-compose.yml` (mọi artifact chạy local nằm ở đó, không rải ra gốc repo — xem `deployment/README.md`):

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: app }
    ports: ["5432:5432"]
    volumes: ["dbdata:/var/lib/postgresql/data"]
volumes:
  dbdata:
```

`.env`: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/app?sslmode=disable`. Không có Docker → dùng Neon cho cả dev, ghi 1 dòng `DECISIONS.md`.

Ghi version thật vào `context/TECHSTACK.md §3`: `go version && head -20 go.mod`.

## 3. Cấu trúc thư mục

```
cmd/api/main.go            # điểm khởi động: đọc config, gắn route, chạy server
internal/
├── config/                # đọc + validate env, thiếu biến thì thoát ngay
├── http/
│   ├── router.go          # khai báo route
│   ├── middleware/        # log, recover, auth, rate limit
│   └── handlers/<domain>/ # CHỈ nhận request, validate, gọi service
├── service/<domain>/      # logic nghiệp vụ
├── store/                 # ← CHỈ chỗ này chạm DB (sqlc sinh vào đây)
│   ├── queries/*.sql      # SQL người viết
│   └── generated/         # sqlc sinh — không sửa tay
└── platform/              # log, sentry, tiện ích dùng chung

migrations/                # goose, có version — commit vào repo
Dockerfile
```

**Quy tắc bất di**: handler không chạm `store` trực tiếp · không sửa file trong `store/generated` · dùng `internal/` để trình biên dịch chặn import từ ngoài.

### Đường intake — đa target

Cấu trúc trên là của **đường phỏng vấn**: một app, scaffold thẳng vào gốc repo (luật #5).
Đường intake ([VIPER.md §1.3](../../../VIPER.md)) thì mỗi boundary/experience trong
`context/ARCHITECTURE.md §1–§3` là **một thư mục riêng** — cùng cấu trúc bên trên, nhưng
đặt bên trong thư mục target, dưới đúng nhóm của nó:

```
srcroot/boundaries/<tên>/          ← backend boundary   (ARCHITECTURE §1)
srcroot/web-experiences/<tên>/     ← frontend web       (ARCHITECTURE §2)
srcroot/mobile-experiences/<tên>/  ← frontend mobile    (ARCHITECTURE §3)
                                     cấu trúc §3 của skill này nằm BÊN TRONG mỗi thư mục đó

Makefile                           ← GỐC repo: hợp đồng 6 lệnh, điều phối
                                     `make -C srcroot/<nhóm>/<tên> …`
deployment/local/docker-compose.yml ← DB local dùng chung cho mọi target
deployment/.env.example            ← một danh sách biến cho cả hệ
```

Ba luật kèm theo: **không tự đẻ target** ngoài danh sách intake · **chỉ dựng target thuộc
phạm vi vòng này** (`intake/loops/l<N>/_PROPOSAL.md` cột Target) · **deploy luôn qua root
`make deploy`** (hook `guard_bc` canh ở đó). Quy ước đầy đủ: `srcroot/README.md`.

Và: **intake TECHSTACK thắng default của skill này** — scaffold theo đúng Choice trong
`context/TECHSTACK.md`, skill chỉ còn là tham khảo (preset §5, forbidden patterns §7).


## 4. Sáu lệnh Makefile

```makefile
STACK_SKILL = stack-go

dev:
	docker compose -f deployment/local/docker-compose.yml up -d db && go run ./cmd/api

check:
	go build ./... && go vet ./... && gofmt -l . | tee /dev/stderr | (! read)

test:
	go test ./... -race

migrate:
	goose -dir migrations postgres "$$DATABASE_URL" up

deploy:
	flyctl deploy

doctor:
	go run ./cmd/doctor
```

`sqlc generate` chạy lại mỗi khi sửa file trong `store/queries/` — thêm vào `check` nếu hay quên.

## 5. Preset production-ready

| Mục | Cách làm ở stack này |
|---|---|
| Env/secret | `internal/config` đọc env, **thiếu biến bắt buộc thì `log.Fatal` ngay** — không để app chạy nửa vời |
| Migration | `goose` — file SQL đánh số trong `migrations/`, có cả `-- +goose Up` và `Down`. Chạy trước khi app start |
| Health check | `GET /health` chạy `db.Ping()`, trả 200/503 |
| Error tracking | `sentry-go` + middleware recover — panic được bắt, báo về, và không giết cả server |
| Structured log | `log/slog` với `JSONHandler` (có sẵn trong thư viện chuẩn, không cần thêm phụ thuộc) |
| Backup | Postgres của Fly/Render — bật snapshot, thử khôi phục một lần |
| Auth | JWT với `golang-jwt/jwt` + middleware, hoặc đặt sau một provider ngoài |
| Validate | `validator/v10` với struct tag, parse ở đầu handler |
| Rate limit | `httprate` (cùng nhà chi) |
| Phân quyền | Query **luôn** có `WHERE user_id = $1` — sqlc bắt lỗi kiểu nhưng không bắt được lỗi quên điều kiện này |
| Timeout | `http.Server` đặt `ReadTimeout`/`WriteTimeout`; mọi lời gọi ra ngoài dùng `context.WithTimeout` |

## 6. Deploy

| Thành phần | Nơi | Ghi chú |
|---|---|---|
| App | Fly.io (`flyctl launch` sinh sẵn Dockerfile + fly.toml) hoặc Render | Binary tĩnh, image vài chục MB |
| Database | Fly Postgres, Neon, hoặc Render Postgres | |

Dockerfile hai tầng — build bằng image Go, chạy bằng image trống:

```dockerfile
FROM golang:1-alpine AS build
WORKDIR /src
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/api

FROM gcr.io/distroless/static-debian12
COPY --from=build /app /app
EXPOSE 8080
ENTRYPOINT ["/app"]
```

Migration khi deploy: chạy `goose up` ở release command của Fly, hoặc gọi ngay đầu `main()` trước khi listen.

Rollback: `flyctl releases` → `flyctl deploy --image <image cũ>`. Schema thì theo luật cộng-trước-xoá-sau.

## 7. Forbidden patterns

| Cấm | Vì sao | Thay bằng |
|---|---|---|
| Bỏ qua `err` bằng `_` | Lỗi im lặng, debug lúc 2 giờ sáng | Xử lý hoặc bọc: `fmt.Errorf("tạo booking: %w", err)` |
| `panic` trong luồng request | Giết cả server | Trả lỗi lên, middleware recover là lưới cuối |
| Nối chuỗi SQL | SQL injection | sqlc / tham số `$1, $2` |
| Query thiếu `user_id` | Lỗ hổng phân quyền, trình biên dịch không bắt được | Viết vào file `queries/` và soi lại từng query một lần |
| Gọi ra ngoài không `context` | Rò goroutine, request treo | `ctx, cancel := context.WithTimeout(...)` |
| Biến toàn cục cho DB/config | Không test được | Truyền qua struct dependency |
| Sửa tay `store/generated` | Mất khi generate lại | Sửa file `queries/*.sql` |

## 8. Snippet then chốt

**Config thoát sớm khi thiếu env:**

```go
type Config struct {
	DatabaseURL string
	Port        string
	SentryDSN   string
}

func Load() Config {
	c := Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Port:        cmp.Or(os.Getenv("PORT"), "8080"),
		SentryDSN:   os.Getenv("SENTRY_DSN"),
	}
	if c.DatabaseURL == "" {
		log.Fatal("thiếu DATABASE_URL — xem deployment/.env.example")
	}
	return c
}
```

**Handler mỏng, có validate và phân quyền:**

```go
func (h *Handler) CreateBooking(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserFrom(r.Context())
	if !ok {
		writeErr(w, http.StatusUnauthorized, "Cần đăng nhập")
		return
	}

	var req CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}
	if err := h.validate.Struct(req); err != nil {
		writeErr(w, http.StatusBadRequest, "Thiếu thông tin bắt buộc")
		return
	}

	booking, err := h.svc.Create(r.Context(), userID, req)
	if errors.Is(err, service.ErrSlotTaken) {
		writeErr(w, http.StatusConflict, "Khung giờ này đã có lịch")
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "tạo booking hỏng", "err", err)
		writeErr(w, http.StatusInternalServerError, "Có lỗi, thử lại giúp bạn nhé")
		return
	}
	writeJSON(w, http.StatusCreated, booking)
}
```

**Query luôn kèm user_id** (`store/queries/booking.sql`):

```sql
-- name: GetBooking :one
SELECT * FROM bookings WHERE id = $1 AND user_id = $2;
```

**Health check:**

```go
r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := db.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "db": "down"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "db": "up"})
})
```
