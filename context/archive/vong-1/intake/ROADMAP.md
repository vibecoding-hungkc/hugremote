---
type: aggregated
artifact_kind: roadmap
status: RENDERED
tier: T0
last_rendered: "2026-11-21"
rendered_by: "Claude Code — soạn từ phân tích HugRemote v1.6.20"
---

# ROADMAP — HugRemote (bản phát triển lại)

## 1. Phase priority

_(Nguồn: `intake/PRD.md §3`)_

| Capability | Phase | P-MOBILE | P-DESK | P-HOST | P-TEAM | Business outcome | Candidate domain |
|---|:--:|:--:|:--:|:--:|:--:|---|---|
| CAP-ACCESS-01 — Đăng nhập mật khẩu, bắt đổi mật khẩu mặc định, đăng xuất, phiên bền qua restart | MVP | ✓ | ✓ | ✓ | | Mở ra Internet an toàn, không bị đá ra sau restart (H-4) | access |
| CAP-ACCESS-02 — 2FA TOTP + mã khôi phục, giới hạn thử | MVP | ✓ | ✓ | ✓ | | Lớp bảo vệ thứ hai cho ứng dụng có quyền shell | access |
| CAP-ACCESS-03 — SSO Google / OIDC, cấu hình chỉ khi đã đăng nhập | Phase 2 | ✓ | ✓ | ✓ | ✓ | Nhóm nhỏ dùng chung instance | access |
| CAP-HOST-01 — Danh sách máy từ `~/.ssh/config` + local, không lộ bí mật | MVP | ✓ | ✓ | ✓ | | Dùng lại cấu hình SSH sẵn có | host |
| CAP-HOST-02 — Thêm/sửa/xoá máy SSH, thử kết nối | MVP | ✓ | ✓ | ✓ | | Không tự sửa file config trên điện thoại | host |
| CAP-HOST-03 — Kiểm host key SSH | MVP | | | ✓ | | Đóng lỗ MITM | host |
| CAP-PROJ-01 — Dự án + một phạm vi hiện hành cho mọi tab | MVP | ✓ | ✓ | | | Hết nhầm phạm vi (H-3) | workspace |
| CAP-PROJ-02 — Chuyển nhanh toàn cục | MVP | ✓ | ✓ | | | Tới đúng chỗ ≤3 thao tác (H-1) | workspace |
| CAP-PROJ-03 — Máy đã ghim, đồng bộ giữa thiết bị | MVP | ✓ | ✓ | | | Điện thoại và máy tính thấy như nhau | workspace |
| CAP-TERM-01 — Phiên PTY chạy nền, nối lại, lưu phía server | MVP | ✓ | ✓ | | | Lệnh dài/TUI không chết khi khoá màn hình | terminal |
| CAP-TERM-02 — Bàn phím cảm ứng cho terminal + `visualViewport` | MVP | ✓ | | | | Gõ shell/TUI trên điện thoại | terminal |
| CAP-FILE-01 — Duyệt, sửa, xem trước file của dự án | MVP | ✓ | ✓ | | | Xem/sửa nhanh thứ Claude viết | files |
| CAP-FILE-02 — Tạo/đổi tên/xoá, tải lên/xuống, zip | MVP | ✓ | ✓ | | | Chuyển file điện thoại ↔ máy chủ | files |
| CAP-GIT-01 — Trạng thái, diff, stage, commit, pull/push, nhánh | MVP | ✓ | ✓ | | | Duyệt + commit thay đổi của Claude | git |
| CAP-GIT-02 — Lịch sử commit + diff theo commit | Phase 2 | ✓ | ✓ | | | Xem lại các commit | git |
| CAP-AI-01 — Phiên Claude stream, chạy nền, nối lại, dừng | MVP | ✓ | ✓ | | | Giao việc rồi bỏ máy đi (H-2) | claude |
| CAP-AI-02 — Thẻ duyệt quyền + menu chế độ quyền | MVP | ✓ | ✓ | | | Duyệt quyền 1 chạm | claude |
| CAP-AI-03 — Model/effort từ CLI + context usage | MVP | ✓ | ✓ | | | Không còn danh sách model cứng | claude |
| CAP-AI-04 — Một danh sách phiên Claude (gộp CLI) | MVP | ✓ | ✓ | | | Không phải hiểu khái niệm nội bộ | claude |
| CAP-AI-05 — Slash command, đính kèm, giọng nói, IME | Phase 2 | ✓ | ✓ | | | Soạn prompt nhanh hơn | claude |
| CAP-AI-06 — Hạn mức dùng Claude | Phase 2 | ✓ | ✓ | | | Không bất ngờ hết hạn mức | claude |
| CAP-AI-07 — Phân quyền chủ phiên cho người dùng SSO | Phase 2 | | | | ✓ | Không lộ hội thoại của nhau | claude |
| CAP-UX-01 — Vỏ ứng dụng + một mô hình điều hướng + deep link | MVP | ✓ | ✓ | | | Biết mình đang ở đâu (H-1) | shell |
| CAP-UX-02 — Design system, tối/sáng, AA, i18n vi/en đủ | MVP | ✓ | ✓ | ✓ | | Giao diện nhất quán | shell |
| CAP-UX-03 — Lần đầu dùng + trạng thái rỗng/tải/lỗi | MVP | ✓ | ✓ | ✓ | | Người mới tự dùng được | shell |
| CAP-OPS-01 — CLI, `.env`, installer stable/beta, systemd, `BASE_PATH` | MVP | | | ✓ | | Cài một lệnh | ops |
| CAP-OPS-02 — Nhập dữ liệu từ v1.x | MVP | | | ✓ | | Chuyển sang bản mới không mất dữ liệu | ops |
| CAP-OPS-03 — Tự cập nhật trong app có quay lại | Phase 2 | | | ✓ | | Cập nhật từ điện thoại | ops |
| CAP-OPS-04 — `/api/health` + `hugremote doctor` | MVP | | | ✓ | | Tự chẩn đoán khi cài lỗi | ops |
| CAP-OPS-05 — Ứng dụng macOS đóng gói, notarize | Phase 3 | | ✓ | ✓ | | Cửa sổ desktop riêng | ops |
| CAP-SEC-01 — Nền bảo mật xuyên suốt (CSP, Origin, CSRF, path scope, 0600, không lộ bí mật) | MVP | ✓ | ✓ | ✓ | ✓ | Đóng lỗ hổng v1.x (H-5) | access |

