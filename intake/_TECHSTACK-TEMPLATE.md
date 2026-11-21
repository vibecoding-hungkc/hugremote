---
type: aggregated
artifact_kind: techstack
status: RENDERED
tier: T0
last_rendered: "{{DATE-ISO8601}}"
---

# TECHSTACK

> 🚫 **This is a RENDER ARTIFACT — DO NOT EDIT directly.**
>
> Generated from `_discovery/*` + boundary/experience `CHARTER.md` files
> by `scripts/aggregate-render.py` (called by `/aggregate-render`).
> To modify content, edit the source files and re-run the script.
>
> See `_aggregated/README.md` for details.

> **TEMPLATE** — file này KHÔNG phải render output, chỉ mô tả cấu trúc chuẩn của `_aggregated/TECHSTACK.md`
> để tham chiếu khi review artifact thật. Render thật do `scripts/aggregate-render.py` sinh ra (agent-aggregator, D6).



## 1. Per-target tech choices

### Web experience: `{{web-experience-name}}`

_(Source: `web-experiences/{{web-experience-name}}/CHARTER.md`)_

| Component | Choice | Reason |
|---|---|---|
| Framework | {{ví dụ: React 19}} | {{lý do chọn — copy từ CHARTER §Tech stack}} |
| Language | {{ví dụ: TypeScript strict}} | {{lý do}} |
| Build | {{ví dụ: Vite}} | {{lý do}} |
| Router | {{...}} | {{...}} |
| State | {{...}} | {{...}} |
| Data fetching | {{...}} | {{...}} |
| Forms | {{...}} | {{...}} |
| UI library | {{...}} | {{...}} |
| CSS | {{...}} | {{...}} |
| i18n | {{ví dụ: i18next, locales: {{vi, en}}}} | {{...}} |
| Realtime | {{nếu có — WebSocket/SSE, ADR ref}} | {{...}} |
| Test (component) | {{...}} | {{...}} |
| Test (e2e) | {{...}} | {{...}} |
| Visual regression | {{...}} | {{...}} |

> CHARTER chỉ ghi **choice + reason**. Coding standards, lint rule, CI config thuộc downstream.
> Bảng có thể thêm/bớt hàng tuỳ CHARTER §Tech stack thực tế của experience (ví dụ thêm "WebRTC / Calls", "Auth token", "GraphQL codegen").

---


### Web experience: `{{web-experience-name-2}}`

_(Source: `web-experiences/{{web-experience-name-2}}/CHARTER.md`)_

{{Lặp lại block bảng như trên cho mỗi web experience ACTIVE trong `web-experiences/`.}}

---


### Web experience: `{{widget/embed-name nếu có}}`

_(Source: `web-experiences/{{name}}/CHARTER.md`)_

{{Lặp lại block bảng — lưu ý experience dạng widget/SDK nhúng thường có thêm hàng: Packaging, DOM isolation, Bundle budget — ghi rõ nếu CHARTER có.}}

---


### Mobile experience: `{{mobile-experience-name}}`

_(Source: `mobile-experiences/{{mobile-experience-name}}/CHARTER.md`)_

| Component | Choice | Reason |
|---|---|---|
| Framework | {{tên framework mobile cross-platform 1 codebase}} | {{lý do + ADR ref}} |
| Language | {{...}} | {{...}} |
| State management | {{...}} | {{...}} |
| GraphQL/API client | {{...}} | {{...}} |
| Realtime (messaging) | {{...}} | {{...}} |
| WebRTC / Calls | {{nếu có}} | {{...}} |
| Push notification | {{...}} | {{...}} |
| VoIP / Incoming call | {{nếu có}} | {{...}} |
| SDK integration | {{nếu app nhúng SDK riêng}} | {{...}} |
| Navigation | {{...}} | {{...}} |
| i18n | {{...}} | {{...}} |
| Secure storage | {{...}} | {{...}} |
| Test (unit + widget) | {{...}} | {{...}} |
| Test (integration) | {{...}} | {{...}} |
| Test (visual regression) | {{...}} | {{...}} |
| CI build | {{...}} | {{...}} |
| Crash / observability | {{...}} | {{...}} |

> CHARTER ghi **choice + reason**. Coding standards chi tiết (naming, folder structure, lint rule) thuộc downstream.

---


## 2. Cross-cutting infrastructure

_(Source: `SYSTEM-TOPOLOGY.md §1.4 Stateful infra` + `§1.5 External services`)_

See `SYSTEM-TOPOLOGY.md` for runtime topology + shared infrastructure.

## 3. References

- Each boundary's `CHARTER.md §Tech stack`
- Each experience's `CHARTER.md §Tech stack`
- `SYSTEM-TOPOLOGY.md`
- `_discovery/hypothesis-log.md` (tech decision rationale)
