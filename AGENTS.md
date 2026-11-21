<!-- viper-kit: SINH TỪ CLAUDE.md — đừng sửa file này.
     Sửa CLAUDE.md (nguồn luật của VIPER) rồi chạy lại `npx viper-kit init <provider>`. -->

# hugremote — CLAUDE.md (VIPER v1.9.2)

> **Đọc top-to-bottom mỗi phiên.** Quy trình đầy đủ: [VIPER.md](VIPER.md). Trạng thái hiện tại: [STATE.md](STATE.md).

---

## 0. ĐANG ĐI ĐƯỜNG NÀO

VIPER có **hai đường vào**, ràng buộc khác nhau. Nhận diện bằng đúng một dấu hiệu: `context/INTERVIEW.md` có marker `NGUỒN: INTAKE` (ngoài comment) hay không.

| | **Đường phỏng vấn** | **Đường intake** |
|---|---|---|
| Bối cảnh | Founder/PO có ý tưởng, test thị trường 1 tuần | Tài liệu MESH-render đã phân tích kỹ; hệ thống lớn chia vòng chạy dần |
| Cỡ | 1 app, 1 DB, 1 nơi deploy | Đa target `srcroot/{boundaries,web-experiences,mobile-experiences}/<tên>/` |
| Số AC · persona | 3–7 AC · 2–3 persona | Không trần — AC truy về `CAPABILITIES-MAP.md`; persona theo intake |
| Nhịp | 1 tuần, khoá scope 2 tiếng | Mỗi vòng tự khai thời lượng |
| Pha mỗi vòng | Trọn V-I-P-E-R | **V + I bắt buộc**; P/E/R theo `intake/loops/l<N>/_PROPOSAL.md` |
| Prototype | MỘT `prototype/index.html` | `prototype/<experience>/index.html` |

**Đừng mang luật của đường này áp sang đường kia** — ràng buộc của đường phỏng vấn là ràng buộc tốc độ của bối cảnh một tuần, không phải luật của VIPER. Chi tiết: [VIPER.md §0, §1.3, §1.4](VIPER.md).

---

## 1. TÁM LUẬT

1. **Scope khoá sau pha V.** Phát sinh → `context/ROADMAP.md` backlog, không chèn vào vòng này.
2. **Sau pha V: toàn quyền, không hỏi lại.** Từ pha I trở đi **KHÔNG dùng tool hỏi người dùng** (§3).
3. **Quyết định không hiển nhiên → 1 dòng `context/DECISIONS.md` TRƯỚC khi code.**
4. **Context là nguồn sự thật.** Code lệch tài liệu → sửa tài liệu **cùng commit**.
5. **Cỡ sản phẩm theo đường vào** (§0). Phỏng vấn: một app, một DB, một nơi deploy, scaffold gốc repo. Intake ([VIPER.md §1.3](VIPER.md)): đa target theo intake ARCHITECTURE, code ở `srcroot/<nhóm>/<tên>/` (ba nhóm: `boundaries` · `web-experiences` · `mobile-experiences`), **không tự đẻ target ngoài danh sách** và không gộp hai target cho gọn.
6. **Không secret trong code, không bypass test/lint.**
7. **Tiếng Việt có dấu** cho mọi văn bản người đọc (giữ tiếng Anh cho identifier, API path, schema field, tên lệnh, tên file).
8. **Im lặng với Authority, đối kháng với nhau.** Challenge trước khi code + dogfood trước khi báo xong (§4).

---

## 2. NĂM PHA

```
V Validate ─► I Implement ─► P Polish&Publish ─► E Evaluate ─► R Repeat
  ↑ nơi DUY NHẤT được hỏi Authority

phỏng vấn: D1 sáng · D1 còn lại · D2 · D2–D5 · cuối tuần — trọn 5 pha mỗi vòng
intake:    V và I bắt buộc mọi vòng; P/E/R chỉ ở vòng khai trong _PROPOSAL.md
```

Pha hiện tại nằm ở [STATE.md](STATE.md). Kiểm gate: `python3 scripts/gate.py` (tự đọc pha từ STATE.md) hoặc `python3 scripts/gate.py <V|I|P|P1|P2|E|R>`.

Bảng dưới là bản rút gọn. **Định nghĩa chuẩn ở [VIPER.md §1.1](VIPER.md) — lệch nhau thì VIPER.md thắng.**

