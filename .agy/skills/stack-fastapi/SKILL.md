---
name: stack-fastapi
description: >
  Stack Python FastAPI cho VIPER: FastAPI + SQLModel/SQLAlchemy + Alembic + Postgres, quản lý bằng uv,
  deploy Railway/Fly.io. Chọn khi sản phẩm dính AI/LLM, xử lý dữ liệu, hoặc cần thư viện Python.
  Nạp skill này khi TECHSTACK.md chốt stack-fastapi, hoặc khi đang chọn stack ở pha V cho sản phẩm có AI/data.
  Gồm: scaffold bằng uv, cấu trúc thư mục, 6 lệnh Makefile, preset production-ready, cách gọi LLM an toàn
  (timeout, retry, giới hạn chi phí), deploy, forbidden patterns, snippet then chốt.
---

# Stack — Python FastAPI

## 1. Khi nào chọn / không chọn

**Chọn khi**: sản phẩm gọi LLM hoặc xử lý dữ liệu · cần thư viện chỉ Python mới có · quen Python nên dựng nhanh hơn.

**Không chọn khi**: thuần CRUD có UI, không dính AI — Next.js ra sản phẩm nhanh hơn vì không phải dựng riêng frontend.

**Đánh đổi**: FastAPI chỉ là backend. Cần UI thì thêm một frontend riêng (Next.js/Vite) — hết một phần ngày 1. Nếu UI đơn giản, cân nhắc render server bằng Jinja2 + htmx để giữ một codebase.

## 2. Scaffold

```bash
uv init . --python 3.12
uv add fastapi "uvicorn[standard]" sqlmodel alembic pydantic-settings python-multipart
uv add asyncpg psycopg2-binary   # asyncpg: app chạy async · psycopg2: alembic chạy đồng bộ
uv add sentry-sdk structlog slowapi
uv add --dev pytest pytest-asyncio httpx ruff

uv run alembic init migrations

# Nếu có LLM
uv add anthropic

# Nếu render UI ngay trong app (khỏi dựng frontend riêng)
uv add jinja2
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

`.env`: `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/app`. Không có Docker → dùng Neon/Railway cho cả dev, ghi 1 dòng `DECISIONS.md`.

Ghi version thật vào `context/TECHSTACK.md §3`: `uv pip list | head -20`.

> Dùng model Claude nào, giá bao nhiêu, tham số ra sao — **không nhớ theo trí nhớ**, nạp skill `claude-api` rồi tra.

## 3. Cấu trúc thư mục

```
src/<app>/
├── main.py               # khởi tạo app, gắn middleware, router
├── config.py             # pydantic-settings — thiếu biến thì app KHÔNG lên
├── api/
│   ├── deps.py           # dependency: session DB, user hiện tại
│   └── routes/<domain>.py# CHỈ nhận request, validate, gọi service
├── services/<domain>.py  # logic nghiệp vụ
├── repositories/<domain>.py  # ← CHỈ chỗ này chạm DB
├── models/               # SQLModel table
├── schemas/              # pydantic request/response (tách khỏi model DB)
└── integrations/llm.py   # ← CHỈ chỗ này gọi LLM

migrations/versions/      # alembic — có version, commit vào repo
tests/
```

**Quy tắc bất di**: route không chạm DB · model DB không dùng làm response schema · mọi lời gọi LLM đi qua `integrations/llm.py`.

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
STACK_SKILL = stack-fastapi

dev:
	docker compose -f deployment/local/docker-compose.yml up -d db && uv run uvicorn src.<app>.main:app --reload --port 8000

check:
	uv run ruff check . && uv run ruff format --check . && uv run python -c "import src.<app>.main"

test:
	uv run pytest -q

migrate:
	uv run alembic upgrade head

deploy:
	git push origin main

doctor:
	@uv run python scripts/doctor.py
```

## 5. Preset production-ready

| Mục | Cách làm ở stack này |
|---|---|
| Env/secret | `pydantic-settings` — khai `Settings` bắt buộc, thiếu biến thì app **không khởi động được**. Phát hiện lúc deploy, không phải lúc người dùng bấm |
| Migration | `alembic revision --autogenerate` + `alembic upgrade head`. Đọc lại file sinh ra trước khi commit — autogenerate hay bỏ sót đổi tên cột |
| Health check | `GET /health` chạy `SELECT 1`, trả 200/503 |
| Error tracking | `sentry_sdk.init()` trong `main.py` |
| Structured log | `structlog` ra JSON, gắn request id bằng middleware |
| Backup | Postgres của Railway/Fly — bật snapshot, thử khôi phục một lần |
| Auth | `fastapi-users`, hoặc JWT tự làm với `python-jose` + `passlib[bcrypt]`. Đừng tự nghĩ cách hash |
| Validate | Pydantic schema ở tham số route — FastAPI tự validate và tự sinh tài liệu |
| Rate limit | `slowapi`, siết chặt ở route đăng nhập và route gọi LLM |
| Phân quyền | Dependency `get_current_user` + repository **luôn** kèm `user_id` |
| Chi phí LLM | Giới hạn `max_tokens`, đặt timeout, đếm token đã dùng, đặt trần theo ngày — xem §8 |

