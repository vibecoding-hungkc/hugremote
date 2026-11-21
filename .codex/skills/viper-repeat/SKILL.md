---
name: viper-repeat
description: "Pha R — quyết go/pivot/kill từ số liệu; quay video demo cuối vòng (mọi vòng); GO thì đóng vòng (archive snapshot, KHÔNG reset), mở vòng mới mà không phá sản phẩm đang chạy — CHỈ chạy khi người dùng gõ /viper-repeat hoặc $viper-repeat."
---

# /viper-repeat — Pha R

> Phase 2 **không phải "code tiếp"** — nó là một vòng V→I→P→E→R mới trên cùng repo.
> Nhưng cũng **không reset gì**: tài liệu sống giữ nguyên, insight vòng cũ nằm tại chỗ.
> Hàng rào chống "gate vòng mới xanh sẵn nhờ vết vòng cũ" là các phép đếm theo vòng
> (mốc DECISIONS, challenge theo ngày `Vòng mở`, sổ EXPERIMENTS riêng, gate V chỉ đọc
> `intake/loops/l<N>` đúng số vòng) — xem `VIPER.md §1.2`.

Vào pha R: sửa `STATE.md` → `Pha hiện tại : R` (script `repeat.py` sẽ tự đặt lại `V` khi mở vòng mới — đó là chỗ duy nhất máy tự đổi pha hộ).

## Bước 1 — Quyết định từ số liệu

**Vòng này có chạy pha E không?** Chế độ intake, `intake/loops/l<N>/_PROPOSAL.md` dòng `Pha vòng này` không có `E` → **bỏ qua cả Bước 1**: không deploy thì không có người dùng thật, không có số liệu để quyết go/pivot/kill. R vòng này rút về sổ sách — đi thẳng Bước 2 (video demo — **vẫn bắt buộc**, vòng không deploy thì đây là cách duy nhất Authority thấy vòng đã giao gì) rồi Bước 3 để đóng vòng và mở vòng kế **theo kế hoạch** ở `ROADMAP.md §1` ([VIPER.md §1.4](../../VIPER.md)). Trước khi đi: cập nhật cột Trạng thái của vòng vừa xong ở `ROADMAP.md §1` và `CAPABILITIES-MAP.md`.

Có chạy E → mở sổ EXPERIMENTS của vòng (vòng 1: `EXPERIMENTS.md`; vòng N ≥2: `EXPERIMENTS-v<N>.md`) + `PRD.md §6`. So **số thật vs ngưỡng đã ghi trước** — không sửa ngưỡng sau khi nhìn số.

| Kết quả | Quyết |
|---|---|
| Số ≥ ngưỡng go | **GO** — vòng mới làm sâu thêm cùng hướng |
| Giữa go và kill | **PIVOT** — vòng mới đổi cách tiếp cận, giữ nền |
| Số ≤ ngưỡng kill | **KILL** — dừng, ghi lại bài học, không quay vòng |

Ghi bằng `/viper-decide`: 1 dòng `DECISIONS.md` + copy vào sổ EXPERIMENTS của vòng, mục `§Quyết định cuối tuần`. Đây là mục gate R — làm **trước** khi quay vòng.

**KILL** → quay video demo (Bước 2) làm hiện vật cuối cùng của sản phẩm, cập nhật `ROADMAP.md` ghi rõ dừng ở đâu, giữ lại gì — rồi dừng. Không chạy Bước 3.

**Chế độ intake, GO/PIVOT lệch kế hoạch** — số liệu nói hướng khác với `ROADMAP.md §1` đã lập ở vòng 1: sửa kế hoạch, đừng bỏ qua nó. Cập nhật `ROADMAP.md §1` + `_PROPOSAL.md` các vòng bị ảnh hưởng, ghi lý do vào `## Điều chỉnh khi mở vòng`. Kế hoạch là tài liệu sống, không phải hợp đồng bất biến — nhưng đổi phải có vết.

## Bước 1b — Vòng sau thuộc Phase nào?