## 2. Wave sequence

_(Chưa có `Plan/WAVE-SEQUENCE.md` của MESH; dưới đây là bản tương đương)_

---
type: plan
artifact_kind: wave-sequence
status: "DRAFT"
tier: T2
owner_authority: "Authority (solo) — nguyenhung"
last_reviewed: "2026-11-21"
---

# WAVE-SEQUENCE — HugRemote (bản phát triển lại)

> Lập ngày 2026-11-21.
> Chiến lược: **lát cắt dọc theo luồng hằng ngày** — mỗi wave giao một năng lực dùng được trọn từ giao
> diện tới máy đích, theo thứ tự phụ thuộc: vỏ + truy cập + máy/dự án → terminal → file/git → Claude →
> hoàn thiện & thay bản cũ. Rủi ro kỹ thuật cao nhất (SSH, PTY, stream Claude) đặt sớm, mỗi cái một wave.
> Mỗi wave có 2 chiều: `wave_class` (slice | integration) × `wave_strategy` (vertical).
> Ràng buộc: một monorepo duy nhất `srcroot/boundaries/hugremote/` (apps/api + apps/web + packages/shared);
> không wave nào tạo target ngoài monorepo này.

> **CẢNH BÁO CAPACITY:**
> Một người + agent AI. Bản cũ mất 5 tuần cho 288 commit nhưng tích nợ UX và bảo mật. Bản mới viết lại
> trên NestJS + React + SQLite, nhưng **thuật toán** đã kiểm chứng (parser ssh config, auth chain ssh2 +
> fallback OpenSSH, PTY buffer/replay, decoder/normalizer giao thức Claude) được port sang module NestJS
> kèm test của v1 làm đặc tả — nhịp ~1 tuần/wave chỉ khả thi nếu port, không thiết kế lại các thuật toán đó. W3 (Claude) là wave nặng nhất; trễ thì cắt CAP-AI-03 phần context usage
> trước. Không deploy thay bản cũ trước khi W4 xong — bản cũ vẫn là công cụ làm việc hằng ngày.

