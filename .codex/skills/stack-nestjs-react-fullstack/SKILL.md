---
name: stack-nestjs-react-fullstack
description: >
  Stack NestJS API + React frontend cho VIPER: monorepo pnpm workspace gồm apps/api (NestJS, TypeORM, Postgres,
  class-validator), apps/web (Next.js, hoặc Vite React nếu không cần SSR) và packages/shared (enum, hằng số,
  helper thuần dùng chung), chạy local bằng Docker Compose.
  Chọn khi cần API riêng ngay từ đầu — mobile app dùng chung, hoặc bên thứ ba gọi vào. Nạp skill này khi
  TECHSTACK.md chốt stack-nestjs-react-fullstack, khi đang chọn stack ở pha V cho sản phẩm cần tách backend, hoặc khi soát
  vi phạm ranh giới giữa api, web và shared. Gồm: bất biến kiến trúc, scaffold + docker compose, cây thư mục tối thiểu +
  ma trận mở rộng, 6 lệnh Makefile, preset ở tầng code, forbidden patterns, snippet then chốt, checklist.
---

# Stack — NestJS API + React frontend (monorepo fullstack)

Monorepo pnpm workspace: backend `apps/api` (NestJS + TypeORM), frontend `apps/web` (Next.js mặc định, Vite React
nếu không cần SSR) và `packages/shared` (enum, hằng số, helper thuần). Mỗi domain nghiệp vụ ánh xạ thẳng hàng:
`modules/<domain>/` ↔ `features/<domain>/` ↔ `shared/src/<domain>/`. Hai app không import nhau — chỉ nói chuyện
qua HTTP và cùng dùng `@app/shared`.

**Hai cơ chế, không chồng nhau:**

| Thứ | Nguồn sự thật | Web nhận bằng |
|---|---|---|
| Hình dạng request/response (contract) | DTO class-validator ở `apps/api` | OpenAPI → `types/api.d.ts` (sinh ra) |
| Enum, hằng số, mã lỗi, tên quyền, hàm thuần | `packages/shared` | `import … from "@app/shared"` |

Cả stack (db + shared + api + web) chạy local bằng một file Docker Compose.

> **Đánh số mục là hợp đồng với VIPER** — lệnh/agent trỏ thẳng vào `§2` (scaffold), `§3` (cấu trúc),
> `§4` (Makefile), `§5` (preset), `§6` (deploy), `§7` (forbidden). Không đổi số mục.

## 1. Khi nào chọn / không chọn

**Chọn khi**: mobile app sẽ dùng chung API · bên thứ ba gọi vào · logic nghiệp vụ đủ nặng để đáng tách khỏi UI ·
quen NestJS nên dựng nhanh hơn học cái mới.

**Không chọn khi**: chỉ có web UI và một người làm — tách hai tầng làm chậm ngày 1 mà chưa đổi lại được gì
(→ `stack-nextjs-fullstack`).

**Khác `stack-nestjs-react`**: cùng NestJS + React nhưng skill này chốt sẵn kiến trúc monorepo đầy đủ — pnpm
workspace, TypeORM, contract qua OpenAPI, `packages/shared` cho enum/hằng số, cả stack chạy trong Docker Compose.
Chọn `stack-nestjs-react` khi muốn bản gọn (npm, Prisma, chỉ DB chạy trong Docker).

**Next.js hay Vite**: cần SSR/SEO, trang công khai → Next.js. Chỉ là app sau đăng nhập (dashboard, tool nội bộ)
→ Vite React nhẹ hơn. Ghi lựa chọn vào `context/TECHSTACK.md`.

**Đánh đổi phải biết trước**: tách backend/frontend đẻ ra một API contract phải giữ đồng bộ. Ở stack này
**backend là nguồn sự thật**: DTO class-validator → OpenAPI (`@nestjs/swagger`) → type sinh ra ở web
(`openapi-typescript`). Không khai tay kiểu dữ liệu API lần thứ hai ở frontend.

## 2. Scaffold

```bash
# Gốc monorepo — pnpm workspace (Node 22 LTS; corepack đi kèm Node ≤ 24)
corepack enable
pnpm init                                   # thêm "packageManager": "pnpm@<version>" vào package.json gốc
printf 'packages:\n  - apps/*\n  - packages/*\n' > pnpm-workspace.yaml
mkdir -p apps packages/shared/src

# devDependencies dùng chung ở GỐC — `make test` cần Playwright
pnpm add -Dw @playwright/test
pnpm exec playwright install chromium

# Backend — đặt "name": "@app/api" trong apps/api/package.json
pnpm dlx @nestjs/cli new api --directory apps/api --package-manager pnpm --skip-git --skip-install
pnpm --filter @app/api add @nestjs/config @nestjs/throttler @nestjs/terminus @nestjs/swagger \
  @nestjs/typeorm typeorm pg class-validator class-transformer nestjs-pino pino-http
pnpm --filter @app/api add -D ts-node        # TypeORM CLI đọc data-source.ts

# Frontend — Next.js (mặc định); đặt "name": "@app/web" trong apps/web/package.json
pnpm create next-app@latest apps/web --typescript --tailwind --app --eslint --src-dir --use-pnpm --skip-install
#   Vite nếu không cần SSR:
#   pnpm create vite apps/web --template react-ts && pnpm --filter @app/web add react-router-dom
pnpm --filter @app/web add @tanstack/react-query
pnpm --filter @app/web add -D openapi-typescript

# Shared — đặt "name": "@app/shared" (package.json + tsconfig.json xem bảng dưới)
cd packages/shared && pnpm init && cd ../..
pnpm --filter @app/shared add -D typescript
pnpm --filter @app/api --filter @app/web add @app/shared@workspace:*

pnpm install
```

