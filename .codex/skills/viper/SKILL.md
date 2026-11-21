---
name: viper
description: >
  Quy trình VIPER — dựng sản phẩm solo, production-ready, qua hai đường vào: đường phỏng vấn (Founder có ý tưởng,
  test thị trường trong 1 tuần) và đường intake (tài liệu MESH-render đã phân tích kỹ, hệ thống lớn chia nhiều vòng).
  Nạp skill này khi: bắt đầu một dự án VIPER mới, quên đang ở pha nào hay đi đường nào, không nhớ luật nào áp dụng,
  hoặc cần biết pha hiện tại phải làm gì và gate ra sao.
  Bao gồm: hai đường vào, 5 pha V-I-P-E-R, 8 luật, cơ chế "không hỏi Authority sau pha V", challenge nội bộ, dogfood bắt buộc.
---

# VIPER — vận hành quy trình

> Policy đầy đủ ở `VIPER.md` (T0). Skill này là bản thao tác: đang ở đâu, làm gì tiếp, gate ra sao.

## Định vị nhanh

```bash
head -20 STATE.md                            # pha + vòng hiện tại
grep -c "^NGUỒN: INTAKE" context/INTERVIEW.md # >0 = ĐƯỜNG INTAKE, 0 = ĐƯỜNG PHỎNG VẤN — phải neo ^ (chuỗi này còn xuất hiện trong hướng dẫn của template)
python3 scripts/gate.py                      # gate của pha hiện tại (hoặc truyền V|I|P1|P2|E|R)
```

## Hai đường vào — biết mình đang ở đường nào TRƯỚC đã

Ràng buộc khác nhau, và **luật của đường này không áp cho đường kia** (`VIPER.md §0`):

| | **Phỏng vấn** | **Intake** |
|---|---|---|
| Bối cảnh | Founder/PO có ý tưởng, test thị trường 1 tuần | Tài liệu đã phân tích kỹ; hệ thống lớn chia vòng chạy dần |
| Cỡ | 1 app, 1 DB, 1 nơi deploy | Đa target `srcroot/{boundaries,web-experiences,mobile-experiences}/` đúng danh sách intake |
| AC · persona | 3–7 AC · 2–3 persona | Không trần — AC truy về `CAPABILITIES-MAP.md`; persona theo intake |
| Nhịp | 1 tuần, khoá scope 2 tiếng | Mỗi vòng tự khai thời lượng trong `_PROPOSAL.md` |
| Pha mỗi vòng | Trọn V-I-P-E-R | **V + I bắt buộc**; P/E/R chỉ ở vòng khai trong `_PROPOSAL.md` |
| Prototype | MỘT `prototype/index.html` | `prototype/<experience>/index.html` |
| Nguồn vòng ≥2 | Authority thả `.md` vào `intake/loops/l<N>/` | `_PROPOSAL.md` (kế hoạch lập ở vòng 1) + dòng `Rà lại vòng N` |

## Năm pha