---

## Wave Inventory

| Wave | Tuần | Tên / Goal ngắn | Class × Strategy | Targets (BE / FE / Mobile) | Capabilities chính | Exit / Demo | At-risk |
|---|:---:|---|---|---|---|---|---|
| W1 | 1 | Vỏ mới + đăng nhập + máy & dự án + terminal | slice × vertical | hugremote (apps/api + apps/web) / — / — | CAP-UX-01, CAP-UX-02 (nền), CAP-ACCESS-01, CAP-SEC-01 (nền), CAP-HOST-01, CAP-HOST-02, CAP-HOST-03, CAP-PROJ-01, CAP-PROJ-03, CAP-TERM-01, CAP-TERM-02, CAP-OPS-04 | Đăng nhập trên điện thoại → thêm máy SSH → tạo dự án → mở terminal chạy `htop`, khoá màn hình, mở lại vẫn chạy | ✓ SSH macOS + PTY |
| W2 | 2 | Files & Git của dự án | slice × vertical | hugremote (apps/api + apps/web) / — / — | CAP-FILE-01, CAP-FILE-02, CAP-GIT-01, CAP-UX-03 (phần) | Mở file trong dự án trên máy SSH, sửa, lưu → thấy trong Git, stage, commit, push | — |
| W3 | 3 | Claude Code trong dự án | slice × vertical | hugremote (apps/api + apps/web) / — / — | CAP-AI-01, CAP-AI-02, CAP-AI-03, CAP-AI-04 | Gửi prompt trên máy SSH, đóng trình duyệt, mở lại thấy stream tiếp; duyệt yêu cầu quyền; tiếp tục một phiên CLI có sẵn | ✓ giao thức Claude |
| W4 | 4 | Hoàn thiện & thay bản cũ | integration × vertical | hugremote (apps/api + apps/web) / — / — | CAP-ACCESS-02, CAP-PROJ-02, CAP-UX-02 (đủ), CAP-UX-03, CAP-OPS-01, CAP-OPS-02, CAP-SEC-01 (pentest) | Cài bằng `install.sh` lên máy của Authority, nhập dữ liệu v1, bật 2FA, chạy sau Cloudflare Tunnel, pentest PASS | ✓ di trú dữ liệu |
| W5 | 5 | Nhóm nhỏ & lịch sử | slice × vertical | hugremote (apps/api + apps/web) / — / — | CAP-ACCESS-03, CAP-AI-07, CAP-GIT-02 | Đồng nghiệp đăng nhập OIDC, chỉ thấy phiên của mình; xem lịch sử commit | — |
| W6 | 6 | Tiện ích Claude & tự cập nhật | slice × vertical | hugremote (apps/api + apps/web) / — / — | CAP-AI-05, CAP-AI-06, CAP-OPS-03 | Soạn prompt bằng giọng nói + đính kèm; cập nhật stable → beta trong app, lỗi tự quay lại | — |

### Cách đọc / control

Mỗi dòng là một wave; cột "Exit / Demo" là kịch bản demo cuối vòng tương ứng. W1–W4 là Phase MVP và
chỉ W4 deploy (thay instance v1 của Authority); W5–W6 là Phase 2, mỗi wave tự deploy. Chi tiết từng wave
ở các mục §W bên dưới; rủi ro và thứ tự cắt ở §Cadence.