Sau scaffold, chỉnh tay:

| File | Thêm / sửa |
|---|---|
| `apps/api/nest-cli.json` | `"compilerOptions": { "plugins": ["@nestjs/swagger"] }` — plugin tự sinh OpenAPI từ file `*.dto.ts` |
| `apps/api/package.json` | `"typeorm": "typeorm-ts-node-commonjs -d src/infra/database/data-source.ts"` |
| `apps/web/package.json` | `"dev": "next dev -H 0.0.0.0 -p 3001"` (Vite: `"vite --host --port 5173"`) — phải nghe `0.0.0.0` mới vào được từ ngoài container |
| `packages/shared/package.json` | `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`, `"scripts": { "build": "tsc -p tsconfig.json", "dev": "tsc -p tsconfig.json && tsc -p tsconfig.json -w --preserveWatchOutput" }` |
| `packages/shared/tsconfig.json` | `"module": "commonjs"`, `"target": "ES2022"`, `"declaration": true`, `"outDir": "dist"`, `"rootDir": "src"`, `"strict": true`, `"lib": ["ES2022"]` (không `dom`, không `types: ["node"]` — chặn import nhầm API của trình duyệt/Node) |
| `apps/web/vite.config.ts` (chỉ Vite) | `optimizeDeps: { include: ["@app/shared"] }`, `build: { commonjsOptions: { include: [/shared/, /node_modules/] } }` — Vite không tự chuyển CJS của package link trong workspace |
| `package.json` (gốc) | script tiện dùng, xem §4 |
| `apps/*/pnpm-lock.yaml` | xoá nếu generator sinh ra — chỉ giữ `pnpm-lock.yaml` ở gốc |

### 2.1 Docker Compose — chạy cả stack

Mọi artifact chạy local nằm ở `deployment/local/`, không rải ra gốc repo (`deployment/README.md`).

```dockerfile
# deployment/local/Dockerfile.dev — một image dev dùng cho cả api và web
FROM node:22-bookworm-slim
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
```

```yaml
# deployment/local/docker-compose.yml
x-app: &app
  build: { context: ../.., dockerfile: deployment/local/Dockerfile.dev }
  env_file: .env                        # deployment/local/.env — giá trị local, không commit
  volumes:
    - ../..:/repo                       # mount mã nguồn → hot reload
    - /repo/node_modules                # node_modules giữ trong container (binary Linux), không lấy từ host
    - /repo/apps/api/node_modules
    - /repo/apps/web/node_modules
    - /repo/packages/shared/node_modules

services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: app }
    ports: ["5432:5432"]
    volumes: ["dbdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app"]
      interval: 2s
      retries: 30

  shared:
    <<: *app
    command: pnpm --filter @app/shared dev       # tsc -w → packages/shared/dist
    healthcheck:                                  # api/web chỉ lên khi dist đã có
      test: ["CMD", "test", "-f", "/repo/packages/shared/dist/index.js"]
      interval: 2s
      retries: 30

  api:
    <<: *app
    command: pnpm --filter @app/api start:dev
    ports: ["3000:3000"]
    depends_on:
      db: { condition: service_healthy }
      shared: { condition: service_healthy }
    healthcheck:                        # dùng chính /api/health của app
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 5s
      start_period: 60s
      retries: 12

  web:
    <<: *app
    command: pnpm --filter @app/web dev
    environment:
      API_PROXY_TARGET: "http://api:3000"     # dev proxy /api → api
      API_INTERNAL_URL: "http://api:3000"     # Next Server Component gọi API trong mạng compose
    ports: ["3001:3001"]                      # Vite: "5173:5173"
    depends_on:
      api: { condition: service_healthy }
      shared: { condition: service_healthy }

volumes:
  dbdata:
```

`.dockerignore` ở gốc: `node_modules`, `**/node_modules`, `**/dist`, `**/.next`, `.git`, `.env`, `**/.env*`.

Sửa `packages/shared` → service `shared` biên dịch lại, `api` (watch) và `web` (HMR) tự nhận bản mới.

- Đổi dependency → `docker compose -f deployment/local/docker-compose.yml up --build -V` (`-V` tạo lại volume
  `node_modules` từ image mới).
- Sửa file mà app không reload (bind mount trên một số máy không bắn sự kiện file) → thêm
  `CHOKIDAR_USEPOLLING=1` / `WATCHPACK_POLLING=true` vào `environment` của service đó.
- Dữ liệu mẫu cho `/viper-dogfood` (nguồn: `context/PRD.md §7`): `deployment/local/seed.sql`, nạp **sau**
  `make migrate` bằng `pnpm db:seed` (§4).

### 2.2 Biến môi trường

Theo quy ước `deployment/README.md`:

| File | Nội dung | Commit |
|---|---|---|
| `deployment/.env.example` | **TÊN** biến + mô tả, không giá trị thật — danh sách duy nhất cho cả hệ; `make doctor` đọc nó | có |
| `deployment/local/.env` | giá trị local, copy từ file trên (`cp deployment/.env.example deployment/local/.env`) | **không** |

Biến của stack này:

