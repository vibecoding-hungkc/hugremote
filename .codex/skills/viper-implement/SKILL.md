---
name: viper-implement
description: "Pha I — challenge, scaffold, dựng luồng lõi chạy được ở local — CHỈ chạy khi người dùng gõ /viper-implement hoặc $viper-implement."
---

# /viper-implement — Pha I

> **LUẬT #2 — KHÔNG HỎI AUTHORITY.**
> Mơ hồ → tự quyết theo `PRD.md`/`ARCHITECTURE.md`/`TECHSTACK.md` → ghi 1 dòng `context/DECISIONS.md` → đi tiếp.
> Ngoài scope → ghi `ROADMAP.md` backlog, **không hỏi**, làm tiếp phần còn lại.
> Chặn cứng → ghi `STATE.md §Blocker`, chuyển việc khác, báo gộp cuối buổi.
> Ngoại lệ duy nhất được hỏi: hành động **không đảo ngược được hoặc hướng ra ngoài** — vòng ≥ 2 gồm cả **phá legacy chưa được Authority chốt** ở một trong ba nơi hợp lệ (`intake/loops/l<N>/*.md` · mục "Legacy được phép phá" của `_PROPOSAL.md` · chốt qua chat ở pha V). Hành vi/dữ liệu vòng trước là hợp đồng, xem `/viper-repeat`.

Đích: `make dev` chạy, luồng lõi bấm được ở local, `make check` xanh, đã dogfood. Đường phỏng vấn: hết ngày 1.

**Việc đầu tiên, trước mọi bước dưới**: sửa `STATE.md` → `Pha hiện tại : I`. Hook `guard_ask` và `gate.py` đọc đúng dòng này — không sửa thì máy vẫn tưởng đang pha V, luật #2 chỉ còn là lời dặn (và đây là lỗi thực chiến phổ biến nhất).

## Bước 1 — Nạp context

`context/PRD.md` · **`context/SOLUTION.md`** (A3 quy ước bắt buộc + B1 giải pháp từng AC của vòng — thứ pha này **làm theo**) · `context/PERSONAS.md` · `context/ARCHITECTURE.md` · `context/TECHSTACK.md` · `context/PROTOTYPE.md` + `context/DESIGN-SYSTEM.md` (nếu có UI) · skill `stack-<tên đã chốt>`.

**Chế độ intake** — `context/INTERVIEW.md` mang `NGUỒN: INTAKE` (marker ở lại qua mọi vòng) ([VIPER.md §1.3](../../VIPER.md)): nạp thêm `context/CAPABILITIES-MAP.md` + **`intake/loops/l<N>/_PROPOSAL.md` của vòng hiện tại** + `intake/ARCHITECTURE.md` + `intake/TECHSTACK.md` (nếu còn — drop gốc bị move vào archive cuối vòng 1). Hai thứ phải đọc ra được từ proposal trước khi code:

- **Phạm vi vòng này** — capability nào, **target nào**. Chỉ dựng những target đó; vòng sau có target khác thì để vòng sau, đừng scaffold sẵn cho đủ bộ.
- **`Pha vòng này`** — vòng chỉ khai `V, I` thì hết pha I là xong vòng: không `/viper-polish`, không deploy, đi thẳng `/viper-repeat` ([VIPER.md §1.4](../../VIPER.md)). Biết trước điều này để không dựng hạ tầng deploy cho một vòng không deploy.

Ở chế độ này luật #5 không áp — cấu trúc đa target theo `srcroot/README.md`.

Đọc thật, không lướt. Bước 2 sẽ kiểm.

## Bước 2 — Challenge (luật #8)

Trước khi viết dòng code đầu tiên, **tự ra cho mình một câu hỏi khó dựa trên context thật của dự án này** — loại chỉ trả lời được nếu đã đọc và hiểu PRD/ARCHITECTURE, không phải câu hỏi kiến thức chung.

Nguồn ra câu hỏi tốt:
- Mâu thuẫn tiềm tàng giữa hai AC
- Ca biên ở `ARCHITECTURE.md §6` mà mô hình dữ liệu hiện tại chưa chặn được
- Ô ✗ trong ma trận vai × hành động (`PERSONAS.md §2`) mà thiết kế hiện tại chưa chặn được
- Màn hình trong `PROTOTYPE.md §1` mà mô hình dữ liệu chưa nuôi nổi thông tin bắt buộc
- Component trong `DESIGN-SYSTEM.md §4` có trạng thái bắt buộc (đang gửi, lỗi) mà API đang thiết kế chưa phân biệt được để hiển thị
- Thứ nằm trong PRD nhưng **không** thuộc scope tuần này, dễ bị làm nhầm
- Ranh giới module ở `§8` mà thiết kế đang định làm sẽ vi phạm
- Quy ước `G-…` ở `SOLUTION.md §A3` hoặc giải pháp ở `§B1` mà cách đang định code sẽ làm lệch

