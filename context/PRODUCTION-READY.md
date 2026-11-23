---
type: production-ready
tier: T1
status: DRAFT
last_reviewed: "2026-11-21"
---

# PRODUCTION READY — hugremote

> Gate của pha P. Đây là thứ phân biệt "sản phẩm 1 tuần" với "đồ dùng rồi vứt".
> Cách làm từng mục theo stack: `.claude/skills/stack-<tên>/SKILL.md §5`. Bản chung: `.claude/skills/shared-production-ready/SKILL.md`.

**Mục gắn `(sau deploy)` chỉ làm được khi đã có production thật** — không có PaaS thì không thể bật backup, không có lượt truy cập thì analytics không đếm được gì. Vì vậy pha P có hai gate:

**Mục gắn `(mỗi vòng)` phải kiểm LẠI ở mỗi vòng** — chúng đúng cho tính năng vòng trước, không tự đúng cho tính năng vòng này (input mới cần validate mới, hành động mới cần thử phân quyền mới). `scripts/repeat.py --go` tự bỏ tick các mục này khi mở vòng; hạ tầng (HTTPS, backup, push-là-deploy…) giữ nguyên.

| Gate | Khi nào chạy | Đòi gì |
|---|---|---|
| `gate.py P1` | Trước khi `/viper-publish` | Mọi mục **không** gắn `(sau deploy)` |
| `gate.py P2` | Trước khi rời pha P sang E | **Toàn bộ** 4 nhóm + DEPLOY.md + production sống |

Đừng chờ đủ cả 4 nhóm rồi mới deploy — vài mục chỉ tick được sau khi deploy xong.

---

## Nhóm 1 — Nền kỹ thuật

- [x] **Env/secret tách khỏi code** — `.gitignore` chặn `.env`/`.env.*` ở mọi cấp; `deployment/.env.example` chỉ TÊN biến; `git log -p` grep secret pattern: sạch (chuỗi khớp đều là fixture test, không phải secret thật)
- [x] **Migration có version** — `synchronize: false` (G-8); 1 migration đánh số `0001-init.ts`, chạy qua `migrationsRun: true`, không sửa tay schema
- [x] **Health check** — `GET /api/health` trả `{status}`, không lộ chi tiết (AC-15)
- [x] **Error tracking** — self-host theo TECHSTACK §: pino JSON → `DATA_DIR/logs/app.log`, lỗi HTTP qua `ErrorFilter` + log stack; vá thêm `process.on('uncaughtException'/'unhandledRejection')` ở `main.ts` (2026-11-23) — trước đó crash ngoài context HTTP thoát thẳng ra stderr, không vào app.log nên không hiện ở Hệ thống; giờ log rồi thoát, systemd/launchd `Restart=on-failure`/`KeepAlive` tự khởi động lại
- [x] **Structured log** — pino JSON có `time`, `level`, `req.id` (xác nhận trong `app.log` thật); redact 13 trường nhạy cảm (`common/logger.ts`)
- [ ] **Backup DB** `(sau deploy)` — tự động, và **đã thử khôi phục một lần**

## Nhóm 2 — Auth + bảo mật

- [x] **Đăng nhập** — owner: tự viết có chủ đích (PBKDF2-SHA512 100k, khoá 5 lần sai, JWT refresh httpOnly SameSite=Strict xoay theo thiết bị) vì PRD §7 chốt kiến trúc tự host (không PaaS) khiến managed SaaS không hợp cho chính tài khoản đó; member: SSO Google/OIDC (managed) — xem DECISIONS 2026-11-23 lý do đầy đủ
- [x] **Validate input** `(mỗi vòng)` — `ValidationPipe({whitelist,forbidNonWhitelisted,transform})` global ở mọi route HTTP; WS terminal: JSON điều khiển try/catch + clamp cols/rows (2–500/2–300)
- [x] **Rate limit** — `ThrottlerGuard` global 600/60s + riêng đăng nhập/2FA 10–20/60s (`auth.controller.ts`)
- [x] **Không hardcode secret** — grep `git log -p` theo pattern api-key/secret/password/token: sạch (khớp đều là fixture test)
- [x] **Phân quyền** `(mỗi vòng)` — dogfood `breaker` đã thử tay 28/28 route ma trận §2 (1 lỗ hổng 2FA route tìm+vá); review tĩnh pha P1 (bug-hunter + reviewer độc lập) tìm thêm 2 lỗ hổng NẶNG: (1) WS terminal ghi phím vào PTY TRƯỚC khi `attach()` xác nhận chủ phiên (`terminal.gateway.ts`) — vá bằng đệm hàng đợi, chỉ xả sau khi attach() xác nhận + test `terminal.gateway.spec.ts`; (2) `GET /hosts/:id/browse` thiếu `@Roles(OWNER)` — member duyệt được toàn bộ cây thư mục mọi máy (recon) — vá + test ở `core-flow.e2e.mjs`; nhẹ: `HostDto.keyPath`/`configFile` ẩn khỏi member