```bash
# --- api ---
APP_ENV=                  # development | production
DATABASE_URL=             # local: postgres://postgres:postgres@db:5432/app (host "db" = service trong compose)
JWT_SECRET=
# PORT=                   # (tuỳ chọn) cổng API, mặc định 3000
# CORS_ORIGIN=            # (tuỳ chọn) chỉ khi web khác origin với API; local đi qua proxy
# --- web ---
# NEXT_PUBLIC_API_BASE_URL= # (tuỳ chọn; Vite: VITE_API_BASE_URL) trống = cùng origin. LỘ RA BUNDLE — không để secret
```

Ở api, chỉ `src/config/` đọc env (qua `ConfigService`). Ở web, chỉ `src/config/env.ts` đọc env.

Ghi version thật (Node, pnpm, NestJS, TypeORM, Next/Vite, React, Postgres) vào `context/TECHSTACK.md §3`.

## 3. Kiến trúc & cấu trúc thư mục

### 3.1 Bất biến

1. **Cô lập ranh giới monorepo** — `apps/web` KHÔNG import từ `apps/api` và ngược lại. Thứ dùng chung chỉ đi
   qua `packages/shared`; `packages/shared` không import ngược vào `apps/*`.
2. **`packages/shared` thuần, chạy được ở cả Node lẫn trình duyệt** — chỉ enum, hằng số, type tiện ích, hàm
   thuần. KHÔNG import NestJS, TypeORM, class-validator, React, Next, API của Node (`fs`, `path`, `process`) hay
   DOM (`window`, `document`). Không phụ thuộc runtime bên ngoài trừ khi thật sự thuần (vd thư viện ngày tháng).
3. **Shared không chứa contract** — hình dạng request/response không khai ở `packages/shared` (đã có OpenAPI).
   DTO ở api dùng enum từ shared (`@IsEnum(BookingStatus)`), nên enum đi vào OpenAPI và web nhận cùng giá trị.
4. **Backend là nguồn sự thật của contract** — request/response khai bằng DTO class trong file `*.dto.ts`
   (class-validator + plugin `@nestjs/swagger`). Web dùng type sinh từ OpenAPI (`src/types/api.d.ts`), không
   khai tay lại.
5. **Controller mỏng, chỉ repository chạm DB** — controller nhận request → validate (DTO) → gọi service; service
   chứa nghiệp vụ, luôn truy vấn kèm `userId`, trả DTO response; `<domain>.repository.ts` là chỗ DUY NHẤT inject
   `Repository<Entity>` / `DataSource`. Entity không bao giờ ra khỏi api.
6. **Schema chỉ đổi qua migration** — `synchronize: false` ở mọi môi trường; mỗi thay đổi entity đi kèm một
   migration trong cùng commit.
7. **Cách ly env & secret** — secret chỉ nằm trong env của api. Web chỉ có biến công khai, đọc duy nhất trong
   `apps/web/src/config/env.ts`.
8. **Next.js chỉ là tầng UI** — không đặt nghiệp vụ hay truy cập DB trong `app/api/` route handler hay Server
   Action. Mọi nghiệp vụ ở NestJS.
9. **Cô lập feature ở frontend** — `features/<domain>/` không import feature khác. Ghép nhiều feature chỉ ở tầng
   trang (`app/<route>/page.tsx` với Next, `pages/` với Vite). Transport HTTP ở `apps/web/src/lib/`, không nằm
   trong feature nào.
10. **Component không fetch trực tiếp** — UI gọi API qua `features/<domain>/api/` + hook TanStack Query.
11. **Không hardcode origin API** — trình duyệt gọi `/api/...` cùng origin (proxy); địa chỉ khác lấy từ
    `src/config/env.ts`.
12. **View chính gắn với URL** — tab/view chính là route, không chỉ nằm trong `useState`; F5, Back/Forward và chia
    sẻ link giữ đúng view.
13. **Khởi tạo theo thứ tự** — đăng nhập → scope cha (vd project) → dữ liệu con. Query con chỉ chạy khi scope cha
    đã có (`enabled: !!projectId`). Access token chỉ giữ trong bộ nhớ trình duyệt, không `localStorage`.
14. **Typecheck trước bundle** — `next build` tự typecheck; Vite thì không, `build` phải là `tsc -b && vite build`.
15. **Scaffold tối thiểu** — không tạo thư mục rỗng hay stub chưa dùng. Bắt đầu từ baseline §3.2, chỉ mở rộng
    theo §3.3 khi có yêu cầu cụ thể.

### 3.2 Baseline tối thiểu (chỉ sinh những file này khi khởi tạo)