Trả lời thẳng. Tự chấm PASS/FAIL trung thực:
- **FAIL** (trả lời chung chung, phải đoán, hoặc phát hiện mình chưa đọc kỹ) → đọc lại context, ra câu khác, trả lời lại. **Không được code.**
- **PASS** → ghi vào `STATE.md §Challenge log`, đi tiếp.

Câu hỏi này để lộ ra chỗ mình tưởng đã hiểu mà chưa. Ra câu dễ cho qua là tự lừa mình — và cái giá trả ở pha dogfood.

## Bước 3 — Scaffold

Theo `stack-<tên>/SKILL.md §2`. Chạy lệnh chính chủ, không chép boilerplate.

**Chế độ intake — hai khác biệt:**

1. **TECHSTACK của intake thắng default của stack skill.** Scaffold theo đúng Choice trong `context/TECHSTACK.md` (đã dịch từ intake) — intake nói Prisma+Chakra thì không dùng Drizzle+shadcn của skill. Skill chỉ còn là tham khảo: preset production-ready (§5) và forbidden patterns (§7) vẫn áp khi không mâu thuẫn với intake. `Skill đang dùng: custom (intake)` → scaffold bằng CLI chính chủ của framework mà intake chọn.
2. **Mỗi boundary/experience trong `ARCHITECTURE.md` scaffold vào đúng nhóm của nó** — `srcroot/boundaries/<tên>/` (§1) · `srcroot/web-experiences/<tên>/` (§2) · `srcroot/mobile-experiences/<tên>/` (§3); quy ước ở `srcroot/README.md`, không vào gốc repo. Root `Makefile` giữ hợp đồng 6 lệnh — thân từng target điều phối xuống (`make -C srcroot/<nhóm>/<tên> …`); deploy luôn đi qua root `make deploy` (hook `guard_bc` canh ở đó). Ưu tiên dựng thông **một đường xuyên suốt** (một boundary + một experience cho luồng lõi) trước, target còn lại nối sau — walking skeleton áp cho cả cụm, không phải từng target một.

**Artifact chạy local viết vào `deployment/local/`, không rải ra gốc repo** (quy ước ở `deployment/README.md`): `docker-compose.yml` cho DB · `.env` copy từ `deployment/.env.example` rồi điền · `init.sql`/seed dữ liệu mẫu theo `PRD.md §7`. Thân `make dev` trỏ vào đó (`docker compose -f deployment/local/docker-compose.yml up -d db`) — người chạy lệnh không cần biết file nằm đâu. Đa target: **một** compose dùng chung cho cả hệ, không phải mỗi target một cái.

Xong thì:
- Điền 6 target trong `Makefile` theo `SKILL.md §4` (chế độ intake: thân điều phối per-target như trên)
- Ghi version thật vào `context/TECHSTACK.md §4` + biến môi trường vào `§6` (kèm cột Target)
- Bổ sung biến mới vào `deployment/.env.example` — chỉ TÊN biến + mô tả, không giá trị
- `git add -A && git commit -m "khởi tạo dự án với <stack>"`

## Bước 4 — Walking skeleton

Thứ tự này quan trọng: **có một đường đi xuyên suốt trước, rồi mới đắp thịt**.

```
1. make dev chạy được (app + db lên)
2. Health check trả 200
3. Một màn hình rỗng render được
4. Một thao tác ghi xuống DB và đọc lại lên được — dù xấu
5. git commit
```

Bốn bước đầu xong là rủi ro lớn nhất của ngày đã qua. Chưa xong thì **không** làm gì khác — đừng đắp UI đẹp lên một đường đi chưa thông.

## Bước 5 — Luồng lõi

Làm theo `ARCHITECTURE.md §7`, bám đúng AC trong `PRD.md §3`, **theo đúng giải pháp `SOLUTION.md §B1` của AC đó và mọi quy ước `§A3`** — đó là thứ Authority đã thấy (phần A đã chốt) và pha V đã làm giàu cho vòng này. Với mỗi AC:

