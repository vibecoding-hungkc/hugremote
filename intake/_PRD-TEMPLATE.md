---
type: aggregated
artifact_kind: prd
status: RENDERED
tier: T0
last_rendered: "{{DATE-ISO8601}}"
rendered_by: "scripts/aggregate-render.py"
---

# PRD — Product Requirements Document

> 🚫 **This is a RENDER ARTIFACT — DO NOT EDIT directly.**
>
> Generated from `_discovery/*` + boundary/experience `CHARTER.md` files
> by `scripts/aggregate-render.py` (called by `/aggregate-render`).
> To modify content, edit the source files and re-run the script.
>
> See `_aggregated/README.md` for details.

> **TEMPLATE** — file này KHÔNG phải render output, chỉ mô tả cấu trúc chuẩn của `_aggregated/PRD.md`
> để tham chiếu khi review artifact thật. Render thật do `scripts/aggregate-render.py` sinh ra (agent-aggregator, D6).



## 1. Problem statement

_(Source: `_discovery/hypothesis-log.md §2`)_

{{Đoạn văn mô tả vấn đề hiện tại của {{tên project}} — copy nguyên văn từ hypothesis-log §2, KHÔNG paraphrase.}}

{{Đoạn 2 (nếu có): status quo hiện tại + cost of inaction — cũng copy nguyên văn từ nguồn.}}

## 2. Target users (personas)

_(Source: `_discovery/persona-pool.md §2`)_

## {{P-XXX}} — {{Tên persona, ví dụ: Platform Operator}}

| Field | Value |
|---|---|
| Role | {{Mô tả vai trò persona trong 1 câu}} |
| Goals | • {{Mục tiêu 1}} • {{Mục tiêu 2}} |
| Pains | • {{Nỗi đau 1}} • {{Nỗi đau 2}} |
| Workflow today | {{Cách persona làm việc hiện tại, trước khi có sản phẩm}} |
| Platforms | {{Nếu có — web/mobile/server-side; bỏ field nếu persona-pool không khai báo}} |
| Anti-persona (NOT this) | {{Ranh giới rõ: persona này KHÔNG bao gồm gì}} |
| Active in waves | {{W-n hoặc "Phase MVP" — chỉ điền khi đã biết wave/phase active}} |

> Lặp lại 1 block `##` như trên cho mỗi persona trong `persona-pool.md §2`. Nếu có sub-persona (variant),
> dùng heading `###` lồng dưới persona cha kèm 1 dòng blockquote ghi rõ quan hệ (vd "Sub-persona của **P-XXX**, cụ thể hoá ở D2 ...").

## 3. Capabilities

_(Source: `_discovery/capability-map.md §1`)_

| Capability | Phase | {{P-XXX}} | {{P-YYY}} | ... | Business outcome | Candidate domain |
|---|:--:|:--:|:--:|---|---|---|
| {{CAP-XXX-01}} — {{Mô tả ngắn capability}} | {{MVP \| Phase 2 \| Phase N}} | {{✓ nếu persona dùng, để trống nếu không}} | | {{Kết quả kinh doanh mong đợi, gắn hypothesis nếu có (Hn)}} | {{Domain ứng viên}} |

> Header row: 1 cột `Capability`, 1 cột `Phase`, N cột — 1 cột/persona (lấy đúng thứ tự persona ở §2), rồi `Business outcome` + `Candidate domain`.
> Mỗi row = 1 capability trong `capability-map.md §1`, giữ đúng ID + mô tả + phase + outcome + domain, chỉ đánh dấu ✓ ở cột persona nào thực sự dùng.

## 4. Phase priority

_(Source: `_discovery/capability-map.md §6`)_

_(Phase priority được mã hoá trong cột `Phase` của bảng Capability ở trên — xem §3. `Plan/WAVE-SEQUENCE.md` được author ở D7.)_

## 5. Out of scope

_(Source: `_discovery/capability-map.md §7`)_

- **{{Tên anti-capability 1}}** — {{lý do defer / loại trừ, phase nào sẽ xử lý nếu có}}.
- **{{Tên anti-capability 2}}** — {{lý do}}.

> Mỗi bullet = 1 anti-capability trong `capability-map.md §7`, giữ nguyên nội dung + tham chiếu ADR/CR nếu nguồn có ghi.
> Nếu 1 anti-capability được PROMOTE lên MVP sau này (qua CR), giữ dạng `~~strikethrough~~ — **PROMOTED lên {{phase}}** ({{ADR/CR ref}}): ...` để lịch sử rõ ràng.

## 6. Hypotheses + risks

_(Source: `_discovery/hypothesis-log.md §3`)_

| ID | Statement | Expected outcome | Test method | Status |
|---|---|---|---|---|
| {{H-n}} | {{Giả thuyết}} | {{Kết quả kỳ vọng, đo được}} | {{Phương pháp test}} | {{TESTABLE \| PROVEN \| DISPROVEN \| PIVOTED}} |

Statuses: `TESTABLE → PROVEN | DISPROVEN | PIVOTED`.

## 7. References

- `_discovery/hypothesis-log.md` — beliefs + risks
- `_discovery/persona-pool.md` — master persona list
- `_discovery/capability-map.md` — capability inventory
- `BOUNDARY-MAP.md` — system inventory
- `Plan/WAVE-SEQUENCE.md` — delivery plan
