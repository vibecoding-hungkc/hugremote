---
type: aggregated
artifact_kind: roadmap
status: RENDERED
tier: T0
last_rendered: "{{DATE-ISO8601}}"
---

# ROADMAP

> 🚫 **This is a RENDER ARTIFACT — DO NOT EDIT directly.**
>
> Generated from `_discovery/*` + boundary/experience `CHARTER.md` files
> by `scripts/aggregate-render.py` (called by `/aggregate-render`).
> To modify content, edit the source files and re-run the script.
>
> See `_aggregated/README.md` for details.

> **TEMPLATE** — file này KHÔNG phải render output, chỉ mô tả cấu trúc chuẩn của `_aggregated/ROADMAP.md`
> để tham chiếu khi review artifact thật. Render thật do `scripts/aggregate-render.py` sinh ra (agent-aggregator, D6).



## 1. Phase priority

_(Source: `_discovery/capability-map.md §6`)_

| Capability | Phase | {{P-XXX}} | {{P-YYY}} | ... | Business outcome | Candidate domain |
|---|:--:|:--:|:--:|---|---|---|
| {{CAP-XXX-01}} — {{Mô tả ngắn capability}} | {{MVP \| Phase 2 \| Phase N}} | {{✓ nếu persona dùng}} | | {{Kết quả kinh doanh mong đợi}} | {{Domain ứng viên}} |

> Bảng này giống hệt PRD §3 Capabilities — copy nguyên từ `capability-map.md §1`, giữ nguyên cấu trúc cột (1 cột/persona theo đúng thứ tự persona-pool).

## 2. Wave sequence

_(Source: `Plan/WAVE-SEQUENCE.md`)_

> Toàn bộ `Plan/WAVE-SEQUENCE.md` được nhúng nguyên văn vào §2 (không tóm tắt). Cấu trúc file nguồn như sau —
> author bởi agent-charter-author mode=WAVE-SEQUENCE ở D7:

---
type: plan
artifact_kind: wave-sequence
status: "{{DRAFT | ACTIVE}}"
tier: T2
owner_authority: "{{Delivery Authority | tên authority sở hữu}}"
last_reviewed: "{{DATE}}"
---

# WAVE-SEQUENCE — {{Tên project}}

> Authored ở D7 bởi agent-charter-author mode=WAVE-SEQUENCE, ngày {{DATE}}.
> Chiến lược: {{tên chiến lược sequencing, ví dụ "CL4 Hybrid Skeleton + Risk-gated"}} — {{mô tả 1 câu nguyên tắc cắt wave}}.
> Mỗi wave có 2 dimension: `wave_class` ({{slice|integration|...}}) × `wave_strategy` ({{vertical|horizontal-be|horizontal-fe|...}}).
> {{Ràng buộc cấu trúc khác nếu có, ví dụ hard cap target/layer.}}

> **CẢNH BÁO CAPACITY (ghi chính thức — xem {{ADR ref nếu có}}):**
> {{Đoạn cảnh báo về scope vs capacity đội ngũ, rủi ro trượt tuần nào, cách dùng buffer, xác nhận của Authority,
> thứ tự cắt ưu tiên nếu phải giảm scope. Chỉ điền nếu WAVE-SEQUENCE nguồn có phần cảnh báo này — bỏ nếu không.}}

---

## Wave Inventory

> Bảng tổng quan {{N}} wave — một dòng mỗi wave, đủ để track tiến độ mà không cần đọc YAML block chi tiết.

| Wave | Tuần | Tên / Goal ngắn | Class × Strategy | Targets (BE / FE / Mobile) | Capabilities chính | Exit / Demo | At-risk |
|---|:---:|---|---|---|---|---|---|
| {{W1}} | {{1}} | {{Tên wave ngắn}} | {{slice × vertical}} | {{boundary-1, boundary-2 / web-exp-1 / mobile-exp-1}} | {{CAP-XXX-01, CAP-YYY-02}} | {{Tiêu chí demo pass ngắn gọn}} | {{— hoặc ✓ kèm lý do ngắn}} |

> Mỗi row = 1 wave. Cột "Targets" ghi theo thứ tự BE / FE / Mobile, dùng `—` nếu tầng đó không có target trong wave.
> Cột "At-risk" đánh dấu `✓` nếu wave này nằm trong danh sách rủi ro ở §Cadence bên dưới.