```
làm → tự bấm thử ở local → tick AC trong ROADMAP.md → commit
```

Trong lúc làm:
- **UI bám màn hình đã chốt trong `PROTOTYPE.md §1`** (nếu có UI): đúng thông tin bắt buộc, đúng thứ tự ưu tiên, đủ trạng thái rỗng/lỗi. Authority đã chốt bản đó — làm khác đi phải có 1 dòng `DECISIONS.md`. Prototype là tài liệu tham chiếu, không copy code từ `prototype/index.html`
- **Hình thức từ token `DESIGN-SYSTEM.md §2`** — việc ĐẦU TIÊN khi đụng UI: đổ bảng token vào theme của stack (biến CSS trong stylesheet gốc; dùng Tailwind thì map vào theme của `tailwind.config`), rồi mọi màu/cỡ chữ/khoảng cách lấy từ đó. Component theo kho §4 đủ trạng thái bắt buộc; rỗng/lỗi/đang tải theo khuôn §5. Token là thứ duy nhất được **chép nguyên** từ pha V sang code
- **Phân quyền code theo ma trận vai × hành động `PERSONAS.md §2`** — mỗi ô ✗ phải bị chặn ở server, không tự quyết lại
- Giữ ranh giới module ở `ARCHITECTURE.md §8`. Để logic sai tầng là lỗi, không phải chuyện phong cách
- Xử các ca biên đã quyết ở `§6` **ngay khi làm phần liên quan**, đừng để lại cuối
- **Vòng ≥ 2**: đụng surface cũ (API, bảng DB, cache, event, webhook, format export) → theo luật additive-first ở `BACKWARD-COMPATIBILITY-CHECKLIST.md §2`, đối chiếu sổ hợp đồng §1 — phá mà Authority chưa chốt trong tài liệu vòng (`intake/loops/l<N>/`) là ngoại lệ "hỏi thật"
- **Lệch `SOLUTION.md`** (B1 không làm được như viết, cần một quy ước mới) → 1 dòng `DECISIONS.md` + sửa `SOLUTION.md` cùng commit (luật #4) — không lặng lẽ làm khác. Lệch chạm **phần A2** (hướng giải pháp tổng thể Authority đã chốt) → không tự đổi hướng: ghi `STATE.md §Blocker` kèm đề xuất (vì sao A2 không đứng được, phương án thay), làm phần khác, Authority quyết theo lô cuối buổi
- Gặp quyết định không hiển nhiên → `context/DECISIONS.md` một dòng, đi tiếp
- Gặp việc ngoài AC → `ROADMAP.md` backlog, đi tiếp
- Commit nhỏ, message tiếng Việt

**Không** làm ở pha này: tối ưu hiệu năng, làm UI đẹp hơn mức đủ dùng, viết test cho hàm tiện ích, thêm tính năng "tiện tay". Tất cả để pha P và E.

## Bước 6 — Chốt

```bash
make check    # phải xanh
make test     # nếu đã có test
```

Rồi **bắt buộc**:

```
/viper-dogfood
```

Chưa dogfood thì chưa xong (luật #8). Tuyệt đối không báo "xong pha I" trước khi chạy nó. Lệnh chạy đúng `context/DOGFOOD-PLAN.md` đã lập ở pha V: `smoke` đi đầu, các vai bật theo đợt, `smoke` lượt cuối sau khi sửa — `gate.py I` đối chiếu §4 Kết quả với danh sách vai bật.

Sau dogfood, phát hiện đã xử hoặc đã ghi → cập nhật `STATE.md`: tick gate I, chuyển pha `P`.

## Ranh giới

- Không sửa `PRD.md §3` (AC) để cho dễ làm. Không làm được thì ghi `STATE.md §Blocker`, báo cuối buổi.
- Không đổi stack. Đổi stack sau pha V là phá luật #1 — cần đánh đổi ghi rõ ở `DECISIONS.md`.
- Chế độ intake: không "sửa lại" lựa chọn của intake TECHSTACK cho hợp default của skill, và không tự đẻ target ngoài danh sách intake ARCHITECTURE — cả hai đều là phá hợp đồng intake, ngang sửa AC cho dễ làm.
- Không spawn subagent soi bug/viết test ở pha này — chúng thuộc pha P, dùng sớm chỉ làm chậm ngày 1.