```text
<repo>/
├── apps/
│   ├── api/                                     # NestJS — @app/api
│   │   ├── src/
│   │   │   ├── main.ts                          # prefix /api, ValidationPipe, logger, Swagger (§8)
│   │   │   ├── app.module.ts                    # Config, TypeORM, Throttler, Logger, Health, module domain
│   │   │   ├── config/env.validation.ts         # class-validator cho env — thiếu biến thì app không lên
│   │   │   ├── modules/<domain>/
│   │   │   │   ├── <domain>.module.ts           # TypeOrmModule.forFeature([<Domain>])
│   │   │   │   ├── <domain>.entity.ts           # @Entity — không ra khỏi api
│   │   │   │   ├── <domain>.controller.ts       # CHỈ nhận request, validate, gọi service
│   │   │   │   ├── <domain>.service.ts          # nghiệp vụ, luôn kèm userId, trả DTO response
│   │   │   │   ├── <domain>.repository.ts       # ← CHỈ chỗ này chạm DB
│   │   │   │   └── dto/
│   │   │   │       ├── create-<domain>.dto.ts
│   │   │   │       └── <domain>-response.dto.ts # hậu tố .dto.ts để plugin Swagger đọc được
│   │   │   ├── infra/database/
│   │   │   │   ├── data-source.ts               # DataSource cho TypeORM CLI
│   │   │   │   └── migrations/                  # có version — commit vào repo
│   │   │   ├── common/                          # guard, exception filter, decorator (@CurrentUser)
│   │   │   └── health/                          # health.module.ts + health.controller.ts → /api/health
│   │   └── nest-cli.json
│   └── web/                                     # Next.js (App Router) — @app/web
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx                   # bọc <Providers>
│       │   │   ├── providers.tsx                # "use client" — QueryClientProvider
│       │   │   └── <route>/page.tsx             # trang — ghép feature
│       │   ├── config/env.ts                    # nơi DUY NHẤT đọc env
│       │   ├── lib/
│       │   │   ├── api-client.ts                # apiRequest() — phía trình duyệt
│       │   │   └── api-server.ts                # serverApiRequest() — phía server (nếu có Server Component gọi API)
│       │   ├── types/api.d.ts                   # SINH từ OpenAPI — không sửa tay, có commit
│       │   └── features/<domain>/
│       │       ├── api/<domain>.api.ts
│       │       ├── hooks/use<Domain>.ts
│       │       └── components/<Domain>View.tsx  # "use client" nếu dùng hook
│       └── next.config.ts                       # rewrites /api → API
├── packages/
│   └── shared/                                  # @app/shared — enum, hằng số, helper thuần
│       ├── src/
│       │   ├── <domain>/<domain>.enums.ts       # vd BookingStatus
│       │   └── index.ts                         # chỉ export lại, không logic
│       ├── tsconfig.json                        # lib ES2022, không dom/node
│       └── package.json                         # main: dist/index.js
├── deployment/
│   ├── .env.example                             # TÊN biến (§2.2)
│   └── local/
│       ├── docker-compose.yml                   # db + shared + api + web (§2.1)
│       ├── Dockerfile.dev
│       └── .env                                 # không commit
├── scripts/doctor.mjs                           # make doctor
├── pnpm-workspace.yaml                          # apps/* + packages/*
├── package.json
└── Makefile                                     # hợp đồng 6 lệnh (§4)
```

**Nếu web là Vite** — khác ở các chỗ sau, phần còn lại giữ nguyên:

| Next.js | Vite React |
|---|---|
| `src/app/<route>/page.tsx` | `src/pages/<Name>Page.tsx` + `src/app/router.tsx` (React Router) |
| `src/app/layout.tsx` + `providers.tsx` | `src/main.tsx` + `index.html` |
| `next.config.ts` (rewrites) | `vite.config.ts` (`server.proxy`) |
| `lib/api-server.ts` | không có — mọi request từ trình duyệt |
| `NEXT_PUBLIC_*` | `VITE_*` |
| Cổng `3001` | Cổng `5173` |

### 3.3 Ma trận mở rộng (chỉ thêm khi có nhu cầu thật)

| Khi cần | Đường dẫn | Nội dung |
|---|---|---|
| Domain backend mới | `apps/api/src/modules/<tên>/` | module, entity, controller, service, repository, dto |
| Domain frontend mới | `apps/web/src/features/<tên>/` | `components/`, `hooks/`, `api/` |
| Màn hình mới | `app/<route>/page.tsx` (Next) · `pages/` + `app/router.tsx` (Vite) | Trang ghép các feature |
| Đối tác / SDK bên thứ ba | `apps/api/src/integrations/<đối tác>/` | Adapter cài interface của domain |
| Cache / hàng đợi | `apps/api/src/infra/<cache\|queue>/` + service `redis` trong compose | Redis, BullMQ |
| Job nền / cron | `apps/api/src/jobs/` | `@nestjs/schedule`, processor |
| UI dùng chung trong web | `apps/web/src/components/` | layout, header, dialog |
| State client toàn cục | `apps/web/src/stores/` | Zustand (auth, theme) — dữ liệu server để TanStack Query giữ |
| Enum / hằng số / helper hai bên cùng cần | `packages/shared/src/<domain>/` | Chỉ khi **cả api lẫn web** dùng; một bên dùng thì để ở bên đó |
| Mã lỗi nghiệp vụ dùng chung | `packages/shared/src/errors/error-codes.ts` | api trả `code`, web map sang thông báo |
| Thư viện UI cho nhiều web app | `packages/ui/` | Chỉ khi có app web thứ hai |
| Dữ liệu mẫu | `deployment/local/seed.sql` | nạp bằng `pnpm db:seed` |

### 3.4 Ánh xạ backend ↔ frontend

| Trách nhiệm | `apps/api` | `apps/web` | `packages/shared` |
|---|---|---|---|
| Phạm vi domain | `modules/<domain>/` | `features/<domain>/` | `src/<domain>/` |
| Điểm vào | `<domain>.controller.ts` | `app/<route>/page.tsx` · `pages/<Name>Page.tsx` | – |
| Nghiệp vụ / state | `<domain>.service.ts` | `hooks/use<Domain>.ts` | enum, hằng số domain |
| Truy cập dữ liệu / I/O | `<domain>.repository.ts` | `api/<domain>.api.ts` | – |
| Contract | `dto/*.dto.ts` | `types/api.d.ts` (sinh ra) | – (không đặt ở đây) |
| Validate | `ValidationPipe` toàn cục — **quyết định cuối** | validate form chỉ để UX | giới hạn dùng chung (vd `MAX_NAME_LENGTH`) |
| Helper | `common/` | `components/`, `lib/` | hàm thuần dùng cả hai bên |

