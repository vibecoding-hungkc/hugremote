---
type: techstack
tier: T0
status: DRAFT
last_reviewed: "2026-11-21"
---

# TECHSTACK — hugremote

> Chốt ở pha V, kèm 1 dòng lý do trong `DECISIONS.md`. Đổi stack sau pha V = phá luật #1, phải ghi đánh đổi.
> Cấu trúc per-target lấy theo `intake/_TECHSTACK-TEMPLATE.md`.

---

## 1. Stack theo target

<!-- ĐƯỜNG PHỎNG VẤN: đúng MỘT khối dưới đây, giữ tên target là `app` — một app, một DB,
     một nơi deploy (luật #5), scaffold thẳng vào gốc repo theo stack skill.

     ĐƯỜNG INTAKE: lặp khối `### Target: <tên>` cho mỗi boundary/experience trong
     ARCHITECTURE.md §1–§3, tên khớp thư mục code `srcroot/<nhóm>/<tên>/` — nhóm là
     boundaries | web-experiences | mobile-experiences. Giữ nguyên Choice +
     Reason của intake/TECHSTACK.md — INTAKE THẮNG DEFAULT CỦA STACK SKILL (VIPER.md §1.3):
     intake nói Prisma + Chakra thì không đổi sang Drizzle + shadcn cho hợp skill.
     Xoá dòng nào target không dùng; thêm dòng nào intake có mà bảng chưa liệt kê. -->

### Target: `app`

| Hạng mục | Chọn | Version | Lý do |
|---|---|---|---|
| Skill đang dùng | _CHƯA ĐIỀN_ | — | |
| Ngôn ngữ | _CHƯA ĐIỀN_ | | |
| Framework | | | |
| Database | | | |
| ORM / query layer | | | |
| Auth | | | |
| UI kit | | | |
| Test runner | | | |
| Deploy | | | |

`Skill đang dùng` phải là một trong: `stack-nextjs-fullstack` · `stack-nestjs-react` · `stack-nestjs-react-fullstack` · `stack-fastapi` · `stack-go` · `stack-spring-boot` (+ `addon-graphql` nếu có), hoặc — chỉ ở đường intake — `custom (intake — theo intake/TECHSTACK.md)`. Chi tiết cách dựng, cấu trúc thư mục, preset production-ready nằm trong `.claude/skills/<tên>/SKILL.md` — **không chép lại vào đây**.

<!-- Đường intake chọn được skill khớp nhất nhưng intake khác default ở vài chỗ → thêm
     mục này ngay dưới bảng của target đó, liệt kê từng chỗ lệch. Không có thì xoá.

     ### Sai khác so với skill
     | Hạng mục | Skill mặc định | Intake chốt | Vì sao theo intake |
-->

## 2. Hạ tầng dùng chung

<!-- Thứ nằm ngoài từng target: DB dùng chung, cache, message broker, object storage,
     error tracking, analytics, CI. Đường phỏng vấn thường chỉ có 2–3 dòng. -->

| Hạng mục | Chọn | Version | Dùng cho target nào |
|---|---|---|---|
| Error tracking | _CHƯA ĐIỀN_ | | |
| Analytics | | | |

## 3. Vì sao chọn stack này

_CHƯA ĐIỀN_

<!-- 2-3 câu. Ràng buộc thật là gì (quen tay? cần AI? cần deploy nhanh? đội sẵn có?).
     Quyết định tương ứng đã ghi ở DECISIONS.md dòng nào.
     Đường intake: stack do intake chốt — ghi lại ràng buộc mà intake nêu, và những chỗ
     phải tự quyết vì intake không nói. -->

## 4. Version pinning

Ghi version thật sau khi scaffold xong (đọc từ `package.json` / `go.mod` / `pyproject.toml` / `pom.xml`), để lần sau dựng lại được đúng.

```
_CHƯA ĐIỀN_
```

## 5. Hợp đồng lệnh

Sáu lệnh dưới đây phải chạy được sau pha I. Phần thân do stack skill quy định.

| Lệnh | Làm gì | Đã hoạt động? |
|---|---|---|
| `make dev` | Chạy local (app + db) | ☐ |
| `make check` | Lint + typecheck + build | ☐ |
| `make test` | Smoke + luồng quan trọng | ☐ |
| `make migrate` | DB migration có version | ☐ |
| `make deploy` | Đẩy lên PaaS | ☐ |
| `make doctor` | Kiểm env + kết nối, in cái gì thiếu | ☐ |

Đa target: **root `Makefile` vẫn là hợp đồng 6 lệnh duy nhất** — thân từng lệnh điều phối xuống các target (`make -C srcroot/<nhóm>/<tên> …`). Deploy luôn đi qua root `make deploy`; đó là chỗ hook `guard_bc` đứng.

## 6. Biến môi trường

Danh sách đầy đủ ở `deployment/.env.example`. Không bao giờ commit `.env` thật —
bản điền giá trị local nằm ở `deployment/local/.env` (đã bị `.gitignore` chặn).

| Biến | Dùng để | Target | Bắt buộc? |
|---|---|---|---|
| _CHƯA ĐIỀN_ | | | |