| Pha | Gate rời pha |
|---|---|
| V | PRD + PERSONAS + TECHSTACK + ARCHITECTURE đủ mục · số AC: phỏng vấn 3–7, intake không trần nhưng mọi AC phải có ở `CAPABILITIES-MAP.md` · **vòng 1**: phỏng vấn → INTERVIEW đủ 14 dòng bằng chứng; intake → `intake/PRD.md` render thật + marker `NGUỒN: INTAKE` + bảng truy vết + `CAPABILITIES-MAP.md` đã tách + **kế hoạch vòng** (`ROADMAP.md §1` khớp `l<N>/_PROPOSAL.md`, [VIPER.md §1.4](VIPER.md)) · **vòng ≥2 (không phỏng vấn, INTERVIEW đóng băng)**: phỏng vấn → `intake/loops/l<N>/` có ≥1 tài liệu vòng thật từ Authority; intake → `_PROPOSAL.md` thật + dòng `Rà lại vòng N: <ISO>` ngày ≥ `Vòng mở` · có UI thì DESIGN-SYSTEM chốt **trước** prototype (token dùng thật · không dùng token ngoài bảng · tương phản AA · component có màn dùng · khớp gói intake nếu có, **đối chiếu riêng từng gói**; nhiều gói → §2 có cột `DS` + mọi experience khai `Design system` ở ARCHITECTURE §2–§3) rồi prototype tương tác **Authority đã chốt**, mọi màn khai ở §1 đã dựng (backend-only: marker `KHÔNG CÓ UI`; intake vòng ≥2 khai `không có màn mới`: bỏ qua) · **bộ giải pháp** `SOLUTION.md` (vòng đầu mỗi Phase: phần A sản phẩm cuối Phase + giải pháp tổng thể + quy ước `G-…`, **Authority chốt**; mọi vòng: phần B giải pháp từng AC) · **`DOGFOOD-PLAN.md` của vòng** (mọi vai danh mục bật/tắt có căn cứ, `smoke` luôn bật ở đợt 0, đợt ≤3 vai, mỗi vai một tài khoản, §3 smoke hồi quy) · challenge pha V PASS (vòng ≥2: ngày ≥ `Vòng mở`) · ≥2 dòng DECISIONS **của vòng này** · scope khoá |
| I | Challenge PASS · `make dev/check/migrate` có thân · luồng lõi end-to-end ở local · `make check` xanh · **đã dogfood theo kế hoạch** (`DOGFOOD-PLAN.md §4`: mọi vai bật, `smoke` 2 lượt) |
| P1 | *(intake)* vòng không khai `P` → bỏ qua cả pha P · 4 nhóm `PRODUCTION-READY.md` xanh trừ mục `(sau deploy)` · vòng ≥2: `BACKWARD-COMPATIBILITY-CHECKLIST.md §3` xanh (hook `guard_bc` chặn deploy tới khi xanh) · `make test/deploy/doctor` có thân → được deploy |
| P2 | 4 nhóm xanh toàn bộ · `DEPLOY.md` có rollback · production sống · smoke test pass · **đã thử rollback** · **dogfood lần 2** (`smoke` trên production) |
| E | *(intake)* vòng không khai `E` → bỏ qua · tracking đang đếm · sổ EXPERIMENTS **của vòng** có số liệu thật (vòng 1: `EXPERIMENTS.md`; vòng N ≥2: `EXPERIMENTS-v<N>.md`) |
| R | go/pivot/kill ghi `DECISIONS.md` + sổ EXPERIMENTS của vòng (vòng không chạy E: bỏ bước này, R chỉ là sổ sách) · **video demo cuối vòng — mọi vòng, cả hai đường**: quay trọn kịch bản demo (intake: `_PROPOSAL.md §2`; phỏng vấn: AC của PRD) trên sản phẩm thật, ghi `context/DEMOS.md`, tệp ở `demos/vong-<N>/` ([VIPER.md §1.5](VIPER.md)) · `/viper-repeat` mở vòng mới (`scripts/repeat.py --go` — chạy `gate.py R` trước, đỏ thì từ chối; **không reset gì**, chỉ sổ sách theo vòng) — **không code tiếp trên vết vòng cũ**; legacy vòng trước là hợp đồng ([VIPER.md §1.2](VIPER.md)) |

