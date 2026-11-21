---
type: aggregated
artifact_kind: system-architecture
status: RENDERED
tier: T0
last_rendered: "{{DATE-ISO8601}}"
---

# SYSTEM ARCHITECTURE

> 🚫 **This is a RENDER ARTIFACT — DO NOT EDIT directly.**
>
> Generated from `_discovery/*` + boundary/experience `CHARTER.md` files
> by `scripts/aggregate-render.py` (called by `/aggregate-render`).
> To modify content, edit the source files and re-run the script.
>
> See `_aggregated/README.md` for details.

> **TEMPLATE** — file này KHÔNG phải render output, chỉ mô tả cấu trúc chuẩn của `_aggregated/SYSTEM-ARCHITECTURE.md`
> để tham chiếu khi review artifact thật. Render thật do `scripts/aggregate-render.py` sinh ra (agent-aggregator, D6).



## 1. Backend boundaries

_(Source: `BOUNDARY-MAP.md §1`)_

| Boundary | Mission (1-line) | Owned data | Phase | Status |
|---|---|---|---|---|
| `{{boundary-name}}` | {{Mission 1 dòng — copy nguyên văn từ CHARTER.md §Mission của boundary}} | {{entity_1, entity_2, ...}} | {{MVP \| Phase 2 \| Phase N}} | {{DRAFT \| ACTIVE \| DEPRECATED}} |

> Mỗi row = 1 boundary trong `BOUNDARY-MAP.md §1`. Mission lấy nguyên câu đầu CHARTER §1/§Mission — KHÔNG diễn giải lại.

## 2. Frontend experiences — web

_(Source: `BOUNDARY-MAP.md §2`)_

| Experience | Persona pool | Capabilities exposed | Phase | Status |
|---|---|---|---|---|
| `{{web-experience-name}}` | {{P-XXX, P-YYY}} | {{Mô tả ngắn năng lực lộ ra qua experience này, kèm BFF nếu có (qua {{bff-name}})}} | {{MVP \| Phase 2}} | {{DRAFT \| ACTIVE}} |

## 3. Frontend experiences — mobile

_(Source: `BOUNDARY-MAP.md §3`)_

| Experience | Platform | Persona pool | Phase | Status |
|---|---|---|---|---|
| `{{mobile-experience-name}}` | {{tên stack mobile — cross-platform hoặc native, chốt ở D3}} | {{P-XXX}} | {{MVP \| Phase 2}} | {{DRAFT \| ACTIVE}} |

## 4. Topology

_(Source: `SYSTEM-TOPOLOGY.md §2`)_

```mermaid
graph TD
  subgraph FE[Frontend Experiences]
    %% 1 node / web hoặc mobile experience — id ngắn gọn viết hoa, label = tên experience + stack + persona chính
    WEX1["{{web-exp-1}}<br/>{{stack}} {{persona chính}}"]
    MEX1["{{mobile-exp-1}}<br/>{{stack}} {{persona chính}}"]
  end

  subgraph BFF[BFF Tier - {{stack BFF nếu có}}]
    %% Bỏ subgraph này nếu kiến trúc không có BFF layer
    BFF1["{{bff-name}}"]
  end

  subgraph BE[Backend Boundaries - {{stack chính}}]
    %% 1 node / boundary — id = viết tắt boundary
    B1["{{boundary-1}}"]
    B2["{{boundary-2}}"]
  end

  subgraph DATA[Datastores]
    %% Chỉ liệt kê datastore đáng chú ý (search cluster riêng, cache đặc thù...) — không phải mọi DB per-boundary
    D1["{{datastore, ví dụ: Elasticsearch cluster riêng}}"]
  end

  subgraph EXTERNAL[External / Self-host infra]
    %% Hạ tầng bên ngoài / self-host quan trọng (media server, IAM provider, payment gateway...)
    E1["{{external-service}}<br/>{{ghi chú vị trí/constraint nếu có}}"]
  end

  WEX1 --> BFF1
  MEX1 --> BFF1
  BFF1 --> B1 & B2
  B1 --> B2
  B2 -.event/outbox.-> D1
  B1 -.signaling/media.-> E1
```

---

## 5. Cross-cutting contracts (API summary)

_(Source: `CONTRACT-MAP.md §1.1`)_

| Contract | Producer | Consumers (chính) | Transport | Status |
|---|---|---|---|---|
| `{{contract-id}}` | {{producer boundary}} | {{consumer 1, consumer 2, ...}} | {{REST \| gRPC \| GraphQL \| WS \| event}} | {{DRAFT \| RATIFIED \| ACTIVE \| DEPRECATED}} |

> Mỗi row = 1 contract trong `CONTRACT-MAP.md §1.1`. Giữ nguyên transport ghi kép nếu contract dùng nhiều transport (ví dụ "REST + gRPC").