**Phase** là giai đoạn sản phẩm (MVP, Phase 2…), dòng `Phase` ở `STATE.md`. Vòng sau **mở Phase mới** khi
sản phẩm cuối Phase hiện tại (`SOLUTION.md §A1`) đã giao đủ, hoặc GO/PIVOT đổi hẳn hướng sản phẩm:

- *(Đường intake)* Theo cột Phase của `ROADMAP.md §1` — `repeat.py` tự đọc, không cần làm gì.
- *(Đường phỏng vấn)* Authority quyết ở pha R (đang được hỏi lại ở pha V của vòng sau, nhưng tên
  Phase phải có lúc quay vòng): mở Phase mới → `repeat.py --go --phase "Phase 2"`.

Vòng đầu của Phase mới lập lại `SOLUTION.md` phần A (giải pháp tổng thể của Phase) và Authority chốt;
vòng tiếp Phase cũ chỉ làm giàu phần B (`/viper-validate` Bước 5b).

## Bước 2 — Video demo cuối vòng (mọi vòng, cả hai đường)

Luật ở [VIPER.md §1.5](../../VIPER.md). Vòng nào đóng cũng phải để lại **một video đi trọn kịch bản demo của vòng trên sản phẩm thật** — kể cả vòng intake chỉ V+I. `repeat.py` chạy `gate.py R` và **từ chối quay vòng** khi gate còn đỏ.

| | |
|---|---|
| Kịch bản | *(intake)* `intake/loops/l<N>/_PROPOSAL.md §2 Kịch bản demo cuối vòng`, đúng từng bước · *(phỏng vấn)* mọi AC ở `PRD.md §3`, xếp theo luồng lõi `ARCHITECTURE.md §7` |
| Ở đâu | Vòng đã deploy → **production**, tài khoản demo — không quay dữ liệu người dùng thật · chưa deploy → `make dev` trên **seed mới tinh** (`deployment/local/`, reset DB trước khi quay) |
| Khi nào | Sau `smoke` lượt cuối, code đã commit — video là của đúng commit sẽ đóng vòng |
| Ai quay | Meta, **phiên chính** (server `browser` / `mobile`) — không giao khe dogfood |
| Tệp | `demos/vong-<N>/<experience>.webm` (web) · `.mp4` (mobile) · `<target>.log` (backend-only) — nhiều experience thì mỗi experience một tệp |

**Web** — server `browser` đã bật `--caps=devtools` (skill `viper-browse` §7):

```
browser_close                                      # phiên trắng
browser_navigate            <trang đầu>            # luôn vào từ trang đầu, như người dùng thật
browser_start_video         filename "demos/vong-<N>/<experience>.webm", size 1280×800
browser_video_show_actions                         # chú thích từng thao tác ngay trong video
  mỗi bước k của kịch bản:
    browser_video_chapter   title "Bước k — AC-n: <việc>", description "<thấy gì>"
    thao tác thật (browser_click / browser_type / …) → browser_snapshot xác nhận đúng "Thấy gì"
browser_stop_video                                 # trả đường dẫn tệp
```

**Mobile** (skill `viper-mobile` §7): `mobile_start_screen_recording` với `output` = đường dẫn **tuyệt đối** tới `demos/vong-<N>/<experience>.mp4` → đi kịch bản → `mobile_stop_screen_recording` (trả thời lượng). Không có thẻ chương — mỗi bước nói rõ trong bảng ở sổ.

**Backend-only** (`KHÔNG CÓ UI`): chạy từng bước bằng lệnh thật (`curl`, CLI) và giữ nguyên lệnh + output, ví dụ `{ set -x; curl -s …; } 2>&1 | tee -a demos/vong-<N>/<target>.log`. Tệp `.log` được commit.

**Ghi sổ** `context/DEMOS.md` — thêm mục `## Vòng <N> — <tên vòng>` ở cuối file (định dạng ở đầu file đó): `Ngày quay` · `Môi trường` (+ commit) · `Kịch bản` · `Tệp` · bảng `Bước | Làm gì | Thấy gì | AC | Kết quả`. Rồi `python3 scripts/gate.py R` phải xanh.

