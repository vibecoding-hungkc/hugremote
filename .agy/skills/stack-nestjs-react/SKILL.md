---
name: stack-nestjs-react
description: >
  Stack NestJS API + React/Next frontend cho VIPER: NestJS (TypeScript, REST) + Prisma + Postgres ở backend,
  Next.js hoặc Vite React ở frontend, deploy Railway/Render. Chọn khi cần API riêng ngay từ đầu — mobile app
  dùng chung, hoặc bên thứ ba gọi vào. Nạp skill này khi TECHSTACK.md chốt stack-nestjs-react, hoặc khi đang
  chọn stack ở pha V cho sản phẩm cần tách backend. Gồm: scaffold, cấu trúc thư mục monorepo, 6 lệnh Makefile,
  preset production-ready, deploy, forbidden patterns, snippet then chốt.
---

# Stack — NestJS API + React frontend

## 1. Khi nào chọn / không chọn

**Chọn khi**: mobile app sẽ dùng chung API · bên thứ ba gọi vào · logic nghiệp vụ đủ nặng để đáng tách khỏi UI · quen NestJS nên dựng nhanh hơn học cái mới.

**Không chọn khi**: chỉ có web UI và một người làm — tách hai tầng làm chậm ngày 1 mà chưa đổi lại được gì (→ `stack-nextjs-fullstack`).

**Đánh đổi phải biết trước**: tách backend/frontend đẻ ra một API contract phải định nghĩa và giữ đồng bộ. Ở VIPER giải bằng **type dùng chung** (xem §8), không phải bằng tài liệu contract.

## 2. Scaffold

```bash
# Monorepo đơn giản — không cần Nx/Turborepo cho quy mô VIPER
mkdir -p apps packages/shared

# package.json ở GỐC repo — giữ devDependencies dùng chung. Thiếu bước này thì
# `make dev` (concurrently) và `make test` (playwright) không có gì để chạy.
npm init -y
npm i -D concurrently @playwright/test
npx playwright install chromium

# Backend
npx @nestjs/cli new apps/api --package-manager npm --skip-git
cd apps/api && npm i @nestjs/config @nestjs/throttler class-validator class-transformer prisma @prisma/client @sentry/nestjs
npx prisma init && cd ../..

# Frontend
npx create-next-app@latest apps/web --typescript --tailwind --app --eslint --src-dir --use-npm
# (hoặc Vite nếu không cần SSR: npm create vite@latest apps/web -- --template react-ts)

# Type dùng chung
cd packages/shared && npm init -y && npm i -D typescript && cd ../..
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

`apps/api/.env`: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/app`. Không có Docker → dùng Neon cho cả dev, ghi 1 dòng `DECISIONS.md`.

Ghi version thật vào `context/TECHSTACK.md §3`.

## 3. Cấu trúc thư mục

```
apps/
├── api/                        # NestJS
│   ├── src/
│   │   ├── modules/<domain>/   # theo domain, mỗi module tự đủ
│   │   │   ├── *.controller.ts # CHỈ nhận request, validate, gọi service
│   │   │   ├── *.service.ts    # logic nghiệp vụ
│   │   │   ├── *.repository.ts # ← CHỈ chỗ này chạm DB
│   │   │   └── dto/            # class-validator DTO
│   │   ├── common/             # guard, interceptor, filter, pipe
│   │   └── health/             # health check
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/         # có version — commit vào repo
└── web/                        # Next.js hoặc Vite React
    └── src/
        ├── features/<feature>/ # UI theo tính năng
        └── services/           # ← CHỈ chỗ này gọi API. Component không fetch trực tiếp

packages/shared/                # type + zod schema dùng chung hai bên
└── src/index.ts
```

**Quy tắc bất di**: controller không chạm DB · component không gọi `fetch` trực tiếp · mọi kiểu dữ liệu qua lại API khai ở `packages/shared`.

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
STACK_SKILL = stack-nestjs-react

dev:
	docker compose -f deployment/local/docker-compose.yml up -d db && npx concurrently -n api,web -c blue,green \
	  "npm --prefix apps/api run start:dev" \
	  "npm --prefix apps/web run dev"

check:
	npm --prefix apps/api run build && npm --prefix apps/api run lint
	npm --prefix apps/web run build && npm --prefix apps/web run lint

test:
	npm --prefix apps/api run test
	npx playwright test

migrate:
	npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