### 3.5 Đường intake — đa target

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
deployment/local/docker-compose.yml ← MỘT compose cho mọi service local của cả hệ
deployment/.env.example            ← một danh sách biến cho cả hệ
```

Ba luật kèm theo: **không tự đẻ target** ngoài danh sách intake · **chỉ dựng target thuộc
phạm vi vòng này** (`intake/loops/l<N>/_PROPOSAL.md` cột Target) · **deploy luôn qua root
`make deploy`** (hook `guard_bc` canh ở đó). Quy ước đầy đủ: `srcroot/README.md`.

Và: **intake TECHSTACK thắng default của skill này** — scaffold theo đúng Choice trong
`context/TECHSTACK.md`, skill chỉ còn là tham khảo (preset §5, forbidden patterns §7).

## 4. Sáu lệnh Makefile

```makefile
STACK_SKILL = stack-nestjs-react-fullstack
COMPOSE = docker compose -f deployment/local/docker-compose.yml

dev:
	$(COMPOSE) up --build

check:
	pnpm install --frozen-lockfile
	pnpm --filter @app/shared build
	pnpm --filter @app/api build && pnpm --filter @app/api lint
	pnpm --filter @app/web build && pnpm --filter @app/web lint   # Next: next build tự typecheck · Vite: tsc -b && vite build

test:
	pnpm --filter @app/shared build
	pnpm --filter @app/api test
	pnpm exec playwright test        # cần stack đang chạy (make dev) — baseURL http://localhost:3001

migrate:
	$(COMPOSE) run --rm api pnpm --filter @app/api run typeorm migration:run

deploy:
	@echo "Chưa cấu hình deploy — chốt nền tảng ở context/TECHSTACK.md rồi điền target này (§6)"; exit 1

doctor:
	@node scripts/doctor.mjs
```

`scripts/doctor.mjs` kiểm: mọi biến **không comment** trong `deployment/.env.example` đã có giá trị ở
`deployment/local/.env` (biến tuỳ chọn để dạng `# TÊN=`, không bắt) ·
Docker đang chạy · `http://localhost:3000/api/health` trả 200. In ra cái thiếu, exit 1 nếu có.

Không thêm target ngoài sáu cái (`gate.py` chỉ biết sáu). Việc lặt vặt khi phát triển đặt ở script
`package.json` gốc:

```json
"scripts": {
  "db:migration:new": "docker compose -f deployment/local/docker-compose.yml exec api pnpm --filter @app/api run typeorm migration:generate",
  "db:seed": "docker compose -f deployment/local/docker-compose.yml exec -T db psql -U postgres -d app < deployment/local/seed.sql",
  "api:types": "pnpm --filter @app/web exec openapi-typescript http://localhost:3000/api/docs-json -o src/types/api.d.ts"
}
```

- Đổi entity → `pnpm db:migration:new src/infra/database/migrations/AddBookingNote` (đường dẫn tính từ `apps/api`),
  **đọc lại** file migration sinh ra trước khi commit.
- Đổi DTO → `pnpm api:types` (api đang chạy), commit `types/api.d.ts` cùng commit đổi DTO.

## 5. Preset ở tầng code