---

## §W1 — Vỏ mới + đăng nhập + máy & dự án + terminal (tuần 1)

**Goal:** Dựng nền monorepo (apps/api + apps/web + packages/shared), vỏ ứng dụng mới với mô hình điều hướng duy nhất, và lát cắt rủi ro nhất: kết nối SSH + PTY chạy nền. Mọi wave sau gắn vào phạm vi "máy → dự án" dựng ở đây.

```yaml
wave_class: slice
wave_strategy: vertical
rationale: |
  SSH (ProxyJump, agent macOS) và PTY (resize, replay, chạy nền) là hai lớp lỗi tốn nhiều vòng vá nhất ở v1
  nên phải đi đầu. Phạm vi máy → dự án là xương sống của mọi tab; dựng sau sẽ lặp lại lỗi "sai scope" của v1.
  Đăng nhập + nền bảo mật đi cùng vì app có quyền shell, không có giai đoạn nào được chạy không auth trên mạng.
targets:
  boundaries:
    - boundaries/hugremote   # monorepo: apps/api + apps/web + packages/shared
  web_experiences: []   # apps/web nằm trong monorepo boundaries/hugremote
  mobile_experiences: []
features_in_scope:
  - feat_id: FEAT-SHELL-01
    target: boundaries/hugremote/apps/web
    parent_epic: EPIC-SHELL
    description: Vỏ app mobile/desktop, route hash, token nền, i18n khung (CAP-UX-01, CAP-UX-02)
  - feat_id: FEAT-ACCESS-01
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-ACCESS
    description: Mật khẩu, đổi mật khẩu mặc định, đăng xuất, phiên bền, CSRF, CSP, Origin (CAP-ACCESS-01, CAP-SEC-01)
  - feat_id: FEAT-HOST-01
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-HOST
    description: Parser ssh config, pool ssh2 + fallback OpenSSH, known_hosts, CRUD máy (CAP-HOST-01..03)
  - feat_id: FEAT-PROJ-01
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-WORKSPACE
    description: SQLite + TypeORM migration đầu tiên trong DATA_DIR, dự án, máy đã ghim, phạm vi hiện hành (CAP-PROJ-01, CAP-PROJ-03)
  - feat_id: FEAT-TERM-01
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-TERMINAL
    description: Session manager, node-pty, shell SSH, WS terminal, buffer replay (CAP-TERM-01)
  - feat_id: FEAT-TERM-02
    target: boundaries/hugremote/apps/web
    parent_epic: EPIC-TERMINAL
    description: Màn terminal, pool xterm, thanh phím cảm ứng, visualViewport (CAP-TERM-01, CAP-TERM-02)
  - feat_id: FEAT-OPS-04
    target: boundaries/hugremote/apps/api + bin
    parent_epic: EPIC-OPS
    description: /api/health + hugremote doctor (CAP-OPS-04)
contracts:
  to_ratify:
    - auth-api.v1
    - hosts-api.v1
    - workspace-api.v1
    - terminal-api.v1
    - terminal-ws.v1
    - system-api.v1 (health)
  inherited_active: []
exit_signal:
  type: demo_target
  criteria: |
    1. Trên viewport 390×844: đăng nhập bằng mật khẩu mặc định bị bắt đổi, đổi xong vào app; đăng xuất được.
    2. Thêm máy SSH (container thử, qua jump host) từ giao diện; host key lần đầu được hỏi tin; API danh sách máy không chứa mật khẩu.
    3. Tạo dự án bằng cây thư mục; thanh trên hiện "máy → dự án"; deep link mở lại đúng chỗ.
    4. Mở terminal, chạy `htop`, đóng trình duyệt, mở trên thiết bị khác thấy cùng phiên, màn hình không vỡ.
    5. Restart service, vẫn đăng nhập.
test_scope:
  required:
    - unit
    - integration
    - security-isolation
    - e2e
  conditional:
    - a11y
constraints:
  at_risk: true
  note: Wave ROOT. Rủi ro SSH macOS/agent — port nguyên thuật toán SSH của v1 trước, tối ưu sau. Fallback nếu trễ - để CAP-HOST-02 phần sửa/xoá máy sang W2.
```