deploy:
	git push origin main   # Railway/Render tự deploy cả hai service

doctor:
	@node scripts/doctor.mjs
```

## 5. Preset production-ready

| Mục | Cách làm ở stack này |
|---|---|
| Env/secret | `@nestjs/config` với schema validation khi khởi động — thiếu biến thì **app không lên**, phát hiện ngay thay vì lỗi lúc 2 giờ sáng |
| Migration | `prisma migrate dev` khi phát triển, `prisma migrate deploy` khi deploy. Thư mục `migrations/` commit vào repo |
| Health check | `@nestjs/terminus` — kiểm DB, trả 200/503 |
| Error tracking | `@sentry/nestjs` ở API + `@sentry/nextjs` ở web |
| Structured log | `nestjs-pino` — tự gắn request id vào mọi log của một request |
| Backup | Postgres của Railway/Render — bật snapshot, thử khôi phục một lần |
| Auth | JWT qua `@nestjs/jwt` + guard, hoặc Clerk/Supabase nếu muốn nhanh. Refresh token lưu httpOnly cookie |
| Validate | `class-validator` DTO + `ValidationPipe({ whitelist: true, transform: true })` toàn cục — `whitelist` loại field lạ, chống mass-assignment |
| Rate limit | `@nestjs/throttler` toàn cục, siết chặt hơn ở route đăng nhập |
| Phân quyền | Guard đọc user từ JWT + service **luôn** truy vấn kèm `userId` |
| CORS | Chỉ mở cho domain của web app, không `origin: "*"` |

## 6. Deploy

| Thành phần | Nơi | Ghi chú |
|---|---|---|
| API | Railway / Render | Root directory `apps/api`, chạy `migrate deploy` ở start command |
| Web | Vercel (nếu Next.js) / Railway | Biến `NEXT_PUBLIC_API_URL` trỏ về API |
| Database | Postgres của Railway/Render, hoặc Neon | |

Start command của API: `npx prisma migrate deploy && node dist/main`.

Rollback: Railway/Render đều có redeploy bản trước từ dashboard. Nhớ luật cộng-trước-xoá-sau cho schema.

## 7. Forbidden patterns

| Cấm | Vì sao | Thay bằng |
|---|---|---|
| Controller gọi thẳng Prisma | Logic rò ra tầng vận chuyển, không test được | Controller → service → repository |
| Component gọi `fetch` trực tiếp | Đổi API là sửa 20 chỗ | Qua `services/` |
| Trả nguyên entity ra response | Lộ field nội bộ (hash, cờ hệ thống) | DTO response tường minh |
| `ValidationPipe` không bật `whitelist` | Client gửi thừa field, mass-assignment | `{ whitelist: true, forbidNonWhitelisted: true }` |
| Định nghĩa kiểu dữ liệu API hai lần ở hai bên | Chắc chắn lệch nhau sau vài ngày | Khai một lần ở `packages/shared` |
| `synchronize: true` / `db push` lên production | Mất dữ liệu | Migration có version |
| Bắt lỗi rồi trả 200 | Client không biết đã hỏng | Exception filter + status đúng |

## 8. Snippet then chốt

**Type dùng chung — thứ giữ hai bên không lệch nhau:**

```ts
// packages/shared/src/index.ts
import { z } from "zod";

export const CreateBookingInput = z.object({
  customerName: z.string().min(1),
  startsAt: z.coerce.date(),
});
export type CreateBookingInput = z.infer<typeof CreateBookingInput>;

export type BookingResponse = {
  id: string;
  customerName: string;
  startsAt: string;
};
```

Backend dùng nó để định kiểu response, frontend dùng nó để định kiểu `services/`. Một nguồn, không có contract riêng để lệch.

**Controller mỏng — khuôn mẫu:**

```ts
@Controller("bookings")
@UseGuards(AuthGuard)
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Post()
  async create(
    @CurrentUser() userId: string,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingResponse> {
    return this.bookings.create(userId, dto);
  }
}
```

**Service luôn kèm userId:**

```ts
async findOne(userId: string, id: string) {
  const booking = await this.repo.findFirst({ where: { id, userId } });
  if (!booking) throw new NotFoundException("Không tìm thấy lịch hẹn");
  return booking;
}
```

**Health check:**

```ts
@Controller("health")
export class HealthController {
  constructor(private health: HealthCheckService, private db: PrismaHealthIndicator) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck("database")]);
  }
}
```