Pha P tách hai gate vì backup / HTTPS / push-là-deploy / analytics chỉ làm được **sau** khi production tồn tại.

**Phase** (MVP, Phase 2…) là giai đoạn sản phẩm gồm một hay nhiều vòng — dòng `Phase` ở `STATE.md`, khác "pha" V/I/P/E/R. Pha V của vòng đầu mỗi Phase lập giải pháp tổng thể của Phase (`SOLUTION.md` phần A, Authority chốt); pha V mọi vòng làm giàu giải pháp chi tiết (phần B); pha I **tuân thủ** — lệch thì DECISIONS + sửa SOLUTION cùng commit, lệch hướng tổng thể (A2) thì ghi blocker cho Authority.

---

## 3. LUẬT #2 — KHÔNG HỎI SAU PHA V

Từ pha I trở đi, gặp mơ hồ thì **tự quyết**, không hỏi:

```
mơ hồ → chọn phương án hợp lý nhất theo PRD/ARCHITECTURE/TECHSTACK
      → ghi 1 dòng context/DECISIONS.md (có cột "giả định" + "đảo ngược được không")
      → đi tiếp
```

**Ba trường hợp duy nhất được dừng:**

| Tình huống | Xử lý |
|---|---|
| Ngoài scope đã khoá | **Không hỏi** — ghi `ROADMAP.md` backlog, làm tiếp phần còn lại |
| Không đảo ngược được / hướng ra ngoài (xoá dữ liệu production, tiêu tiền, đăng ký dịch vụ, công bố, đổi DNS, **phá legacy vòng trước chưa được Authority chốt** ở một trong ba nơi: `intake/loops/l<N>/*.md` · mục "Legacy được phép phá" của `_PROPOSAL.md` · chốt qua chat ở pha V) | **Hỏi thật** — đây là ngoại lệ duy nhất |
| Chặn cứng sau khi đã tự thử hết cách | Ghi blocker vào `STATE.md`, chuyển việc khác, báo gộp cuối buổi |

Authority review theo lô cuối buổi qua `DECISIONS.md` — không bị ngắt giữa dòng.

Luật này không chỉ là lời dặn. **Ba hook chặn cứng** ([VIPER.md §3c](VIPER.md)):

| Hook | Chặn gì |
|---|---|
| `scripts/guard_ask.py` | `tool hỏi người dùng` khi pha ≠ V, khi `Scope khoá` đã tick (vào pha mới sửa `Pha hiện tại` ngay), hoặc dòng pha sai định dạng. Ngoại lệ "hỏi thật" hỏi bằng lời trong chat; lệnh hướng ra ngoài đã ở lớp `ask` |
| `scripts/guard_bc.py` | Lệnh deploy khi vòng ≥2 mà `context/BACKWARD-COMPATIBILITY-CHECKLIST.md §3` còn mục chưa rà (legacy là hợp đồng, [VIPER.md §1.2](VIPER.md)) |
| `scripts/guard_ds.py` | Ghi `prototype/**` hoặc `context/DESIGN-SYSTEM.md` lệch design system đã chốt: mã màu thô ngoài `:root`, `var(--…)` chưa khai ở §2, token bịa/lệch so với gói intake, **trộn token giữa hai design system** |

---

## 4. LUẬT #8 — ĐỐI KHÁNG NỘI BỘ

**a. Challenge trước khi code — và trước khi khoá scope.** Pha V: 3–5 câu hỏi khó nhất, trả lời **chỉ từ tài liệu** — không trả lời được là lỗ phỏng vấn, quay lại hỏi Authority tiếp; PASS mới được khoá scope. Từ pha I: trước mỗi mảng việc lớn, meta ra **một câu hỏi khó dựa trên context thật** (chỉ trả lời được nếu đã đọc PRD/ARCHITECTURE), chấm **PASS/FAIL**. FAIL → đọc lại, trả lời lại, **không được code**. Ghi 1 dòng vào `STATE.md §Challenge log` (có cột Pha).