---

## §W2 — Files & Git của dự án (tuần 2)

**Goal:** Người dùng xem/sửa file và duyệt/commit thay đổi trong đúng dự án đang chọn, local lẫn SSH, với một editor và một giao diện Git duy nhất.

```yaml
wave_class: slice
wave_strategy: vertical
rationale: |
  Files và Git dùng chung phạm vi dự án + đường dẫn remote — lớp lỗi lặp nhiều ở v1.6.x. Đi trước Claude vì
  luồng Claude cần xem file và diff để duyệt kết quả.
targets:
  boundaries:
    - boundaries/hugremote   # monorepo: apps/api + apps/web + packages/shared
  web_experiences: []   # apps/web nằm trong monorepo boundaries/hugremote
  mobile_experiences: []
features_in_scope:
  - feat_id: FEAT-FILE-01
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-FILES
    description: Module files - local (realpath, ALLOWED_ROOT) + SFTP/exec remote, upload, download zip, tmp TTL (CAP-FILE-01, CAP-FILE-02)
  - feat_id: FEAT-FILE-02
    target: boundaries/hugremote/apps/web
    parent_epic: EPIC-FILES
    description: Màn Files + editor CodeMirror + preview MD/HTML + phím phụ mobile + chặn mất thay đổi (CAP-FILE-01, CAP-FILE-02)
  - feat_id: FEAT-GIT-01
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-GIT
    description: Module git - local + SSH - repos, status, diff, stage, commit, pull, push, checkout (CAP-GIT-01)
  - feat_id: FEAT-GIT-02
    target: boundaries/hugremote/apps/web
    parent_epic: EPIC-GIT
    description: Màn Git - danh sách → chi tiết trên mobile, hai cột trên desktop (CAP-GIT-01)
contracts:
  to_ratify:
    - files-api.v1
    - git-api.v1
  inherited_active:
    - workspace-api.v1
exit_signal:
  type: demo_target
  criteria: |
    1. Trong dự án trên máy SSH: mở README.md thấy preview, sửa, lưu; rời màn khi chưa lưu thì được hỏi.
    2. Tải lên một thư mục, tải xuống thư mục đó dạng zip.
    3. Màn Git thấy file vừa sửa, xem diff, stage, commit, push.
    4. Đường dẫn `../` hoặc symlink ra ngoài ALLOWED_ROOT bị từ chối (test).
test_scope:
  required:
    - unit
    - integration
    - security-isolation
    - e2e
  conditional:
    - a11y
constraints:
  at_risk: false
  note: —
```

---

## §W3 — Claude Code trong dự án (tuần 3)

**Goal:** Giao việc cho Claude Code trong dự án đang chọn, bỏ máy đi, quay lại thấy kết quả; duyệt quyền trên điện thoại; một danh sách phiên duy nhất.

