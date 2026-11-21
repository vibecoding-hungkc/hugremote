---
type: design-system
design_system_id: "DS-{{NAME}}"
status: "DRAFT | IN_REVIEW | APPROVED | DEPRECATED"
version: 1
source: "in-house | figma"
figma_file_key: ""          # chỉ khi source=figma
platforms: ["web", "mobile"]
owner_authority: "Design Authority"
last_reviewed: "{{DATE}}"
---

# Design System — `{{ds-name}}`

> Bộ chuẩn UI dùng chung: tokens + components + screens. Consumed bởi web/mobile experiences (qua SPECS → /sync-design).
> Nguồn token machine-readable: `tokens.json` (cùng thư mục) — đặc tả định dạng ở
> [`_TOKENS-TEMPLATE.json`](_TOKENS-TEMPLATE.json). Mỗi component một file trong
> `components/` — đặc tả ở [`components/_COMPONENT-TEMPLATE.md`](components/_COMPONENT-TEMPLATE.md).
>
> **Gói này là HỢP ĐỒNG** ([VIPER.md §1.3](../../../VIPER.md)): pha V dịch sang
> `context/DESIGN-SYSTEM.md` trung thành — không bịa token, không bỏ rơi, không đổi giá
> trị. Hook `scripts/guard_ds.py` chặn lúc ghi; `gate.py V` đối chiếu lại toàn bộ.

---

## 1. Mục đích

{{1-2 câu: design system này phục vụ gì, dùng cho experience nào.}}

Ví dụ: "Design system mặc định cho toàn bộ web + mobile experience. Tokens semantic + component API cơ bản (Button, Input, Card, Dialog)."

---

## 2. Nguồn (source)

| Aspect | Value |
|---|---|
| Source | {{in-house / figma}} |
| Figma file | {{Figma URL nếu source=figma; bỏ trống nếu in-house}} |
| Codegen target | CSS custom props + TS types (web); theme object (mobile Flutter/RN) |
| Versioning | semver trong frontmatter `version` |

---

## 3. Design tokens

> Chi tiết machine-readable trong `tokens.json`. Bảng dưới là tóm tắt cho người đọc.

### 3.1 Color (semantic)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `color.primary` | `#1E40AF` | Hành động chính |
| `color.surface` | `#FFFFFF` | Nền |
| `color.text` | `#0F172A` | Chữ chính |
| `color.error` | `#DC2626` | Lỗi |

### 3.2 Typography / Spacing / Radius / Elevation / Motion

> Liệt kê token chính. Xem `tokens.json` cho đầy đủ.

| Nhóm | Token mẫu |
|---|---|
| typography | `typography.font-size.base = 16px` |
| spacing | `spacing.md = 8px` |
| radius | `radius.md = 8px` |
| elevation | `elevation.1 = 0 1px 2px rgba(0,0,0,.05)` |
| motion | `motion.fast = 150ms ease-out` |

---

## 4. Component index

| Component | File | Status |
|---|---|---|
| Button | `components/COMP-Button.md` | {{status}} |
| Input | `components/COMP-Input.md` | {{status}} |

---

## 5. Screens

| Screen | File | Nguồn |
|---|---|---|
| {{screen-name}} | `screens/{{screen}}.png` + `.json` | {{Figma node / mockup}} |

---

## 6. Changelog

| Date | Version | Change |
|---|---|---|
| {{DATE}} | 1 | Khởi tạo design system |