Năm luật khi quay:

1. **Không dàn dựng.** Dữ liệu là seed của vòng: không sửa tay DB, không mock riêng cho video, không cắt ghép che chỗ hỏng.
2. **Gãy bước nào → dừng quay.** Đó là regression lọt qua dogfood: sửa (trong scope vòng) → `smoke` lại → quay lại **từ đầu**. Không sửa được trong vòng → AC đó **dời**: cột Kết quả ghi `dời — DECISIONS <ngày>` + 1 dòng `/viper-decide` + đẩy `ROADMAP.md` (intake: cả `CAPABILITIES-MAP.md`). Để nguyên `✗` thì gate R đỏ.
3. **Mọi AC của vòng có mặt.** AC không thấy được trên màn (chỉ test bắt được) → dòng `ngoài video` + tên test, chạy `make test` cho ca đó trước khi ghi `✓ test`.
4. **Không lộ bí mật.** Không gõ mật khẩu, API key thật trong video — dùng tài khoản và khoá của seed; production thì tài khoản demo.
5. **Không tự đưa ra ngoài.** Video nằm ở máy (`.gitignore`). Tải lên, gửi link cho người khác là hành động hướng ra ngoài — Authority làm hoặc chốt.

## Bước 3 — Đóng vòng, mở vòng (GO / PIVOT)

```bash
python3 scripts/compact.py                     # vòng ≥3: dọn TRƯỚC, xem /viper-compact
python3 scripts/gate.py R                      # video demo của vòng (Bước 2) — đỏ thì repeat từ chối
git add -A && git commit -m "chốt vòng <N>"   # tree phải sạch, script sẽ từ chối nếu không
python3 scripts/repeat.py                      # xem trước
python3 scripts/repeat.py --go                 # thực thi — tiếp Phase hiện tại
python3 scripts/repeat.py --go --phase "Phase 2"   # …hoặc mở Phase mới (đường phỏng vấn)
```

**Vòng ≥3 — dọn tài liệu trước khi quay vòng.** Tài liệu không reset (§1.2) nên các sổ chỉ dài ra; sau 5–7 vòng thì phần đọc được lẫn hết vào phần đã hết hiệu lực. Chạy `/viper-compact`, gấp xong rồi mới commit — `repeat.py --go` đòi working tree sạch, dọn sau khi quay vòng là phải commit thêm một lần nữa vào giữa vòng mới.

Script làm gì — và vì sao từng thứ (KHÔNG reset, không ghi đè file nào):

| Việc | Vì sao |
|---|---|
| Archive **snapshot** `PRD/INTERVIEW/PROTOTYPE/DESIGN-SYSTEM/CAPABILITIES-MAP/ROADMAP/sổ EXPERIMENTS của vòng/BC-CHECKLIST/STATE` → `context/archive/vong-N/` (chỉ copy, bản sống giữ nguyên) | AC vòng mới sẽ **thay** AC cũ trong PRD — lịch sử có snapshot; file sống tiếp tục tiến hoá |
| `STATE` sửa **tại chỗ**: Vòng N+1 · `Vòng mở: <ngày>` · pha V · ngày D1 · bỏ tick §Gate; challenge log, blocker, Stack, URL giữ nguyên | Không mất gì; challenge của gate chỉ tính dòng có ngày ≥ `Vòng mở` — PASS vòng cũ không gánh hộ vòng mới |
| Tạo `context/EXPERIMENTS-v<N+1>.md` (scaffold nằm trong script) — sổ cũ nguyên vẹn | Gate E đòi số liệu **của vòng này**; số liệu cũ nằm ngay bên cạnh làm insight |
| Tạo thư mục `intake/loops/l<N+1>/` | Cửa vào pha V của vòng mới. *(Phỏng vấn)* Authority thả tài liệu vòng (thêm/đổi/bỏ) vào đây; gate fail-closed tới khi có tài liệu thật. *(Intake)* `_PROPOSAL.md` thường đã nằm sẵn từ kế hoạch vòng 1 — script in ra `Pha vòng này` để biết vòng mới đi tới đâu; chưa có thì kế hoạch dừng trước vòng này, phải cập nhật `ROADMAP.md §1` + tạo proposal |
| Append dòng mốc `(vòng N+1)` vào `DECISIONS.md` | `gate.py` chỉ đếm quyết định **dưới mốc** — quyết định vòng cũ không gánh hộ vòng mới, kể cả quay vòng cùng ngày |
| **MOVE** drop `intake/*.md` gốc (không tính `_*-TEMPLATE.md`, `README.md`) → `archive/vong-N/intake/`; `intake/design-systems/` và `intake/loops/` ở lại | Đường MESH-render chỉ của vòng 1; `loops/` đánh số theo vòng, tự nó là lưu trữ — gate chỉ đọc đúng `l<N>` |
| Bỏ tick mục `(mỗi vòng)` trong `PRODUCTION-READY.md` | Validate/phân quyền/smoke/tracking đúng cho tính năng cũ, không tự đúng cho tính năng mới |
| Bỏ tick **đúng §3** của `BACKWARD-COMPATIBILITY-CHECKLIST.md` (sổ hợp đồng §1 giữ nguyên) | Vòng nào rà tương thích vòng đó; từ đây gate `P1` đếm và hook `guard_bc` **chặn deploy** tới khi §3 xanh |

