---
name: stack-nextjs-fullstack
description: >
  Stack Next.js fullstack cho VIPER: App Router + TypeScript + Tailwind/shadcn + Drizzle + Postgres,
  deploy Vercel + Neon. Stack nhanh nhất để có sản phẩm chạy trong ngày 1 — một codebase vừa UI vừa server,
  không cần API riêng. Nạp skill này khi TECHSTACK.md chốt stack-nextjs-fullstack, hoặc khi đang chọn stack ở pha V
  cho một web app fullstack. Gồm: lệnh scaffold, cấu trúc thư mục, hiện thực 6 lệnh Makefile, preset production-ready
  (auth, migration, health check, error tracking, log), cách deploy, forbidden patterns, snippet then chốt.
---

# Stack — Next.js fullstack

## 1. Khi nào chọn / không chọn

**Chọn khi**: web app có UI là chính · một người làm · cần chạy được trong ngày 1 · chưa cần API cho bên thứ ba · dữ liệu quan hệ vừa phải.

**Không chọn khi**: mobile app sẽ dùng chung API (→ `stack-nestjs-react`) · xử lý nền nặng, hàng đợi, job dài (Vercel giới hạn thời gian chạy) · dính AI/LLM nhiều (→ `stack-fastapi`) · cần binary gọn chạy trên VPS (→ `stack-go`).

**Vì sao đây là mặc định của VIPER**: một codebase, một lần deploy, server code và UI cùng chỗ nên không mất thời gian định nghĩa API contract giữa hai bên — đúng thứ giết thời gian nhất trong ngày đầu.

## 2. Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --use-npm

# Dữ liệu
npm i drizzle-orm postgres
npm i -D drizzle-kit

# UI (tuỳ chọn nhưng nên có — tiết kiệm nhiều giờ dựng component)
npx shadcn@latest init

# Validate + form
npm i zod

# Production-ready
npm i @sentry/nextjs

# Test runner cho `make test` (khác với Playwright MCP dùng để dogfood)
npm i -D @playwright/test
npx playwright install chromium
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

`.env.local`: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/app`. Không có Docker → dùng luôn Neon (§6) cho cả dev và bỏ đoạn compose — ghi 1 dòng `DECISIONS.md`.

Ghi version thật vào `context/TECHSTACK.md §3` ngay sau khi cài xong: `npm ls next drizzle-orm --depth=0`.

**Không** giữ boilerplate riêng — luôn scaffold từ lệnh chính chủ để không nhận về đồ lỗi thời.

## 3. Cấu trúc thư mục

```
src/
├── app/                    # routing + layout. CHỈ điều hướng và ghép, không chứa logic nghiệp vụ
│   ├── (public)/           # trang không cần đăng nhập
│   ├── (app)/              # trang cần đăng nhập
│   ├── api/                # route handler — chỉ cho webhook và endpoint bên ngoài gọi vào
│   └── health/route.ts     # health check
├── features/               # theo TÍNH NĂNG, không theo loại file
│   └── <feature>/
│       ├── components/     # UI của tính năng này
│       ├── actions.ts      # server action — nơi UI gọi vào server
│       └── schema.ts       # zod schema cho input
├── server/                 # ← CHỈ chỗ này chạm DB
│   ├── db/
│   │   ├── index.ts        # client
│   │   └── schema.ts       # bảng (drizzle)
│   └── <domain>/           # logic nghiệp vụ, tách khỏi UI để test được
├── lib/                    # dùng chung: auth, log, tiện ích
└── components/ui/          # component dùng chung (shadcn đổ vào đây)

drizzle/                    # file migration sinh ra, có version — commit vào repo
```

**Quy tắc bất di**: `app/` và `features/components/` không import từ `server/db`. Muốn lấy dữ liệu thì gọi qua `actions.ts` → `server/<domain>`.

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
STACK_SKILL = stack-nextjs-fullstack

dev:
	docker compose -f deployment/local/docker-compose.yml up -d db && npm run dev

check:
	npx tsc --noEmit && npm run lint && npm run build

test:
	npx playwright test

migrate:
	npx drizzle-kit generate && npx drizzle-kit migrate

deploy:
	git push origin main   # Vercel tự deploy; migration chạy trong build hook

doctor:
	@node scripts/doctor.mjs
```

`scripts/doctor.mjs` đọc `deployment/.env.example`, so với `process.env`, in biến nào thiếu, rồi thử kết nối DB một phát.

`make test` cần `playwright.config.ts` + thư mục `tests/` — sinh cùng smoke test đầu tiên ở pha P (`viper-test-writer` lo). Trước đó `npx playwright test` báo "no tests found" là bình thường.

## 5. Preset production-ready