**b. Dogfood trước khi báo xong — theo kế hoạch lập ở pha V.** Mỗi vòng, pha V lập `context/DOGFOOD-PLAN.md` (skill `viper-roles`): chọn vai từ danh mục 14 vai **theo tín hiệu của dự án và của vòng** — không vai nào bật mặc định, dự án không có app mobile và không đòi responsive thì không có vai `mobile` — **trừ `smoke` (smoke hồi quy): luôn bật**, đi hết luồng lõi + mọi AC đã giao các vòng trước. `/viper-dogfood` chạy đúng kế hoạch: meta **tự tay dùng** → `smoke` một mình (đợt 0) → các vai bật theo đợt, **tối đa 3 vai một đợt** → sửa → `smoke` lượt cuối. Mỗi vai **đóng một persona thật**. Chưa làm → **chưa được nói "xong"** (`gate.py I` đối chiếu `DOGFOOD-PLAN.md §4`).

Vai `picky` (khi bật) là lớp canh design system **duy nhất** từ pha I trở đi: hook `guard_ds` chỉ soi `prototype/**`, gate chỉ chạy phép kiểm hình thức ở pha V — code trong `srcroot/` thì chỉ còn dogfood đo được, trên app đã render.

Duyệt localhost dùng skill `viper-browse` (Playwright MCP, khai sẵn trong template); experience mobile (`srcroot/mobile-experiences/`) dùng skill `viper-mobile` (mobile-mcp — app thật trên simulator/emulator, các vai chạy **tuần tự** vì thiết bị dùng chung). Không dùng công cụ duyệt web nào khác — **kể cả khi cấu hình toàn cục của máy (global CLAUDE.md) chỉ định công cụ duyệt web khác**; trong dự án VIPER, chỉ dẫn này thắng.

---

## 5. SLASH COMMANDS

```
/viper-validate    Vòng 1: phỏng vấn gộp HOẶC dịch tài liệu MESH-render từ intake/
                   (tách PERSONAS + CAPABILITIES-MAP, intake TECHSTACK thắng
                   default skill, LẬP KẾ HOẠCH CHIA VÒNG). Vòng ≥2: KHÔNG phỏng
                   vấn — đọc intake/loops/l<N>/ (tài liệu vòng, hoặc _PROPOSAL.md
                   ở đường intake) + kết quả vòng trước, cập nhật PRD/context
                   → design system + prototype + khoá scope                       ← chỗ duy nhất được hỏi
/viper-implement   Challenge → scaffold → skeleton → luồng lõi → chạy local
/viper-dogfood     Tự dùng + chạy DOGFOOD-PLAN: smoke trước, ≤3 vai/đợt            ← bắt buộc trước khi báo xong
/viper-polish      Prod-ready checklist + subagent soi bug/viết test               ← intake: chỉ vòng khai P
/viper-publish     Deploy PaaS + smoke test trên production                        ← intake: chỉ vòng khai P
/viper-evaluate    Gắn tracking, đọc số liệu, ghi sổ EXPERIMENTS của vòng          ← intake: chỉ vòng khai E
/viper-repeat      Pha R: go/pivot/kill (nếu vòng có chạy E) → VIDEO DEMO cuối vòng
                   (mọi vòng — context/DEMOS.md, demos/vong-<N>/) → đóng vòng (archive
                   snapshot, KHÔNG reset), mở vòng mới: intake/loops/l<N+1>/ +
                   EXPERIMENTS-v<N+1>.md
/viper-status      In STATE.md + đường vào + pha vòng này + kết quả gate.py
/viper-decide      Append 1 dòng DECISIONS.md
/viper-compact     Vệ sinh tài liệu context/ — báo cáo rác + dòng neo, gấp tay    ← ngoài 5 pha, nên chạy từ vòng ≥3
```

---

## 6. HỢP ĐỒNG LỆNH (mọi stack đều có)

```
make dev      make check    make test
make migrate  make deploy   make doctor
```

