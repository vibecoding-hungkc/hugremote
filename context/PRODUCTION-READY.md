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

- [ ] **Env/secret tách khỏi code** — không có key nào trong repo; `.env` trong `.gitignore`; `deployment/.env.example` liệt kê đủ biến
- [ ] **Migration có version** — schema đổi bằng file migration đánh số, không sửa tay trên production
- [ ] **Health check** — có endpoint trả trạng thái app + kết nối DB
- [ ] **Error tracking** — lỗi production tự báo về một nơi (Sentry hoặc tương đương), không phải chờ người dùng kêu
- [ ] **Structured log** — log ra JSON có timestamp + mức độ + request id; đủ để lần lại một lỗi
- [ ] **Backup DB** `(sau deploy)` — tự động, và **đã thử khôi phục một lần**

## Nhóm 2 — Auth + bảo mật

- [ ] **Đăng nhập** — dùng managed provider, không tự viết (trừ khi PRD §7 chốt là không cần đăng nhập)
- [ ] **Validate input** `(mỗi vòng)` — mọi dữ liệu từ ngoài vào đều qua schema validation ở tầng server
- [ ] **Rate limit** — ít nhất cho endpoint đăng nhập và endpoint ghi dữ liệu
- [ ] **HTTPS** `(sau deploy)` — bắt buộc, redirect http → https
- [ ] **Không hardcode secret** — đã grep lại toàn repo để chắc
- [ ] **Phân quyền** `(mỗi vòng)` — người dùng A không đọc/sửa được dữ liệu người dùng B (đã thử tay một lần)

## Nhóm 3 — CI/CD + test tối thiểu

- [ ] **Push là deploy** `(sau deploy)` — merge vào `main` thì tự lên production
- [ ] **`make check` chạy trong CI** — lint + typecheck + build, đỏ thì chặn deploy
- [ ] **Smoke test** `(mỗi vòng)` — luồng lõi ở `ARCHITECTURE.md §7` chạy tự động, pass
- [ ] **Test cho luồng tiền/dữ liệu quan trọng** `(mỗi vòng)` — chỗ nào sai là mất tiền hoặc mất dữ liệu thì phải có test

Không đặt mục tiêu coverage %. Test đúng chỗ quan trọng, không test cho đủ số. (Đây là nguyên tắc, không phải việc phải tick.)

## Nhóm 4 — Đo phản ứng thị trường

- [ ] **Analytics** `(sau deploy)` — đang đếm lượt truy cập + nguồn đến
- [ ] **Event tracking** `(mỗi vòng)` — các hành vi then chốt (đăng ký, hoàn tất luồng lõi, quay lại) đều có event
- [ ] **Kênh feedback** — người dùng phản hồi được ngay trong sản phẩm (form, email, hoặc chat)
- [ ] **Ngưỡng quyết định** `(mỗi vòng)` — đã ghi rõ con số nào thì go, số nào thì pivot, số nào thì kill (nguồn: `PRD.md §6`)

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
| | | |