| Pha | Lệnh | Xong khi |
|---|---|---|
| **V** Validate | `/viper-validate` | PRD + PERSONAS + TECHSTACK + ARCHITECTURE đủ mục · **vòng 1 phỏng vấn**: INTERVIEW đủ 14 dòng bằng chứng · **vòng 1 intake** (`VIPER.md §1.3`): `intake/PRD.md` render thật → dịch sang context + tách `CAPABILITIES-MAP.md` + INTERVIEW mang `NGUỒN: INTAKE` + truy vết + **kế hoạch chia vòng** (`ROADMAP.md §1` khớp `l<N>/_PROPOSAL.md`, §1.4) · **vòng ≥2** (không phỏng vấn, INTERVIEW đóng băng): phỏng vấn → `l<N>/` có tài liệu thật của Authority; intake → `_PROPOSAL.md` + dòng `Rà lại vòng N` ngày ≥ `Vòng mở` · có UI thì DESIGN-SYSTEM chốt **trước** prototype, rồi prototype tương tác **Authority đã chốt** (backend-only: marker `KHÔNG CÓ UI`) · challenge V PASS · scope khoá |
| **I** Implement | `/viper-implement` → `/viper-dogfood` | `make dev` chạy · luồng lõi bấm được ở local · `make check` xanh · đã dogfood |
| **P** Polish & Publish | `/viper-polish` → `/viper-publish` → `/viper-dogfood` | *(intake)* vòng không khai `P` → bỏ qua cả pha · `P1` prod-ready xanh trừ mục `(sau deploy)` → deploy được · `P2` 4 nhóm xanh đủ · production sống · đã thử rollback |
| **E** Evaluate | `/viper-evaluate` | *(intake)* vòng không khai `E` → bỏ qua · sổ EXPERIMENTS của vòng có số liệu thật (vòng 1: `EXPERIMENTS.md`; vòng N ≥2: `EXPERIMENTS-v<N>.md`) |
| **R** Repeat | `/viper-repeat` | go / pivot / kill ghi vào `DECISIONS.md` (vòng không chạy E: bỏ — không có số liệu để quyết) · **video demo cuối vòng, mọi vòng** — `context/DEMOS.md` + `demos/vong-<N>/`, `gate.py R` kiểm (`VIPER.md §1.5`) · `scripts/repeat.py --go` mở vòng mới (từ chối khi gate R đỏ) (archive snapshot + sổ sách theo vòng, **không reset gì**) — legacy vòng trước là hợp đồng (`VIPER.md §1.2`) |

**Đường phỏng vấn**: V và I bắt buộc trong ngày 1; P trở đi tuỳ tình hình, nhưng release phải trong tuần.
**Đường intake**: V và I bắt buộc ở **mọi vòng**; P/E/R theo kế hoạch — hệ thống lớn thì phần lớn vòng giữa chỉ V+I, deploy dồn vào vòng có đủ thứ đáng deploy (`VIPER.md §1.4`).

## Luật quan trọng nhất khi đang code

**Không hỏi Authority sau pha V.** Mơ hồ → tự quyết theo `PRD.md`/`ARCHITECTURE.md`/`TECHSTACK.md` → ghi 1 dòng `context/DECISIONS.md` → đi tiếp.

Ba ngoại lệ duy nhất:

| Tình huống | Làm gì |
|---|---|
| Ngoài scope đã khoá | Ghi `ROADMAP.md` backlog, **không hỏi**, làm tiếp phần còn lại |
| Không đảo ngược được / hướng ra ngoài (xoá dữ liệu production, tiêu tiền, đăng ký dịch vụ, công bố, đổi DNS, phá legacy chưa được chốt) | Hỏi thật |
| Chặn cứng sau khi đã thử hết cách | Ghi `STATE.md §Blocker`, chuyển việc khác, báo gộp cuối buổi |

Ba hook chặn cứng (`VIPER.md §3c`): `guard_ask.py` (request_user_input ngoài pha V) · `guard_bc.py` (deploy khi còn nợ tương thích ngược) · `guard_ds.py` (ghi prototype/DESIGN-SYSTEM lệch design system đã chốt).

## Đối kháng nội bộ (luật #8)

**Challenge trước khi code — và trước khi khoá scope**: pha V ra 3–5 câu khó nhất, trả lời chỉ từ tài liệu; không trả lời được thì vá theo đúng đường mình đang đi (vòng 1 phỏng vấn: hỏi Authority tiếp · vòng 1 intake: dịch lại + vá lỗ hổng · vòng ≥2: đọc lại `intake/loops/l<N>/` + kết quả vòng trước). Từ pha I, trước mỗi mảng việc lớn ra một câu hỏi khó dựa trên context thật — loại chỉ trả lời được nếu đã đọc PRD/ARCHITECTURE. Chấm PASS/FAIL, ghi `STATE.md §Challenge log` (có cột Pha). FAIL → đọc lại, không được code.