| Mục | Cách làm ở stack này |
|---|---|
| Env/secret | `.env.local` cho local, biến production đặt trên Vercel dashboard. Biến dùng ở client **bắt buộc** prefix `NEXT_PUBLIC_` — chỉ đặt thứ không nhạy cảm vào đó |
| Migration | `drizzle-kit generate` sinh file SQL có version vào `drizzle/`, commit vào repo. Chạy migrate trong build hook của Vercel |
| Health check | `src/app/health/route.ts` — trả 200 kèm kết quả `select 1` trên DB |
| Error tracking | `npx @sentry/wizard@latest -i nextjs` — tự gắn cả client, server, edge |
| Structured log | `pino` cho server. Không `console.log` trong code chạy production |
| Backup | Neon/Supabase có snapshot tự động — bật lên, thử khôi phục một lần |
| Auth | Clerk (nhanh nhất, ~20 phút) hoặc Auth.js (miễn phí, tự chủ hơn, tốn ~1-2h). Chốt ở `PRD.md §7` |
| Validate | `zod` schema trong `features/<f>/schema.ts`, **parse ở đầu server action** — không tin dữ liệu từ client |
| Rate limit | `@upstash/ratelimit` + Upstash Redis (free tier), chặn ở middleware cho route ghi |
| Phân quyền | Mọi truy vấn kèm điều kiện `userId` — không bao giờ lấy bản ghi chỉ bằng id |
| Analytics | Vercel Analytics (một dòng) hoặc PostHog (nếu cần event tracking chi tiết hơn) |

## 6. Deploy

| Thành phần | Nơi | Ghi chú |
|---|---|---|
| App | Vercel | Kết nối repo GitHub, push `main` là deploy |
| Database | Neon hoặc Supabase | Postgres managed, có branch cho preview |
| Redis (nếu cần rate limit) | Upstash | Free tier đủ cho MVP |

```bash
npm i -g vercel && vercel link      # lần đầu
vercel env pull .env.local           # kéo biến production về local
```

Migration khi deploy: thêm `"vercel-build": "drizzle-kit migrate && next build"` vào `package.json` scripts.

Rollback: Vercel dashboard → Deployments → bản trước → Promote to Production (~30 giây). Nhớ rằng **rollback code không rollback schema** — vì thế mới có luật cộng-trước-xoá-sau ở `shared-production-ready` nhóm 1.

## 7. Forbidden patterns

| Cấm | Vì sao | Thay bằng |
|---|---|---|
| Import `server/db` trong component | Rò rỉ kết nối DB ra client, hoặc build lỗi khó hiểu | Server action gọi `server/<domain>` |
| `"use client"` ở layout gốc | Mất toàn bộ lợi ích server component, bundle phình | Đánh dấu client ở component nhỏ nhất cần tương tác |
| Lấy bản ghi chỉ bằng id, không kèm `userId` | Lỗ hổng phân quyền phổ biến nhất | `where(and(eq(t.id, id), eq(t.userId, userId)))` |
| Secret không có prefix nhưng dùng ở client | Build pass, chạy mới lỗi, hoặc lộ secret nếu lỡ prefix | Giữ secret ở server, truyền xuống thứ đã lọc |
| `fetch` API nội bộ của chính mình từ server | Thêm một vòng mạng vô nghĩa | Gọi thẳng hàm trong `server/` |
| `any` để cho qua typecheck | Mất luôn tác dụng của TypeScript | Khai kiểu thật, hoặc `unknown` + zod parse |
| Job dài trong route handler | Vercel cắt theo thời gian, chạy nửa chừng thì hỏng dữ liệu | Tách bước, hoặc chuyển stack |

## 8. Snippet then chốt

**Server action có validate + phân quyền** — khuôn mẫu cho mọi thao tác ghi:

```ts
// src/features/booking/actions.ts
"use server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createBooking } from "@/server/booking";

const Input = z.object({
  customerName: z.string().min(1, "Chưa nhập tên khách"),
  startsAt: z.coerce.date(),
});

export async function createBookingAction(raw: unknown) {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Cần đăng nhập" };

  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    const booking = await createBooking(userId, parsed.data);
    return { ok: true, booking };
  } catch (e) {
    // Lỗi nghiệp vụ đã biết trước thì trả câu tiếng Việt nói được phải làm gì
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return { ok: false, error: "Khung giờ này đã có lịch, chọn giờ khác giúp bạn nhé" };
    }
    throw e; // lỗi lạ → để Sentry bắt
  }
}
```

**Truy vấn luôn kèm userId**:

```ts
// src/server/booking/index.ts
export async function getBooking(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.userId, userId)));
  return row ?? null;
}
```

**Health check**:

```ts
// src/app/health/route.ts
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
```

**Chống gửi hai lần** (ca biên bắt buộc xử trong `ARCHITECTURE.md §6`): ràng buộc unique ở tầng DB, không chỉ disable nút ở UI.

```ts
// src/server/db/schema.ts
export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  resourceId: uuid("resource_id").notNull(),
  startsAt: timestamp("starts_at").notNull(),
}, (t) => ({
  noDoubleBooking: unique().on(t.resourceId, t.startsAt),
}));
```