```yaml
wave_class: slice
wave_strategy: vertical
rationale: |
  Đây là lý do chính người dùng mở app trên điện thoại (H-2) và là phần nợ kỹ thuật lớn nhất của v1
  (service Claude nguyên khối ~3400 dòng). Đặt sau Files/Git để kết quả Claude duyệt được ngay trong app.
targets:
  boundaries:
    - boundaries/hugremote   # monorepo: apps/api + apps/web + packages/shared
  web_experiences: []   # apps/web nằm trong monorepo boundaries/hugremote
  mobile_experiences: []
features_in_scope:
  - feat_id: FEAT-AI-01
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-CLAUDE
    description: Process runner local/SSH, decoder JSONL, normalizer, assembler, tác vụ nền, replay buffer, cancel (CAP-AI-01)
  - feat_id: FEAT-AI-02
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-CLAUDE
    description: control_request/response cho tương tác, probe initialize + get_context_usage, phiên CLI ~/.claude/projects (CAP-AI-02..04)
  - feat_id: FEAT-AI-03
    target: boundaries/hugremote/apps/web
    parent_epic: EPIC-CLAUDE
    description: Màn Claude - luồng tin, thẻ công cụ, thẻ duyệt quyền, composer, menu chế độ, chọn model/effort, danh sách phiên gộp (CAP-AI-01..04)
contracts:
  to_ratify:
    - claude-api.v1
    - claude-stream.v1
  inherited_active:
    - workspace-api.v1
exit_signal:
  type: demo_target
  criteria: |
    1. Tạo phiên Claude trong dự án trên máy SSH; Claude chạy đúng thư mục dự án (không phải $HOME).
    2. Gửi prompt, thấy stream thinking/text/tool card; đóng tab giữa chừng, mở lại thấy phần còn lại không lặp.
    3. Claude xin quyền ghi file → thẻ Cho phép/Từ chối hiện ra, bấm Cho phép, Claude chạy tiếp.
    4. Chọn model từ danh sách lấy từ CLI; thấy % context đã dùng.
    5. Danh sách phiên hiện cả phiên CLI tạo ngoài HugRemote; tiếp tục được phiên đó.
    6. Bấm Dừng → trạng thái "Đã dừng" thật.
test_scope:
  required:
    - unit
    - integration
    - contract
    - e2e
  conditional:
    - performance
constraints:
  at_risk: true
  note: Giao thức stream-json của Claude CLI đổi theo phiên bản. Dùng fixture ghi từ CLI thật + test fuzz. Cắt trước - context usage (CAP-AI-03 phần), rồi agent con.
```

---

## §W4 — Hoàn thiện & thay bản cũ (tuần 4)

**Goal:** Đủ để Authority gỡ v1 và dùng bản mới hằng ngày: chuyển nhanh, 2FA, design system hoàn chỉnh tối/sáng, i18n đủ, trải nghiệm lần đầu, cài một lệnh, nhập dữ liệu v1, pentest lại.

```yaml
wave_class: integration
wave_strategy: vertical
rationale: |
  Wave tích hợp cuối Phase MVP — chỉ ở đây mới có thứ đáng deploy thay instance v1. Gom các năng lực ngang
  (chuyển nhanh, 2FA, theme, onboarding, installer, di trú) cần mọi màn đã tồn tại.
targets:
  boundaries:
    - boundaries/hugremote   # monorepo: apps/api + apps/web + packages/shared
  web_experiences: []   # apps/web nằm trong monorepo boundaries/hugremote
  mobile_experiences: []
features_in_scope:
  - feat_id: FEAT-ACCESS-02
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-ACCESS
    description: TOTP, QR, mã khôi phục, rate limit 2FA (CAP-ACCESS-02)
  - feat_id: FEAT-PROJ-02
    target: boundaries/hugremote/apps/web
    parent_epic: EPIC-WORKSPACE
    description: Chuyển nhanh toàn cục, tìm không dấu, an toàn IME (CAP-PROJ-02)
  - feat_id: FEAT-SHELL-02
    target: boundaries/hugremote/apps/web
    parent_epic: EPIC-SHELL
    description: Theme sáng, i18n en đủ, lần đầu dùng, trạng thái rỗng/lỗi, màn Cài đặt (CAP-UX-02, CAP-UX-03)
  - feat_id: FEAT-OPS-01
    target: boundaries/hugremote/bin
    parent_epic: EPIC-OPS
    description: CLI hugremote, install.sh/beta.sh, systemd user service, BASE_PATH (CAP-OPS-01)
  - feat_id: FEAT-OPS-02
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-OPS
    description: Nhập projects.json, auth.json, two_factor.json, phiên Claude v1 (CAP-OPS-02)
contracts:
  to_ratify: []
  inherited_active:
    - auth-api.v1
    - hosts-api.v1
    - workspace-api.v1
    - terminal-api.v1
    - terminal-ws.v1
    - files-api.v1
    - git-api.v1
    - claude-api.v1
    - claude-stream.v1
    - system-api.v1
exit_signal:
  type: demo_target
  criteria: |
    1. Trên máy có v1: chạy install.sh bản mới → dự án, mật khẩu, 2FA, phiên Claude cũ còn nguyên.
    2. Chạy sau Cloudflare Tunnel dưới BASE_PATH /remote; đăng nhập + 2FA trên điện thoại.
    3. ⌘K / nút tìm: gõ "viper" không dấu → mở đúng phiên Claude trên máy khác ≤3 thao tác.
    4. Chuyển sáng/tối, chuyển vi/en — không còn chuỗi chưa dịch.
    5. Bộ pentest của v1 + 4 ca mới PASS.
test_scope:
  required:
    - unit
    - integration
    - security-isolation
    - e2e
    - a11y
  conditional:
    - load-basic
constraints:
  at_risk: true
  note: Di trú dữ liệu v1 đụng dữ liệu thật của Authority - luôn sao lưu trước, chỉ đọc file v1, không sửa tại chỗ.
```