### Cách đọc / control

{{1 đoạn văn ngắn hướng dẫn Authority dùng bảng Wave Inventory để review tiến độ, trỏ tới §Cadence cho chi tiết at-risk/fallback, và trỏ tới từng §W{N} cho nội dung đầy đủ.}}

---

## §W1 — {{Tên wave}} ({{tuần N}})

**Goal:** {{1-2 câu mô tả mục tiêu wave, vị trí trong dependency chain.}}

```yaml
wave_class: {{slice | integration}}
wave_strategy: {{vertical | horizontal-be | horizontal-fe}}
rationale: |
  {{Vì sao wave này ở vị trí này trong sequence — phụ thuộc gì, giải quyết rủi ro gì, vì sao chọn
  class/strategy này thay vì phương án khác.}}
targets:
  boundaries:
    - boundaries/{{boundary-name}}
  web_experiences:
    - web-experiences/{{web-experience-name}}
  mobile_experiences: []
features_in_scope:
  - feat_id: {{FEAT-XXX-01}}
    target: boundaries/{{boundary-name}}
    parent_epic: {{EPIC-XXX}}
    description: {{Mô tả ngắn feature + capability ref (CAP-XXX-01)}}
contracts:
  to_ratify: []
  inherited_active:
    - contracts/api/{{contract-name}}.md
exit_signal:
  type: demo_target
  criteria: |
    1. {{Tiêu chí demo/pass cụ thể, đo được}}.
    2. {{Tiêu chí tiếp theo}}.
test_scope:
  required:
    - {{unit | component | integration | e2e | security-isolation | ...}}
  conditional:
    - {{performance | a11y | load-basic | ...}}
constraints:
  at_risk: {{true | false}}
  note: {{Ghi chú rủi ro + fallback nếu at_risk true; lý do ưu tiên nếu là wave ROOT.}}
```

---

> Lặp lại 1 block `## §W{{n}} — {{Tên wave}} ({{tuần N}})` như trên cho mỗi wave trong Wave Inventory,
> theo đúng thứ tự tuần. Mỗi block giữ đủ 7 key YAML: `wave_class`, `wave_strategy`, `rationale`, `targets`,
> `features_in_scope`, `contracts`, `exit_signal`, `test_scope`, `constraints`.

## Cadence

**Nhịp:** {{N}} wave × ~{{X}} tuần/wave = {{tổng số tuần}} tuần, {{tuần tự theo dependency | song song theo cluster}} — {{lý do, ví dụ giới hạn capacity team}}.

**Phân loại wave:**
- {{Wx-Wy}}: `{{class}}` + `{{strategy}}` — {{mô tả ngắn}}.
- {{Wz}}: `{{class}}` + `{{strategy}}` — {{mô tả ngắn, ví dụ integration/hardening cuối}}.

**Dependency ordering (bắt buộc — không được đảo):**
```
{{W1 (mô tả ngắn)}}
  → {{W2 (mô tả ngắn)}}
    → {{W3 (mô tả ngắn)}}
      → ...
```

**Contract-gate ordering** (BE FEAT hoàn thành trước FE paired trong cùng wave hoặc wave trước):
- {{Wx}}: {{FEAT-BE-XX (BE)}} → {{FEAT-FE-XX (FE)}} {{cùng wave qua ... nếu có BFF bridge}}

**At-risk waves (thứ tự rủi ro giảm dần):**

| Wave | Rủi ro chính | First-to-cut nếu squeeze |
|---|---|---|
| {{Wx (mức độ, ví dụ HIGHEST)}} | {{Mô tả rủi ro}} | {{(1) ...; (2) ...}} |

**Scope-OUT khỏi {{N}} tuần (Phase sau — KHÔNG đưa vào wave nào):**
- {{Capability/boundary bị loại + xác nhận Authority}}

**Cảnh báo capacity chính thức (xem {{ADR ref nếu có}}):**
> {{Đoạn cảnh báo capacity đầy đủ — lặp lại/đồng bộ với đoạn ở đầu file nếu nguồn có 2 chỗ.}}

---

## Change log

| Date | Change | Author |
|---|---|---|
| {{DATE}} | {{Mô tả thay đổi}} | {{author}} |