| Mục | Cách làm ở stack này |
|---|---|
| Env/secret | `ConfigModule.forRoot({ isGlobal: true, validate })` với class-validator — thiếu biến thì **app không lên** |
| Migration | `migration:generate` khi đổi entity, đọc lại trước khi commit; `migration:run` qua `make migrate`. `synchronize: false`. `migrations/` commit vào repo |
| Health check | `@nestjs/terminus` + `TypeOrmHealthIndicator` — `/api/health` trả 200 khi DB lên, 503 khi DB xuống. Compose, `make doctor` và nền tảng deploy đều dựa vào nó |
| Structured log | `nestjs-pino` — tự gắn request id vào mọi log của một request |
| Auth | JWT qua `@nestjs/jwt` + guard. Refresh token ở cookie httpOnly; access token chỉ trong bộ nhớ trình duyệt |
| Validate | DTO class-validator + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` toàn cục — chống mass-assignment |
| Contract | Plugin `@nestjs/swagger` phát `/api/docs-json`; web sinh `types/api.d.ts`. Chỉ bật Swagger khi `APP_ENV !== "production"` trừ khi API công khai |
| Rate limit | `@nestjs/throttler` toàn cục, siết chặt hơn ở route đăng nhập |
| Phân quyền | Guard đọc user từ JWT + service **luôn** truy vấn kèm `userId` |
| CORS | Local đi qua proxy cùng origin nên không cần. Khi bật: chỉ cho `CORS_ORIGIN`, không `origin: "*"` |

Phần vận hành (error tracking, backup, monitoring) không thuộc skill này — xem `shared-production-ready`.

## 6. Deploy

Ngoài phạm vi skill — nền tảng deploy chốt ở `context/TECHSTACK.md` + 1 dòng `DECISIONS.md`, cách làm ghi ở
`context/shared/DEPLOY.md`, rồi mới điền target `deploy` (§4). App đã sẵn những thứ mọi nền tảng cần:

| | Build | Start | Kiểm sống |
|---|---|---|---|
| API | `pnpm --filter @app/shared build && pnpm --filter @app/api build` | trong `apps/api`: `npx typeorm migration:run -d dist/infra/database/data-source.js && node dist/main` | `GET /api/health` |
| Web | `pnpm --filter @app/shared build && pnpm --filter @app/web build` | Next: `pnpm --filter @app/web start` · Vite: phục vụ tĩnh `apps/web/dist` | trang chủ trả 200 |

Web khác origin với API → đặt `NEXT_PUBLIC_API_BASE_URL` (Vite: `VITE_API_BASE_URL`) lúc build và `CORS_ORIGIN`
ở API. Nhớ luật cộng-trước-xoá-sau cho schema.

## 7. Forbidden patterns

| Cấm | Vì sao | Thay bằng |
|---|---|---|
| `apps/web` import từ `apps/api` (hoặc ngược lại) | Kéo Node/TypeORM vào bundle trình duyệt | Nói chuyện qua HTTP; type sinh từ OpenAPI |
| Khai tay kiểu request/response ở web | Chắc chắn lệch DTO sau vài ngày | `types/api.d.ts` sinh từ `/api/docs-json` |
| Đặt interface request/response vào `packages/shared` | Hai nguồn contract (shared + OpenAPI) — sẽ lệch nhau | Contract chỉ qua DTO → OpenAPI |
| `packages/shared` import NestJS, TypeORM, class-validator, React, `fs`, `window`… | Shared không còn chạy được ở cả hai phía; kéo framework vào bundle web | Chỉ enum, hằng số, hàm thuần |
| Khai lại cùng một enum/hằng số ở api và web | Lệch giá trị sau vài lần sửa | Khai một lần ở `packages/shared` |
| Đưa vào shared thứ chỉ một bên dùng | Shared phình thành thùng rác | Để ở app dùng nó; chuyển sang shared khi bên thứ hai cần |
| DTO đặt trong file không có hậu tố `.dto.ts` | Plugin Swagger bỏ qua → thiếu schema trong OpenAPI, type web sai | `dto/<tên>.dto.ts` |
| Nghiệp vụ / truy cập DB trong `app/api/` hay Server Action của Next | Hai nơi chứa nghiệp vụ, mobile không dùng được | Đặt ở NestJS |
| Controller/service inject `Repository<Entity>` hay `DataSource` | Query rải khắp nơi, không test được | Controller → service → `<domain>.repository.ts` |
| Trả nguyên entity ra response | Lộ field nội bộ (hash, cờ hệ thống), contract đổi theo schema DB | DTO response tường minh |
| `synchronize: true` (kể cả khi dev) | TypeORM tự sửa schema theo entity — mất cột/dữ liệu, migration không còn phản ánh DB thật | Migration có version |
| `ValidationPipe` không bật `whitelist` | Mass-assignment | `{ whitelist: true, forbidNonWhitelisted: true }` |
| Bắt lỗi rồi trả 200 | Client không biết đã hỏng | Exception filter + status đúng |
| Component gọi `fetch` trực tiếp | Đổi API là sửa 20 chỗ | `features/<domain>/api` + hook TanStack Query |
| Feature A import component/hook của feature B | Feature dính nhau | Đưa lên `components/` hoặc ghép ở tầng trang |
| Hardcode `http://localhost:3000` trong web | Gãy khi chạy trong compose / đổi môi trường | `/api` qua proxy, địa chỉ khác lấy từ `src/config/env.ts` |
| Secret trong `NEXT_PUBLIC_*` / `VITE_*` | Lộ ra bundle công khai | Secret chỉ ở env của api |
| Biến module giữ token trong code chạy phía server Next | Mọi người dùng chung một biến → lộ phiên của nhau | Token chỉ trong trình duyệt; phía server chuyển tiếp cookie của request (`lib/api-server.ts`) |
| Lưu Bearer token vào `localStorage` | XSS đọc được token | Refresh token cookie httpOnly + access token trong bộ nhớ |
| `.env` / `.env.example` trong `apps/*` | Lệch quy ước, `.gitignore` chặn `.env.*` | `deployment/.env.example` + `deployment/local/.env` |
| Mount `node_modules` từ máy host vào container | Binary native build cho macOS vỡ trên Linux | Volume `node_modules` riêng (§2.1) |
| Tab/view chính chỉ nằm trong `useState` | F5, Back/Forward về view mặc định | Route |
| Query con chạy trước khi scope cha có | Lấy nhầm dữ liệu scope khác | `enabled: !!projectId` |

## 8. Snippet then chốt

### 8.1 API

**`main.ts`:**

```ts
// apps/api/src/main.ts
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  if (config.get("CORS_ORIGIN")) app.enableCors({ origin: config.get("CORS_ORIGIN"), credentials: true });
  if (config.get("APP_ENV") !== "production") {
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, new DocumentBuilder().build()));
  }

  await app.listen(config.get<number>("PORT") ?? 3000, "0.0.0.0");
}
bootstrap();
```

**`app.module.ts` + validate env:**