Script **không** đụng: INTERVIEW (đóng băng — hiện vật vòng 1), `DEMOS.md` (sổ cộng dồn) và `demos/` (đánh số theo vòng), các sổ EXPERIMENTS cũ, ngày chốt PROTOTYPE (tài liệu vòng là chữ ký của Authority, không chốt lại), PRD, PERSONAS, ARCHITECTURE, DESIGN-SYSTEM, CAPABILITIES-MAP, TECHSTACK, ROADMAP, code. Với DECISIONS nó chỉ **append** dòng mốc `(vòng N+1)` như bảng trên — không sửa dòng nào đã có; đừng ghi mốc bằng tay kẻo trùng. Blocker/phát hiện dogfood đang treo **mang sang vòng mới** trong STATE — xử hoặc đẩy `ROADMAP.md` trong pha V.

Xong: `git add -A && git commit -m "đóng vòng <N>, mở vòng <N+1>"`.

## Bước 4 — Vào pha V của vòng mới

**Không phỏng vấn** ở cả hai đường. Chạy `/viper-validate` — nó tự rẽ theo chế độ:

**Đường phỏng vấn** → mục "Vòng ≥ 2 · đường phỏng vấn". Authority thả tài liệu vòng (thêm mới / thay đổi / bỏ đi) vào `intake/loops/l<N+1>/` — mẫu `intake/loops/_TEMPLATE.md`; trả lời qua chat cũng được, meta ghi hộ (đang pha V). Gate fail-closed tới khi thư mục có tài liệu thật.

**Đường intake** → mục "Vòng ≥ 2 · đường intake". Kế hoạch đã có sẵn (`_PROPOSAL.md`), Authority không phải làm gì. Việc của meta là **rà lại**: đối chiếu kế hoạch với kết quả vòng vừa xong, chỉnh nếu lệch, rồi ghi dòng `Rà lại vòng <N+1>: <ngày hôm nay>` — gate đòi đúng dòng đó với ngày ≥ `Vòng mở`.

Chung cho cả hai:

- Đọc kết quả vòng trước (sổ EXPERIMENTS, `ROADMAP.md` backlog, phát hiện dogfood còn treo) → AC mới **thay** AC cũ trong PRD
- Chuyện phá legacy phải nằm ở một trong ba nơi hợp lệ — xem Ràng buộc bên dưới
- Scope vòng mới khoá như thường lệ — luật #1, #2 áp nguyên

## Ràng buộc — legacy là hợp đồng

Từ vòng 2, **nếu đã từng deploy**, production có người dùng và dữ liệu thật. **AC, luồng lõi và dữ liệu của các vòng đã giao là hợp đồng** — vòng mới xây chồng lên, không đập đi. (Chế độ intake, chuỗi vòng chưa vòng nào deploy: legacy tính từ vòng deploy gần nhất; `guard_bc` chặn đúng lúc deploy nên phép đếm tự khớp.)

