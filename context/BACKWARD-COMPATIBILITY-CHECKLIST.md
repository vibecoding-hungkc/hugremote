---
type: backward-compatibility
tier: T1
last_reviewed: "2026-11-21"
---

# BACKWARD COMPATIBILITY CHECKLIST — hugremote

> **Có hiệu lực từ vòng 2** (`STATE.md`, dòng `Vòng`) — khi sản phẩm đã có legacy: người dùng
> thật, dữ liệu thật, và có thể có hệ thống ngoài đang gọi vào. Vòng 1 file này nằm im; gate
> và hook tự biết theo số vòng, không cần marker.
>
> Nguyên tắc gốc (`VIPER.md §1.2`): **legacy là hợp đồng — mặc định chỉ THÊM, không đổi/xoá.**
> Bắt buộc phá → Authority chốt trong **tài liệu vòng** (`intake/loops/l<N>/`, mục
> "Legacy được phép phá" — hoặc chốt qua chat ở pha V, meta ghi hộ vào đó) + 1 dòng `DECISIONS.md`.
>
> Cưỡng chế bằng máy ở hai chỗ:
> - `gate.py P1`: vòng ≥2 còn mục `- [ ]` ở §3 → gate đỏ, chưa được vào `/viper-publish`
> - hook `scripts/guard_bc.py` (PreToolUse): **chặn thẳng** `make deploy` / CLI deploy khi §3 chưa xanh

---

## 1. Sổ hợp đồng — surface đang giao cho bên ngoài

<!-- Đây là DANH SÁCH những gì các vòng trước đã hứa: ai đó (client, code cũ, hệ thống ngoài,
     file người dùng tải về) đang PHỤ THUỘC vào hình dạng của nó. Điền ở pha P của vòng TẠO RA
     surface đó; vòng sau đối chiếu mọi thay đổi vào đây. Loại nào sản phẩm không có → ghi một
     dòng "KHÔNG CÓ" để chứng tỏ đã rà chứ không phải quên. -->

### 1a. API — endpoint + request/response schema

| Endpoint / operation | Version | Request: field bắt buộc | Response: field client đang dùng | Ai đang gọi |
|---|---|---|---|---|
| `POST /api/projects/:id/terminals` | `terminal-api.v1` | — (`name?`, `cwd?` tuỳ chọn; vòng 3 thêm `tmux?` tuỳ chọn) | `id, name, cwd, status` | apps/web |
| `GET /api/projects/:id/terminals` · `PATCH/DELETE /api/terminal-sessions/:id` | `terminal-api.v1` | — | `id, name, status, exitCode, owner` | apps/web |
| `/ws/terminal?sessionId&cols&rows&ticket` | `terminal-ws.v1` | `sessionId, ticket` | phím thô, `resize`, `ping/pong`, `exit` | apps/web |
| `GET /api/projects/:id/fs?path=&hidden=` | `files-api.v1` | `path` | `entries[{name,path,type,hidden,ignored,git}]` | apps/web |
| `GET /api/claude/...` hạn mức (CAP-AI-06) | `claude-api.v1` | — | `fiveHour{pct,resetAt}`, `week{pct,resetAt}` | apps/web (vòng 3 chuyển chỗ hiện sang popup model) |
| Cookie `hugremote_desktop_token` + preload `window.hugremoteDesktop` | `desktop-loopback.v1` | secret 32-byte | `version` (vòng 3 thêm `web.{show,bounds,hide,close,nav,onState}` (preload CommonJS `preload.cjs`)) | apps/desktop → apps/api, apps/web |

### 1b. Bảng dữ liệu (DB schema)

| Bảng | Cột đang được code / báo cáo / export dùng | Ràng buộc đáng nhớ (unique, FK…) |
|---|---|---|
| `terminal_sessions` | `id, project_id, owner_user_id, name, cwd, status, exit_code, created_at, last_attached_at` (vòng 3 thêm nullable `tmux_name`) | FK project_id; restart service → `exited` (trừ phiên tmux từ vòng 3) |
| `projects` | `id, host_id, name, root_path, is_home` | unique (host_id, root_path); mỗi máy một `is_home` |
| `port_forwards` (vòng 3) | `id, direction, host_id, remote_host, remote_port, local_port, label, auto_start` | unique local_port khi `L` |
| `web_sessions` (vòng 3) | `id, project_id, owner_user_id, url, name` | FK project_id |

### 1c. Cache entity

| Key pattern | Shape (field trong value) | TTL | Version nằm trong key? |
|---|---|---|---|
| | | | |

### 1d. Event / Message

| Topic / queue / event-type | Payload schema | Producer → Consumer |
|---|---|---|
| `events.v1` SSE: `session_status`, `interaction_requested`, `file_changed`…  | `{type, ...}` tolerant reader | apps/api → apps/web |

### 1e. Webhook