```ts
// apps/api/src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    LoggerModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        url: config.get("DATABASE_URL"),
        autoLoadEntities: true,   // entity khai qua TypeOrmModule.forFeature trong từng module
        synchronize: false,       // schema chỉ đổi qua migration
      }),
    }),
    HealthModule,
    BookingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

// apps/api/src/config/env.validation.ts
import { plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, validateSync } from "class-validator";

class Env {
  @IsIn(["development", "production"]) APP_ENV!: string;
  @IsOptional() @IsInt() PORT?: number;
  @IsString() DATABASE_URL!: string;
  @IsString() JWT_SECRET!: string;
  @IsOptional() @IsString() CORS_ORIGIN?: string;
}

export function validate(config: Record<string, unknown>) {
  const env = plainToInstance(Env, config, { enableImplicitConversion: true });
  const errors = validateSync(env);
  if (errors.length) throw new Error(errors.toString());
  return env;
}
```

**DataSource cho CLI migration:**

```ts
// apps/api/src/infra/database/data-source.ts — chỉ TypeORM CLI dùng
import { DataSource } from "typeorm";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [__dirname + "/../../modules/**/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
});
```

**DTO — nguồn sự thật của contract:**

```ts
// apps/api/src/modules/booking/dto/create-booking.dto.ts
import { CUSTOMER_NAME_MAX } from "@app/shared";
import { Type } from "class-transformer";
import { IsDate, IsString, Length } from "class-validator";

export class CreateBookingDto {
  @IsString() @Length(1, CUSTOMER_NAME_MAX)      // giới hạn lấy từ shared — web dùng cùng hằng số cho form
  customerName!: string;

  @Type(() => Date) @IsDate()
  startsAt!: Date;
}

// apps/api/src/modules/booking/dto/booking-response.dto.ts
import { BookingStatus } from "@app/shared";

export class BookingResponseDto {
  id!: string;
  customerName!: string;
  startsAt!: string;
  status!: BookingStatus;                        // plugin Swagger đưa enum vào OpenAPI
}
```

**Entity + repository — chỗ duy nhất chạm DB:**

```ts
// apps/api/src/modules/booking/booking.entity.ts
import { BookingStatus } from "@app/shared";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("bookings")
export class Booking {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("uuid") userId!: string;
  @Column() customerName!: string;
  @Column({ type: "timestamptz" }) startsAt!: Date;
  @Column({ type: "enum", enum: BookingStatus, default: BookingStatus.Pending }) status!: BookingStatus;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}

// apps/api/src/modules/booking/booking.repository.ts
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Booking } from "./booking.entity";

@Injectable()
export class BookingRepository {
  constructor(@InjectRepository(Booking) private readonly orm: Repository<Booking>) {}

  findOwned(userId: string, id: string) {
    return this.orm.findOneBy({ id, userId });
  }

  insert(userId: string, data: { customerName: string; startsAt: Date }) {
    return this.orm.save(this.orm.create({ ...data, userId }));
  }
}

// apps/api/src/modules/booking/booking.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Booking])],
  controllers: [BookingController],
  providers: [BookingService, BookingRepository],
})
export class BookingModule {}
```

**Service luôn kèm userId, trả DTO response:**

```ts
// apps/api/src/modules/booking/booking.service.ts
@Injectable()
export class BookingService {
  constructor(private readonly repo: BookingRepository) {}

  async findOne(userId: string, id: string): Promise<BookingResponseDto> {
    const booking = await this.repo.findOwned(userId, id);
    if (!booking) throw new NotFoundException("Không tìm thấy lịch hẹn");
    return toResponse(booking);
  }

  async create(userId: string, dto: CreateBookingDto): Promise<BookingResponseDto> {
    return toResponse(await this.repo.insert(userId, dto));
  }
}

const toResponse = (b: Booking): BookingResponseDto => ({
  id: b.id,
  customerName: b.customerName,
  startsAt: b.startsAt.toISOString(),
  status: b.status,
});
```

**Controller mỏng:**

```ts
// apps/api/src/modules/booking/booking.controller.ts
@Controller("bookings")
@UseGuards(AuthGuard)
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Get(":id")
  findOne(@CurrentUser() userId: string, @Param("id", ParseUUIDPipe) id: string): Promise<BookingResponseDto> {
    return this.bookings.findOne(userId, id);
  }

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateBookingDto): Promise<BookingResponseDto> {
    return this.bookings.create(userId, dto);
  }
}
```

**Health check — `/api/health`:**

```ts
// apps/api/src/health/health.module.ts
@Module({ imports: [TerminusModule], controllers: [HealthController] })
export class HealthModule {}

// apps/api/src/health/health.controller.ts
import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from "@nestjs/terminus";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthCheckService, private readonly db: TypeOrmHealthIndicator) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck("database")]);   // DB xuống → 503
  }
}
```

### 8.2 Web

**Dev proxy `/api` → api:**

```ts
// apps/web/next.config.ts (Next.js)
import type { NextConfig } from "next";

const config: NextConfig = {
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    return target ? [{ source: "/api/:path*", destination: `${target}/api/:path*` }] : [];
  },
};
export default config;

// apps/web/vite.config.ts (Vite)
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: process.env.API_PROXY_TARGET, changeOrigin: true } } },
});
```

Chạy web ngoài compose thì đặt `API_PROXY_TARGET=http://localhost:3000`.

**Env + API client phía trình duyệt:**

```ts
// apps/web/src/config/env.ts — nơi duy nhất đọc env
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "",  // "" = cùng origin; Vite: import.meta.env.VITE_API_BASE_URL
  apiInternalUrl: process.env.API_INTERNAL_URL,            // chỉ có ở server (Next)
};

// apps/web/src/lib/api-client.ts
import { env } from "../config/env";

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`API ${status}`);
  }
}

let accessToken: string | null = null;                     // chỉ trong bộ nhớ trình duyệt
export const setAccessToken = (t: string | null) => { accessToken = t; };

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}/api/${path.replace(/^\//, "")}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const body = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
```