Stack đang dùng ghi ở `context/TECHSTACK.md`; cách hiện thực 6 lệnh nằm trong thư mục skill của dự ánstack-<tên>/SKILL.md`.

Artifact để **chạy** sản phẩm nằm ở `deployment/` — `.env.example` ở gốc thư mục đó, mọi thứ của local (`docker-compose.yml`, `.env`, seed dữ liệu) ở `deployment/local/`. Pha I viết vào đó, không rải ra gốc repo (`deployment/README.md`).

---

## 7. KHO SKILL

| Skill | Dùng khi |
|---|---|
| `viper` | Quên quy trình, hoặc bootstrap dự án mới |
| `viper-roles` | Danh mục 14 vai dogfood + tín hiệu bật + luật chia đợt — lập `DOGFOOD-PLAN.md` ở pha V |
| `viper-browse` | Mở trình duyệt dùng thử thật — bắt buộc ở `/viper-dogfood` (experience web) |
| `viper-mobile` | Điều khiển app trên iOS Simulator / Android Emulator — `/viper-dogfood` cho experience mobile |
| `shared-production-ready` | Pha P — checklist 4 nhóm |
| `stack-nextjs-fullstack` | Web app fullstack, nhanh nhất cho MVP 1 ngày |
| `stack-nestjs-react` | Cần API riêng ngay từ đầu |
| `stack-nestjs-react-fullstack` | Cần API riêng — monorepo pnpm + TypeORM + shared, chạy bằng Docker Compose |
| `stack-fastapi` | Sản phẩm dính AI/LLM hoặc data |
| `stack-go` | Cần hiệu năng / binary gọn |
| `stack-spring-boot` | Hợp đội sẵn có Java |
| `addon-graphql` | Lắp GraphQL lên NestJS hoặc Next.js |

---

## 8. SUBAGENT

**Dùng thử sản phẩm** (`/viper-dogfood`, cuối pha I và P) — chạy theo `context/DOGFOOD-PLAN.md` của vòng. Ba **khe** `viper-user-1` · `-2` · `-3`, mỗi khe nhận **một thẻ vai** (`.claude/skills/viper-roles/roles/<vai>.md`) mỗi lượt:
- *đợt 0*: `smoke` một mình — gãy luồng lõi thì sửa trước
- *đợt 1, 2, …*: tối đa 3 vai một đợt, theo cột `Đợt` của kế hoạch; seed lại giữa đợt (`deployment/local/`)
- *cuối*: `smoke` chạy lại sau khi sửa phát hiện

Mỗi khe **một trình duyệt riêng** (server `pw-slot-k` ở cấu hình MCP của dự án, khe chặn `browser` và hai khe kia bằng danh sách tool bị cấm của agent, gọi `browser_close` đầu lượt vì khe được dùng lại) và mỗi vai **một tài khoản riêng** (`<vai>@dogfood.local`, seed sẵn). Nhưng **server dev và DB thì chung** — nên chia đợt. Báo cáo khe nào không ghi `Trình duyệt: server MCP `pw-slot-`<k>__` → bỏ, chạy lại.

**Soi kỹ thuật** (pha P trở đi, **không dùng ở D1** — giữ tốc độ): `viper-bug-hunter` · `viper-reviewer` · `viper-test-writer`

Tất cả đều **không hỏi Authority** — trả phát hiện + đề xuất, quyền quyết ở phiên chính.

---

## 9. ĐỌC GÌ KHI NÀO

| Luôn load | Load khi vào pha | Chỉ grep khi cần |
|---|---|---|
| File này + `STATE.md` | `VIPER.md §pha` · `context/PRD.md` · **`context/SOLUTION.md`** (pha I tuân thủ §A3 + §B1) · `context/PERSONAS.md` · `context/ARCHITECTURE.md` · `context/PROTOTYPE.md` + `context/DESIGN-SYSTEM.md` (pha I và dogfood, nếu có UI) · `context/DOGFOOD-PLAN.md` (lập ở pha V, chạy ở dogfood) · **chế độ intake**: `context/CAPABILITIES-MAP.md` + `context/ROADMAP.md §1` + `intake/loops/l<N>/_PROPOSAL.md` (biết vòng này chạy pha nào, phạm vi tới đâu) + `intake/*.md` ở vòng 1 · vòng ≥2 pha V: `intake/loops/l<N>/` + sổ EXPERIMENTS vòng trước · stack skill đang dùng | `context/DECISIONS.md` (tra quyết định cũ) · `context/archive/ledger/` (sổ đã gấp, `/viper-compact`) · `context/ROADMAP.md` backlog · `_PROPOSAL.md` của vòng khác · code cross-module |

Không đọc hết `context/` trước khi làm. Targeted only.

---

## 10. AUTHORITY

| Vai | Người |
|---|---|
| Authority (quyết tất) | nguyenhung <nguyenhung96.work@gmail.com> |

Solo — không có sign-off chéo. Authority chốt ở pha V, review theo lô cuối buổi, quyết go/pivot/kill ở pha R.