| Hướng (gửi đi / nhận vào) | URL / event | Payload schema | Bên kia là ai |
|---|---|---|---|
| | | | |

### 1f. Tích hợp khác

<!-- File export người dùng tải về, CSV import, cron gọi API bên thứ ba, SDK/phiên bản
     thư viện public, deep link, format QR… — mọi thứ có "hình dạng" mà bên ngoài phụ thuộc. -->

| Loại | Format / phiên bản | Ai phụ thuộc |
|---|---|---|
| | | |

## 2. Luật đổi từng loại — additive-first

| Loại | Được làm thẳng | CẤM làm thẳng — muốn thì phải theo cách bên phải |
|---|---|---|
| **API** | Thêm endpoint mới · thêm field **optional** vào response · thêm field optional (có default) vào request | Đổi/xoá field, đổi type/ý nghĩa, đổi URL/status code đang có người gọi → mở **/v2 song song**, giữ v1 tới khi §1a hết người gọi |
| **DB** | Thêm bảng · cột nullable hoặc có default · index | RENAME/DROP/đổi type cột đang dùng → **expand → migrate → vòng SAU mới contract**; migration nào cũng phải có đường xuống (down) |
| **Cache** | Thêm field vào shape (reader cũ bỏ qua field lạ) | Đổi shape/ý nghĩa → **nâng version trong key** (`v2:…`) để code mới không đọc nhầm bản cũ; có kế hoạch flush/đợi TTL |
| **Event/Message** | Thêm field optional; consumer viết kiểu tolerant reader (bỏ qua field lạ) | Đổi ngữ nghĩa/type, xoá field → **event-type hoặc topic MỚI**; không tái dùng tên cũ với nghĩa khác |
| **Webhook** | Thêm field vào payload gửi đi | Đổi URL/method/schema mà bên kia đang bám → endpoint/phiên bản mới + **giữ đường cũ** + báo bên kia trước (hướng ra ngoài → ngoại lệ "hỏi thật") |
| **Tích hợp khác** | Thêm cột cuối file export, thêm trường mới có default | Đổi format đang có người dùng → tên/phiên bản mới chạy **song song** bản cũ |

## 3. Checklist mỗi vòng — `gate.py P1` đếm, `guard_bc.py` chặn deploy

<!-- `repeat.py --go` bỏ tick toàn bộ khi mở vòng mới. Loại không có surface (đã ghi KHÔNG CÓ
     ở §1) → vẫn tick, thêm "n/a" phía sau — tick nghĩa là "đã rà", không phải "có làm".

     BA NƠI HỢP LỆ để Authority cho phép phá legacy (VIPER.md §1.2) — không có ở đâu cả thì
     phải giữ tương thích, và phá là ngoại lệ "hỏi thật" của luật #2:
       1. file .md Authority thả vào intake/loops/l<N>/ — mục "Legacy được phép phá"
       2. mục "Legacy được phép phá" trong intake/loops/l<N>/_PROPOSAL.md (đường intake)
       3. chốt qua chat ở pha V — meta ghi hộ vào l<N>/, trích nguyên văn + nguồn + ngày

     Vòng không chạy pha P (đường intake, theo _PROPOSAL.md) thì không deploy, nên checklist
     này chưa tới lượt — nhưng §1 vẫn phải cập nhật ngay ở vòng đẻ ra surface mới. -->

- [ ] **Sổ hợp đồng §1 cập nhật** — surface mới vòng này đã thêm dòng; loại chưa có ghi `KHÔNG CÓ`
- [ ] **API**: từng thay đổi đối chiếu §1a — chỉ additive, hoặc đã version hoá theo luật §2
- [ ] **DB**: migration vòng này chỉ expand; mọi đổi/xoá đi hai bước và có down
- [ ] **Cache**: shape đổi thì key đã nâng version; không còn code mới đọc bản cũ mà thiếu fallback
- [ ] **Event/Message**: chỉ thêm field optional; đổi nghĩa đã tách event-type/topic mới
- [ ] **Webhook**: payload chỉ thêm; URL/schema hai chiều với bên ngoài không đổi (đổi → đã báo + giữ đường cũ)
- [ ] **Tích hợp khác**: format export/import/cron/deep-link giữ nguyên hoặc version hoá song song
- [ ] **Regression**: `make test` gồm smoke của mọi vòng trước — đang XANH
- [ ] **Phá có chốt**: mọi ngoại lệ ở trên đều được Authority chốt trong tài liệu vòng (`intake/loops/l<N>/` — hoặc qua chat ở pha V, đã ghi hộ vào đó) + 1 dòng `DECISIONS.md`

## 4. Đã cố tình bỏ qua

<!-- Bỏ qua có chủ đích thì ghi lại kèm rủi ro — đừng để trống mà lờ đi. -->

| Mục | Vì sao bỏ qua | Rủi ro chấp nhận | Làm lại khi |
|---|---|---|---|
| | | | |
