# deployment/ — mọi thứ để CHẠY sản phẩm, tách khỏi code

> Code nằm ở gốc repo (đường phỏng vấn) hoặc `srcroot/` (đường intake).
> **Cách chạy** nó — biến môi trường, DB local, container, script khởi động — nằm ở đây.

```
deployment/
├── .env.example      ← danh sách TÊN biến cho cả hệ (file duy nhất được commit)
├── local/            ← chạy trên máy: docker-compose, seed, script khởi động
└── <môi trường>/     ← thêm khi cần (staging/, production/) — thường PaaS lo, xem DEPLOY.md
```

## Luật

1. **`.env.example` chỉ có TÊN biến + mô tả, không bao giờ có giá trị thật.** Đây là file
   duy nhất trong `deployment/` được commit ở dạng "có nội dung env". `make doctor` đọc nó
   để biết biến nào bắt buộc; `/viper-publish` đối chiếu nó khi đặt biến trên PaaS.
2. **`.env` thật không bao giờ commit.** `.gitignore` chặn `.env` và `.env.*` ở mọi cấp,
   chỉ chừa `deployment/.env.example`. Copy ra để chạy:
   `cp deployment/.env.example deployment/local/.env`.
3. **Artifact triển khai local viết vào `deployment/local/`, không rải ra gốc repo.**
   Pha I dựng cái gì để `make dev` chạy được thì để ở đó (danh sách bên dưới).
4. **`Makefile` ở gốc repo vẫn là hợp đồng 6 lệnh duy nhất.** Thân lệnh trỏ vào đây, ví dụ
   `docker compose -f deployment/local/docker-compose.yml up -d db`. Không thêm lệnh mới —
   `gate.py` chỉ biết sáu cái.

## `local/` — pha I viết gì vào đây

| Artifact | Khi nào cần |
|---|---|
| `docker-compose.yml` | DB local cho `make dev` — mọi stack trong kho đều dùng (xem `stack-<tên>/SKILL.md §2`) |
| `.env` | Bản copy từ `deployment/.env.example` đã điền giá trị local. **Không commit** |
| `init.sql` / `seed.*` | Dữ liệu mẫu để dùng thử — nguồn: `context/PRD.md §7` (dữ liệu mẫu). Không có dữ liệu thì `/viper-dogfood` không chạy được |
| `Dockerfile.dev`, script khởi động | Chỉ khi stack cần; đừng dựng sẵn "cho đủ bộ" |

**Đa target (đường intake):** `deployment/local/` là **dùng chung cho cả hệ** — một
`docker-compose.yml` khai mọi service local mà các target cần, không phải mỗi
`srcroot/<nhóm>/<tên>/` một compose riêng. Biến môi trường của từng target phân biệt bằng
cột "Target" trong `context/TECHSTACK.md §6`.

## Không nằm ở đây

| Thứ | Nằm đâu |
|---|---|
| Cách deploy lên PaaS, rollback, biến production | `context/shared/DEPLOY.md` |
| Stack + version đã chốt, danh sách biến kèm mô tả | `context/TECHSTACK.md §5–§6` |
| Checklist trước khi deploy | `context/PRODUCTION-READY.md` |
| Cấu hình CI (`.github/workflows/`) | Gốc repo — CI là hạ tầng của repo, không phải của một môi trường |