**API client phía server (Next, chỉ khi Server Component cần dữ liệu):**

```ts
// apps/web/src/lib/api-server.ts
import "server-only";
import { cookies } from "next/headers";
import { env } from "../config/env";

export async function serverApiRequest<T>(path: string): Promise<T> {
  if (!env.apiInternalUrl) throw new Error("Thiếu API_INTERNAL_URL");
  const res = await fetch(`${env.apiInternalUrl}/api/${path.replace(/^\//, "")}`, {
    headers: { cookie: (await cookies()).toString() },     // chuyển tiếp phiên của CHÍNH request này
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}
```

**Feature gọi API qua hook, định kiểu bằng type sinh ra:**

```ts
// apps/web/src/features/booking/api/booking.api.ts
import type { components } from "../../../types/api";
import { apiRequest } from "../../../lib/api-client";

type CreateBookingDto = components["schemas"]["CreateBookingDto"];
type BookingResponseDto = components["schemas"]["BookingResponseDto"];

export const createBooking = (input: CreateBookingDto) =>
  apiRequest<BookingResponseDto>("bookings", { method: "POST", body: JSON.stringify(input) });

// apps/web/src/features/booking/hooks/useCreateBooking.ts
import { useMutation } from "@tanstack/react-query";
import { createBooking } from "../api/booking.api";

export const useCreateBooking = () => useMutation({ mutationFn: createBooking });
// component ("use client"): const m = useCreateBooking(); <button disabled={m.isPending} …>
```

**Providers (Next):**

```tsx
// apps/web/src/app/providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());       // mỗi phiên trình duyệt một client
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

### 8.3 Shared

```ts
// packages/shared/src/booking/booking.enums.ts
export enum BookingStatus {
  Pending = "pending",
  Confirmed = "confirmed",
  Cancelled = "cancelled",
}

export const CUSTOMER_NAME_MAX = 100;

// Hàm thuần — cùng một luật nghiệp vụ chạy ở cả api (chặn) lẫn web (ẩn nút)
export const canCancel = (status: BookingStatus) => status !== BookingStatus.Cancelled;

// packages/shared/src/index.ts — chỉ export lại
export * from "./booking/booking.enums";
```

Web dùng cùng enum và hằng số:

```tsx
// apps/web/src/features/booking/components/BookingStatusBadge.tsx
import { BookingStatus } from "@app/shared";

const LABEL: Record<BookingStatus, string> = {        // thêm giá trị enum mà quên nhãn → lỗi typecheck
  [BookingStatus.Pending]: "Chờ xác nhận",
  [BookingStatus.Confirmed]: "Đã xác nhận",
  [BookingStatus.Cancelled]: "Đã huỷ",
};

export const BookingStatusBadge = ({ status }: { status: BookingStatus }) => <span>{LABEL[status]}</span>;
```

`types/api.d.ts` sinh từ OpenAPI có `status` dạng union chuỗi `"pending" | "confirmed" | "cancelled"` — cùng
giá trị với enum ở shared nên gán qua lại được, không cần ép kiểu.

## 9. Checklist kiểm chứng

- [ ] `make dev` dựng db + shared + api + web; `api` lên trạng thái `healthy`; `http://localhost:3001` mở được.
- [ ] `http://localhost:3000/api/health` trả 200; dừng `db` thì trả 503.
- [ ] `make doctor` xanh với `deployment/local/.env` đầy đủ, báo đúng biến thiếu khi xoá một dòng.
- [ ] Chỉ có baseline §3.2 — không thư mục rỗng, không stub chưa dùng; không `.env*` trong `apps/*`.
- [ ] Không import chéo giữa `apps/web` và `apps/api`; `packages/shared` không import `apps/*`.
- [ ] `packages/shared` chỉ có enum, hằng số, hàm thuần — không framework, không `fs`/`window`, không interface request/response.
- [ ] Mọi thứ trong `packages/shared` được dùng ở **cả** api lẫn web; `pnpm --filter @app/shared build` xanh với `lib: ["ES2022"]`.
- [ ] Sửa một file trong `packages/shared` khi `make dev` đang chạy → api và web nhận bản mới không cần khởi động lại.
- [ ] `ValidationPipe` toàn cục bật `whitelist` + `forbidNonWhitelisted`; mọi body/params có DTO trong file `*.dto.ts`.
- [ ] `/api/docs-json` có đủ schema DTO; `pnpm api:types` không ra diff với `types/api.d.ts` đã commit.
- [ ] Chỉ `*.repository.ts` inject `Repository<Entity>` / `DataSource`; service luôn lọc theo `userId`, không trả entity.
- [ ] `synchronize: false`; mỗi thay đổi entity có migration trong cùng commit; `make migrate` chạy được trên DB trắng.
- [ ] Next không có nghiệp vụ trong `app/api/` hay Server Action; code phía server không giữ token trong biến module.
- [ ] Web chỉ đọc env trong `src/config/env.ts`; không secret trong biến công khai.
- [ ] Tab/view chính là route; F5 và Back/Forward giữ đúng view.
- [ ] `make check` typecheck web trước khi bundle; `make test` chạy được cả test API và Playwright.
- [ ] Version thật đã ghi vào `context/TECHSTACK.md §3`.