1. **Mặc định: không phá.** Mọi thứ vòng trước làm được phải tiếp tục làm được sau khi vòng mới xong. Smoke test vòng cũ đi theo `make test` và phải **giữ xanh** — đỏ là regression, sửa trước khi làm tiếp, không xoá test cho qua (luật #6).
2. **Bắt buộc phải phá → Authority chốt, ở một trong BA nơi.** Chỗ nào delta không thể giữ tương thích (đổi luồng cũ, đổi/xoá dữ liệu, đổi hành vi AC cũ) thì phải có mặt ở: (a) file `.md` Authority thả vào `intake/loops/l<N>/`, mục "Legacy được phép phá"; (b) mục cùng tên trong `intake/loops/l<N>/_PROPOSAL.md` (đường intake); (c) chốt qua chat ở pha V, meta ghi hộ vào `l<N>/`. Ghi đủ **phá gì + đường di trú dữ liệu**. Đây là pha được hỏi — hỏi cho đủ, vì sau đó thì không.
3. **Phá chưa chốt = dừng hỏi thật.** Sau khoá scope mà mới phát hiện buộc phải phá legacy → đây là ngoại lệ "hỏi thật" của luật #2 (ngang hàng xoá dữ liệu production), **không tự quyết rồi ghi DECISIONS**. Dừng, hỏi, chờ chốt.
4. **Additive-first cho mọi surface.** API request/response, bảng DB, cache entity, event/message, webhook, format tích hợp — luật đổi từng loại ở `BACKWARD-COMPATIBILITY-CHECKLIST.md §2`, sổ hợp đồng ở §1. Migration chỉ thêm (bảng, cột nullable, index); đổi/xoá cột đang dùng đi hai bước (thêm mới → chuyển dữ liệu → vòng sau mới xoá) + 1 dòng `DECISIONS.md` + đường rollback trong `DEPLOY.md`. Checklist §3 phải xanh trước khi deploy — gate `P1` đếm, hook `guard_bc` chặn.
5. **Dogfood vòng mới đi lại luồng vòng cũ.** Vai `smoke` luôn bật, và danh sách smoke hồi quy (`DOGFOOD-PLAN.md §3`) của vòng mới phải chứa AC của các vòng trước — `gate.py V` vòng ≥2 đỏ nếu §3 không có dòng nào của vòng trước. Smoke chạy trên dữ liệu cũ, bằng tài khoản người dùng cũ.

## Ranh giới

- Không quay vòng khi vòng có chạy E mà chưa có quyết định GO/PIVOT trong `DECISIONS.md` — quay vòng không thay được quyết định. Vòng chỉ V+I (intake) thì không có bước này.
- Không quay vòng khi chưa có **video demo của vòng** (`gate.py R` đỏ) — `repeat.py` từ chối. Không có ngoại lệ theo đường hay theo tập pha: vòng chỉ V+I càng cần, vì không có production để Authority tự mở.
- Không sửa tay `INTERVIEW.md` (đóng băng) hay sổ EXPERIMENTS vòng cũ — chúng là hiện vật; vòng mới ghi vào sổ của vòng mới.
- **(Phỏng vấn)** Vòng mới vẫn phải khoá được scope trong 2 tiếng và xong trong 1 tuần. Không khoá nổi → sản phẩm đã vượt cỡ đường này: phân tích rồi vào lại bằng đường intake, hoặc lên MESH (`VIPER.md §0, §7`).
- **(Intake)** Không ép vòng vào một tuần — thời lượng khai ở `_PROPOSAL.md` theo wave cadence. Nhưng cũng không mở vòng ngoài kế hoạch mà không cập nhật `ROADMAP.md §1` + tạo `_PROPOSAL.md`: `repeat.py` sẽ mở ra một vòng rỗng và `gate.py V` fail-closed đúng chỗ đó.