---

## §W5 — Nhóm nhỏ & lịch sử (tuần 5)

**Goal:** Đồng nghiệp đăng nhập bằng SSO vào instance chung và chỉ thấy phiên của mình; xem lịch sử commit.

```yaml
wave_class: slice
wave_strategy: vertical
rationale: |
  Mở rộng tới P-TEAM sau khi bản MVP đã thay v1. SSO phải đi kèm phân quyền chủ phiên, không tách.
targets:
  boundaries:
    - boundaries/hugremote   # monorepo: apps/api + apps/web + packages/shared
  web_experiences: []   # apps/web nằm trong monorepo boundaries/hugremote
  mobile_experiences: []
features_in_scope:
  - feat_id: FEAT-ACCESS-03
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-ACCESS
    description: Google OAuth + OIDC PKCE, JWKS, cấu hình chỉ cho người đã đăng nhập (CAP-ACCESS-03)
  - feat_id: FEAT-AI-07
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-CLAUDE
    description: Chủ phiên Claude/Terminal theo người dùng (CAP-AI-07)
  - feat_id: FEAT-GIT-03
    target: boundaries/hugremote/apps/web
    parent_epic: EPIC-GIT
    description: Lịch sử commit phân trang + diff theo commit (CAP-GIT-02)
contracts:
  to_ratify:
    - sso-api.v1
  inherited_active:
    - auth-api.v1
    - git-api.v1
    - claude-api.v1
exit_signal:
  type: demo_target
  criteria: |
    1. Người dùng B đăng nhập OIDC; không thấy phiên Claude của A.
    2. Gọi cấu hình OIDC khi chưa đăng nhập → 401.
    3. Xem lịch sử commit, mở diff một commit.
test_scope:
  required:
    - unit
    - integration
    - security-isolation
    - e2e
  conditional: []
constraints:
  at_risk: false
  note: Cần một IdP thử (Keycloak trong deployment/local) - Authority chốt ở pha V.
```

---

## §W6 — Tiện ích Claude & tự cập nhật (tuần 6)

**Goal:** Soạn prompt nhanh hơn trên điện thoại và cập nhật phiên bản ngay trong app.