**Bộ giải pháp theo Phase**: Phase = giai đoạn sản phẩm (MVP, Phase 2…, dòng `Phase` ở `STATE.md`). Pha V của vòng đầu mỗi Phase xác định sản phẩm cuối Phase và lập giải pháp tổng thể (`context/SOLUTION.md` phần A — hướng giải pháp, quy ước bắt buộc `G-…`, phi chức năng, rủi ro), Authority chốt; pha V mọi vòng làm giàu phần B (giải pháp từng AC). Pha I tuân thủ.

**Dogfood trước khi báo xong — theo kế hoạch của vòng**: pha V mỗi vòng lập `context/DOGFOOD-PLAN.md` (skill `viper-roles`) — chọn vai từ danh mục 14 vai theo tín hiệu của dự án và của vòng, không vai nào bật mặc định **trừ `smoke` (smoke hồi quy, luôn bật)**. `/viper-dogfood` chạy đúng kế hoạch: meta tự dùng → `smoke` một mình → các vai bật, tối đa 3 vai một đợt trên 3 khe trình duyệt riêng → sửa → `smoke` lượt cuối. Chưa làm thì chưa được nói "xong".

## Hợp đồng lệnh

Mọi stack đều có, gate dựa vào đây:

```
make dev  make check  make test  make migrate  make deploy  make doctor
```

## Chọn stack (pha V)

| Skill | Khi nào |
|---|---|
| `stack-nextjs-fullstack` | Web app fullstack — nhanh nhất cho MVP 1 ngày, mặc định nên cân nhắc trước |
| `stack-nestjs-react` | Cần API riêng ngay từ đầu (mobile sẽ dùng chung, hoặc bên thứ ba gọi vào) |
| `stack-nestjs-react-fullstack` | Như trên, nhưng monorepo pnpm + TypeORM + `packages/shared`, cả stack chạy bằng Docker Compose |
| `stack-fastapi` | Sản phẩm dính AI/LLM hoặc xử lý dữ liệu |
| `stack-go` | Cần hiệu năng, binary gọn, ít phụ thuộc |
| `stack-spring-boot` | Đội sẵn có Java, hoặc phải tích hợp hệ thống Java cũ |
| `addon-graphql` | Lắp thêm lên NestJS hoặc Next.js khi client cần query linh hoạt |

Chốt xong → ghi `context/TECHSTACK.md` + 1 dòng `DECISIONS.md`.

**Đường intake không chọn stack ở đây** — `intake/TECHSTACK.md` đã chốt per-target và **thắng default của skill**. Skill chỉ còn là tham khảo (preset production-ready §5, forbidden patterns §7, khi không mâu thuẫn với intake). Không khớp skill nào → `custom (intake — theo intake/TECHSTACK.md)`.

## Khi mọi thứ rối

1. `cat STATE.md` — đang ở pha nào, gate nào chưa tick
2. `cat context/PRD.md` — AC nào chưa xong
3. `python3 scripts/gate.py` — thiếu chính xác cái gì
4. Vẫn rối → làm cho xong AC gần nhất, đừng mở việc mới

## Ranh giới VIPER

Không hợp với VIPER **ở cả hai đường**: nhiều Authority sign-off chéo · sai là mất tiền/dữ liệu ở quy mô lớn · cần contract signing + wave orchestration nhiều đội, nhiều repo.

Riêng đường phỏng vấn thêm: nhiều service phải ký contract với nhau · phạm vi cần khảo sát nhiều tuần. Vượt ngưỡng đó thì:

- **Đã có tài liệu phân tích** (MESH-render) → đi đường intake, đó chính là chỗ nó giải quyết.
- **Chưa có** → chuyển sang MESH. Ánh xạ tài liệu ghi ở `VIPER.md §7`.
