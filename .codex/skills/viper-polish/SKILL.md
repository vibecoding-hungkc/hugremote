---
name: viper-polish
description: "Pha P (nửa đầu) — chạy checklist production-ready 4 nhóm, spawn subagent soi bug và viết test — CHỈ chạy khi người dùng gõ /viper-polish hoặc $viper-polish."
---

# /viper-polish — Pha P, nửa đầu

> **LUẬT #2 — KHÔNG HỎI AUTHORITY.** Mơ hồ → tự quyết + ghi `DECISIONS.md`. Ngoài scope → `ROADMAP.md` backlog.
> Ngoại lệ duy nhất: hành động không đảo ngược được / hướng ra ngoài.

## Bước 0 — Vòng này có chạy pha P không?

**Chế độ intake** (`context/INTERVIEW.md` mang `NGUỒN: INTAKE`): đọc dòng `Pha vòng này` trong `intake/loops/l<N>/_PROPOSAL.md`.

- **Không có `P`** → dừng ngay tại đây. Vòng này chỉ V+I theo kế hoạch ([VIPER.md §1.4](../../VIPER.md)) — chưa đủ thứ đáng deploy thì deploy là nghi thức. Đi thẳng `/viper-repeat` để đóng vòng. `gate.py P1` cũng tự bỏ qua và in lý do.
- **Có `P`** → sửa `STATE.md` → `Pha hiện tại : P1` (hook `guard_ask` + `gate.py` đọc dòng này), rồi đi tiếp Bước 1.

Đường phỏng vấn: luôn đi tiếp (mọi vòng chạy trọn 5 pha).

Đích: `context/PRODUCTION-READY.md` xanh **phần làm được khi chưa có production** — tức gate `P1`. Vài mục (backup, HTTPS, push-là-deploy, analytics đang đếm) gắn `(sau deploy)` và chỉ tick được ở `/viper-publish`; đừng chờ chúng.

## Bước 1 — Nạp

Skill `shared-production-ready` + `stack-<tên>/SKILL.md §5` + `context/PRODUCTION-READY.md` (xem còn thiếu gì).

## Bước 2 — Spawn subagent soi song song

Gửi cả ba trong **một** lượt:

| Agent | Việc |
|---|---|
| `viper-bug-hunter` | Soi toàn repo đối chiếu AC trong PRD, tìm chỗ chưa xử ca biên |
| `viper-reviewer` | Review theo `SOLUTION.md §A3` (quy ước `G-…`) + `CONVENTIONS.md` + `SECURITY.md`, tìm lỗ hổng phân quyền |
| `viper-test-writer` | Viết smoke test luồng lõi + test luồng tiền/dữ liệu quan trọng |

Trong lúc chờ, tự làm nhóm 1 ở bước 3 — đừng ngồi không.

## Bước 3 — Bốn nhóm, theo thứ tự

Nhóm 1 là nền; thiếu nó thì các nhóm sau vô nghĩa.

### Nhóm 1 — Nền kỹ thuật
Env/secret tách khỏi code · migration có version · health check · error tracking · structured log. Backup gắn `(sau deploy)` — bật và **thử khôi phục một lần** ở `/viper-publish`, đừng chờ nó ở đây.

Kiểm secret đã lỡ commit:
```bash
git log -p | grep -inE '(api[_-]?key|secret|password|token)\s*[=:]\s*["\x27][A-Za-z0-9_-]{12,}'
```
Ra kết quả → **xoay key mới ngay**, không chỉ xoá commit. Đã push là đã lộ.

### Nhóm 2 — Auth + bảo mật
Theo `context/shared/SECURITY.md`.

**Phép thử phân quyền bắt buộc** — lỗ hổng phổ biến nhất của MVP. Spec là ma trận vai × hành động ở `context/PERSONAS.md §2` — chạy cho **từng ô ✗**, không chỉ một cặp A/B:
```
1. Đăng nhập tài khoản A, tạo một bản ghi, ghi lại id
2. Đăng nhập tài khoản B
3. Gọi thẳng URL/API tới id của A
4. Phải bị chặn. Không chặn → sửa NGAY, đây là lỗi P1
5. Lặp cho mọi ô ✗ còn lại trong ma trận (kể cả cột "chưa đăng nhập")
```

### Nhóm 3 — CI/CD + test tối thiểu
Push là deploy · `make check` chạy trong CI, đỏ thì chặn deploy · smoke test luồng lõi · test luồng tiền/dữ liệu.

Không đặt mục tiêu coverage. Test đúng chỗ quan trọng.

### Nhóm 4 — Đo phản ứng thị trường
Nhóm hay bị bỏ nhất, và là nhóm khiến cả tuần vô nghĩa nếu thiếu — không đo thì cuối tuần không có căn cứ quyết go hay kill.

Analytics · event tracking (bắt đầu luồng lõi / hoàn tất / bỏ giữa chừng kèm bước / quay lại lần 2) · kênh feedback · ngưỡng quyết định lấy từ `PRD.md §6`.

### Vòng ≥ 2 — tương thích ngược (bắt buộc trước khi sang Bước 4)

Mở `context/BACKWARD-COMPATIBILITY-CHECKLIST.md`:

1. **Cập nhật sổ hợp đồng §1** — surface vòng này mới tạo (endpoint, bảng, cache key, event, webhook, format export) thêm dòng; loại chưa có ghi `KHÔNG CÓ`.
2. **Rà từng mục §3** đối chiếu luật additive-first §2: mọi thay đổi của vòng này vào surface cũ phải là THÊM, hoặc đã version hoá (API /v2, key cache `v2:`, event-type mới, expand-migrate cho DB). Tick từng mục; loại không áp dụng tick kèm `n/a`.
3. Chỗ nào phá mà Authority **chưa chốt** ở một trong ba nơi hợp lệ — `intake/loops/l<N>/*.md` · mục "Legacy được phép phá" của `intake/loops/l<N>/_PROPOSAL.md` · chốt qua chat ở pha V (đã ghi hộ vào đó) → ngoại lệ "hỏi thật", dừng hỏi — không tick bừa cho qua.

`gate.py P1` đếm §3, và hook `guard_bc` **chặn `make deploy`** tới khi §3 xanh — tick gian là tự lừa mình chứ không qua được ai.

## Bước 4 — Gộp phát hiện từ subagent

| Loại | Xử |
|---|---|
| Lỗ hổng phân quyền, mất dữ liệu, hỏng luồng lõi | Sửa ngay, không hoãn |
| Bug trong scope | Sửa, hoặc `STATE.md` nếu tốn thời gian |
| Ngoài scope | `ROADMAP.md` backlog |
| Test do `viper-test-writer` viết | Chạy thử; đỏ vì test sai thì sửa test, đỏ vì code sai thì sửa code |

Đề xuất của subagent là **đề xuất** — tự quyết nhận hay không, quyết khác thì ghi `DECISIONS.md`.

## Bước 5 — Chốt

```bash
make check && make test        # xanh
python3 scripts/gate.py P1     # điều kiện vào /viper-publish
```

Mục nào cố tình bỏ qua → ghi `PRODUCTION-READY.md §Đã cố tình bỏ qua` kèm rủi ro và điều kiện làm lại. Để trống mà lờ đi là cách sản phẩm chết ba tuần sau.

Tick checklist trong `STATE.md`, rồi `/viper-publish`.

## Ranh giới

- Không thêm tính năng ở pha này. Tính năng mới → `ROADMAP.md` backlog.
- Không refactor cho đẹp. Chỉ sửa thứ chặn production-ready.
- Không đuổi theo coverage %.