```yaml
wave_class: slice
wave_strategy: vertical
rationale: |
  Tiện ích tăng tốc, không chặn luồng chính. Tự cập nhật đặt cuối vì cần bản đã phát hành ổn định để test
  nâng cấp/quay lại giữa hai phiên bản thật.
targets:
  boundaries:
    - boundaries/hugremote   # monorepo: apps/api + apps/web + packages/shared
  web_experiences: []   # apps/web nằm trong monorepo boundaries/hugremote
  mobile_experiences: []
features_in_scope:
  - feat_id: FEAT-AI-05
    target: boundaries/hugremote/apps/web
    parent_epic: EPIC-CLAUDE
    description: Gợi ý slash command, đính kèm ngữ cảnh, giọng nói theo locale (CAP-AI-05)
  - feat_id: FEAT-AI-06
    target: boundaries/hugremote/apps/api
    parent_epic: EPIC-CLAUDE
    description: Hạn mức 5 giờ / tuần từ CLI + cảnh báo (CAP-AI-06)
  - feat_id: FEAT-OPS-03
    target: boundaries/hugremote/bin + apps/api
    parent_epic: EPIC-OPS
    description: Updater cô lập, khoá, tiến độ, quay lại (CAP-OPS-03)
contracts:
  to_ratify: []
  inherited_active:
    - claude-api.v1
    - system-api.v1
exit_signal:
  type: demo_target
  criteria: |
    1. Đọc prompt bằng giọng nói tiếng Việt, đính kèm một file, gửi.
    2. Cập nhật từ bản phát hành trước lên bản mới trong màn Cài đặt, thấy tiến độ; bản lỗi thì tự quay lại.
test_scope:
  required:
    - unit
    - integration
    - e2e
  conditional: []
constraints:
  at_risk: false
  note: —
```

---

## Cadence

**Nhịp:** 6 wave × ~1 tuần/wave = 6 tuần, tuần tự theo dependency — một người + agent AI.

**Phân loại wave:**
- W1–W3, W5–W6: `slice` + `vertical` — mỗi wave một năng lực dùng được trọn.
- W4: `integration` + `vertical` — hoàn thiện ngang và thay bản cũ.

**Dependency ordering (bắt buộc — không được đảo):**
```
W1 (vỏ + truy cập + máy/dự án + terminal)
  → W2 (files + git)
    → W3 (claude)
      → W4 (hoàn thiện + deploy thay v1)
        → W5 (SSO + lịch sử git)
          → W6 (tiện ích claude + tự cập nhật)
```

**Contract-gate ordering** (BE hoàn thành trước FE paired trong cùng wave):
- W1: FEAT-ACCESS-01, FEAT-HOST-01, FEAT-PROJ-01, FEAT-TERM-01 (BE) → FEAT-SHELL-01, FEAT-TERM-02 (FE)
- W2: FEAT-FILE-01, FEAT-GIT-01 (BE) → FEAT-FILE-02, FEAT-GIT-02 (FE)
- W3: FEAT-AI-01, FEAT-AI-02 (BE) → FEAT-AI-03 (FE)

**At-risk waves (thứ tự rủi ro giảm dần):**

| Wave | Rủi ro chính | First-to-cut nếu squeeze |
|---|---|---|
| W3 (HIGHEST) | Giao thức Claude CLI, tác vụ nền, replay không lặp | (1) context usage; (2) hiển thị agent con; (3) đổi tên phiên CLI |
| W1 (HIGH) | SSH macOS/agent/ProxyJump; PTY resize + replay | (1) sửa/xoá máy sang W2; (2) bàn phím laptop ảo (giữ thanh phím nhanh) |
| W4 (MEDIUM) | Di trú dữ liệu thật của v1 | (1) nhập phiên Claude v1 (giữ dự án + auth); (2) theme sáng |

**Scope-OUT khỏi 6 tuần (Phase sau — KHÔNG đưa vào wave nào):**
- CAP-OPS-05 — ứng dụng macOS đóng gói (Phase 3).
- Bot Telegram, target Docker riêng — ngoài phạm vi (`intake/PRD.md §5`).

**Cảnh báo capacity chính thức:**
> Xem đoạn cảnh báo ở đầu file. Bản v1 vẫn chạy song song tới khi W4 deploy xong; không gỡ v1 trước khi
> kịch bản demo W4 chạy trọn trên máy thật của Authority.

---

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-11-21 | Lập wave sequence cho bản phát triển lại | Claude Code |