## 6. Deploy

| Thành phần | Nơi | Ghi chú |
|---|---|---|
| App | Railway hoặc Fly.io | Fly hợp khi cần chạy lâu/nền; Railway đơn giản hơn |
| Database | Postgres của Railway, hoặc Neon | |

Start command: `alembic upgrade head && uvicorn src.<app>.main:app --host 0.0.0.0 --port $PORT`

Rollback: redeploy bản trước từ dashboard. `alembic downgrade -1` cho schema — nhưng chỉ khi migration có viết phần `downgrade`, autogenerate không phải lúc nào cũng viết đúng. Đọc lại trước khi tin.

## 7. Forbidden patterns

| Cấm | Vì sao | Thay bằng |
|---|---|---|
| Route gọi thẳng session DB | Logic rò ra tầng vận chuyển | Route → service → repository |
| Dùng SQLModel table làm response | Lộ field nội bộ | Schema response riêng |
| Gọi hàm blocking trong `async def` | Chặn cả event loop, app đứng dưới tải | `await` thư viện async, hoặc `run_in_threadpool` |
| Gọi LLM không timeout, không `max_tokens` | Treo request, hoá đơn không kiểm soát | Xem §8 |
| Đưa dữ liệu người dùng vào prompt mà không giới hạn | Prompt injection, tốn token | Cắt độ dài, tách rõ phần dữ liệu và phần chỉ dẫn |
| `alembic upgrade` chạy tay trên production | Sớm muộn cũng quên một lần | Chạy trong start command |
| `except Exception: pass` | Nuốt lỗi, mất dấu vết | Log rồi ném lại, hoặc xử lý cụ thể |

## 8. Snippet then chốt

**Config bắt buộc — app không lên nếu thiếu biến:**

```python
# src/<app>/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    # Dùng driver async cho app: postgresql+asyncpg://...
    # Alembic chạy đồng bộ nên đổi sang postgresql+psycopg2://... trong env.py
    database_url: str
    app_env: str = "development"
    sentry_dsn: str | None = None
    anthropic_api_key: str | None = None
    llm_daily_token_budget: int = 1_000_000

settings = Settings()  # thiếu database_url → ném lỗi ngay khi import
```

`model_config = SettingsConfigDict(...)` chứ không phải `class Config` — pydantic-settings v2 đã bỏ lối cũ.

**Gọi LLM có kỷ luật** — timeout, trần token, đếm chi phí. Đây là chỗ sản phẩm AI hay chảy máu tiền nhất:

```python
# src/<app>/integrations/llm.py
import anthropic, structlog
from ..config import settings

log = structlog.get_logger()

# AsyncAnthropic, KHÔNG phải Anthropic: client đồng bộ đặt trong `async def` sẽ chặn
# cả event loop — chính là dòng đầu bảng §7. Một request LLM 10 giây làm đứng cả app.
client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=30.0)

MAX_INPUT_CHARS = 20_000

async def ask(system: str, user_content: str, *, max_tokens: int = 1024) -> str:
    if len(user_content) > MAX_INPUT_CHARS:
        user_content = user_content[:MAX_INPUT_CHARS]  # cắt, không để prompt phình vô hạn

    resp = await client.messages.create(
        model="<đọc skill claude-api để lấy model id hiện hành>",
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    log.info("llm_call",
             input_tokens=resp.usage.input_tokens,
             output_tokens=resp.usage.output_tokens)
    return resp.content[0].text
```

Model id, giá, tham số: nạp skill `claude-api`, đừng viết theo trí nhớ.

**Repository luôn kèm user_id:**

```python
async def get_booking(session: AsyncSession, user_id: str, booking_id: str) -> Booking | None:
    stmt = select(Booking).where(Booking.id == booking_id, Booking.user_id == user_id)
    return (await session.exec(stmt)).first()
```

**Health check:**

```python
from sqlalchemy import text

@app.get("/health")
async def health(session: AsyncSession = Depends(get_session)):
    try:
        await session.exec(text("SELECT 1"))
        return {"ok": True, "db": "up"}
    except Exception:
        return JSONResponse({"ok": False, "db": "down"}, status_code=503)
```