## Nhóm 3 — CI/CD + test tối thiểu

- [ ] **Push là deploy** `(sau deploy)` — merge vào `main` thì tự lên production
- [x] **`make check` chạy trong CI** — `.github/workflows/ci.yml`: `make check` + `make test` mỗi push/PR
- [x] **Smoke test** `(mỗi vòng)` — `apps/api/test/core-flow.e2e.mjs`: đăng nhập → máy SSH → dự án → terminal → Claude xin quyền ghi file → Files thấy → Git commit, tự động, 6/6 PASS (`make test`)
- [x] **Test cho luồng tiền/dữ liệu quan trọng** `(mỗi vòng)` — không thu tiền (PRD §7); dữ liệu quan trọng có test: tạo dự án trùng không nhân bản, sửa file đồng thời `FILE_CHANGED` không mất dữ liệu, duyệt quyền Claude hai lần bị chặn, hàng chờ tin nhắn không mất/không vượt giới hạn, member không đọc/ghi được phiên+máy của owner — cùng `core-flow.e2e.mjs`

Không đặt mục tiêu coverage %. Test đúng chỗ quan trọng, không test cho đủ số. (Đây là nguyên tắc, không phải việc phải tick.)

## Nhóm 4 — Đo phản ứng thị trường

- [ ] **Analytics** `(sau deploy)` — đang đếm lượt truy cập + nguồn đến
- [x] **Event tracking** `(mỗi vòng)` — cố tình bỏ qua, xem §Đã cố tình bỏ qua
- [x] **Kênh feedback** — cố tình bỏ qua, xem §Đã cố tình bỏ qua
- [x] **Ngưỡng quyết định** `(mỗi vòng)` — `PRD.md §6`: ≥7 ngày dùng liên tục thay v1 → GO · quay lại v1 trong 3 ngày đầu → PIVOT · quay lại v1 sau một lượt sửa → KILL; đo bằng nhật ký dùng cục bộ của Authority, không phải analytics (PRD §6 chốt "vòng này không chạy pha E")

---

## Rollback

Điền trước khi publish. Lúc production hỏng không ai còn bình tĩnh đọc tài liệu dài.

```
Lệnh rollback   : _CHƯA ĐIỀN_
Mất bao lâu     : _CHƯA ĐIỀN_
Dữ liệu thì sao : _CHƯA ĐIỀN_ (migration có rollback được không)
Ai bấm          : Authority
```

## Đã cố tình bỏ qua

Mục nào cố tình không làm thì ghi vào đây kèm lý do và điều kiện làm lại — đừng để trống mà lờ đi.

| Mục | Vì sao bỏ qua | Làm lại khi |
|---|---|---|
| Event tracking (Nhóm 4) | PRD §6 chốt rõ: vòng này không chạy pha E, metric go/pivot/kill là **Authority tự quan sát** mình có dùng bản mới thay v1 ≥7 ngày hay không — không phải funnel "đăng ký/hoàn tất/quay lại" của sản phẩm nhiều người dùng. Công cụ tự host một-chủ, không có ai khác để đo hành vi | Vòng mở ra cho người dùng khác ngoài Authority (vd. nhóm dùng SSO thật đông hơn), hoặc có pha E chạy thật |
| Kênh feedback trong sản phẩm (Nhóm 4) | Người dùng duy nhất là Authority — người cũng đang xây sản phẩm; kênh feedback đã có sẵn là chat với agent + `context/DECISIONS.md`/`STATE.md`, không cần thêm form trong app cho chính mình | Có người dùng khác ngoài Authority |
