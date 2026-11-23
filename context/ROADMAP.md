---
type: roadmap
tier: T1
last_reviewed: "2026-11-21"
---

# ROADMAP — hugremote

> Hai việc: **kế hoạch chia vòng** (§1) và **nơi đổ thứ bị scope-lock đẩy ra** (§3).
> Agent gặp việc ngoài scope thì **ghi vào §3 rồi đi tiếp**, không hỏi.

---

## 1. Kế hoạch vòng

<!-- ĐƯỜNG PHỎNG VẤN: một dòng cho vòng hiện tại là đủ. Vòng sau chỉ mở khi pha R quyết
     GO/PIVOT — không lập trước, vì chưa biết số liệu sẽ nói gì.

     ĐƯỜNG INTAKE: lập ĐẦY ĐỦ ở vòng 1 (VIPER.md §1.4, /viper-validate mục I5). Cắt hệ
     thống trong intake/ROADMAP.md §2 (wave sequence) + intake/PRD.md §3 (capability ×
     phase) thành N vòng. Mỗi dòng ở đây PHẢI có intake/loops/l<N>/_PROPOSAL.md tương
     ứng — gate.py V vòng 1 đối chiếu hai bên, lệch là đỏ.

     Cột "Pha chạy": V, I bắt buộc mọi vòng. Thêm P (deploy) / E (đo) / R (quyết
     go-pivot-kill) ở vòng Authority chốt — hệ thống lớn thì phần lớn vòng chỉ V+I,
     deploy dồn vào vòng có đủ thứ đáng deploy.

     Ví dụ (đường intake):
     | 1 | MVP | Khung xác thực + hồ sơ người dùng (CAP-AUTH-01, CAP-USER-01) | V, I | — | đang chạy |
     | 2 | MVP | Đặt lịch lõi (CAP-BOOK-01..03) | V, I | vòng 1 | chưa mở |
     | 3 | MVP | Nhắc lịch + deploy lần đầu (CAP-NOTI-01) | V, I, P | vòng 2 | chưa mở |
     | 4 | Phase 2 | Đo phản ứng, quyết mở rộng | V, I, P, E, R | vòng 3 | chưa mở |

     Cột "Phase": giai đoạn sản phẩm mà vòng thuộc về (MVP, Phase 2…) — lấy từ cột Phase
     của capability ở intake. Vòng có Phase khác vòng trước = VÒNG ĐẦU của Phase mới: pha V
     của nó lập lại SOLUTION.md phần A (giải pháp tổng thể của Phase) và Authority chốt;
     repeat.py tự đọc cột này để ghi dòng `Phase` ở STATE.md.
-->

| Vòng | Phase | Phạm vi | Pha chạy | Phụ thuộc | Trạng thái |
|---|---|---|---|---|---|
| 1 | MVP | **Toàn bộ HugRemote mới** — 30 capability của intake (W1–W6 gộp): đăng nhập + 2FA + SSO, máy & dự án, terminal, Files, Git (cả lịch sử), Claude chat (stream, chạy nền, duyệt quyền, model, phiên CLI, giọng nói, đính kèm, hạn mức), chuyển nhanh, design system tối/sáng + vi/en, installer, nhập dữ liệu v1, tự cập nhật, nền bảo mật + pentest; + checklist P1 | V, I, P | — | đang chạy |

Authority gộp 6 vòng của kế hoạch cũ thành một vòng (DECISIONS 2026-11-21). Thứ tự 6 wave của
`intake/ROADMAP.md §2` giữ làm **thứ tự triển khai bên trong vòng** (`intake/loops/l1/_PROPOSAL.md §21`).
Không chạy E (chỉ chạy local); P chỉ phần P1. CAP-OPS-05 (app macOS, Phase 3) ngoài kế hoạch.

## 2. Vòng này — bám AC

Nguồn: `PRD.md §3`. Không thêm gì ngoài danh sách đó.

| AC | Trạng thái | Ghi chú |
|---|---|---|
| AC-1 | ☑ | mật khẩu khởi tạo → bắt đổi (≥10 ký tự, khác cũ) trước khi dùng |
| AC-2 | ☑ | đăng xuất; refresh token xoay vòng bền qua restart (thử bằng trình duyệt + security.e2e); lỗi hạ tầng không xoá cookie |
| AC-3 | ☑ | S7: bật 2FA (QR + khoá, mã 6 số) → 10 mã khôi phục hiện một lần; tạo bộ mới / tắt cần mã hiện tại; đăng nhập bằng TOTP hoặc mã khôi phục |
| AC-4 | ☑ | S3 máy local + `~/.ssh/config` (Include, wildcard), trạng thái kết nối |
| AC-5 | ☑ | thêm/sửa/xoá máy SSH ghi ssh config nguyên tử, Thử kết nối, đổi địa chỉ phải thử lại |
| AC-6 | ☑ | lần đầu phải tin host key (vân tay); đổi khoá → HOST_KEY_CHANGED chặn (security.e2e) |
| AC-7 | ☑ | S5 cây thư mục máy → tạo dự án (trùng → mở dự án cũ), phạm vi hiện hành ở thanh trên |
| AC-8 | ☑ | ghim/bỏ/sắp thứ tự máy lưu ở server theo người dùng (đồng bộ thiết bị), bỏ dự án = xoá cho cả nhóm + dừng phiên |
| AC-9 | ☑ | nhiều terminal/dự án, chạy nền, nối lại phát lại buffer, local + SSH qua jump |
| AC-10 | ☑ | chia ô Terminal + Terminal (ô phải chọn terminal khác), đổi tên/đóng ở thanh phiên + cây |
| AC-11 | ☑ | thanh phím cảm ứng (Ctrl, F1–F12, ký tự shell, lệnh nhanh) — đã dogfood mobile 390×844 & 360×740, ghim nút mở ngăn mép phải |
| AC-12 | ☑ | một mô hình điều hướng cây → dự án → tab; mobile: S2 + thanh dưới + bộ chọn phiên — đã dogfood mobile & desktop |
| AC-13 | ☑ | 54/54 token khớp `tokens.json`, 0 màu trộn DS, route `#/_ds`, test tự động i18n/token PASS, đã soi bằng vai `picky` |
| AC-14 | ☑ | JwtAuthGuard toàn cục, @Public tối thiểu; security.e2e 18/18 |
| AC-15 | ☑ | `/api/health`, `hugremote doctor [--fix]`, S7 Hệ thống tình trạng |
| AC-16 | ☑ | Files: cây (.gitignore mờ, git M/A), CodeMirror tô màu, ⌘S, ⌘F/Ctrl+G, vạch dòng đổi, ảnh/markdown/log, xung đột khi file đổi trên máy |
| AC-17 | ☑ | menu ⋯/chuột phải: mới, đổi tên, sao chép, xoá, tải lên/xuống zip, mở terminal ở đây, gửi cho Claude |
| AC-18 | ☑ | S9: thay đổi staged/chưa, diff, stage all, discard, commit ⌘Enter, fetch/pull/push |
| AC-19 | ☑ | lịch sử commit + chi tiết từng commit, tải thêm 50 |
| AC-20 | ☑ | S10 stream + sync khi nối lại, Dừng (Esc) "Đã dừng", agent con (`parent_tool_use_id`) lồng trong thẻ Agent — thử với fake-claude + unit/component test |
| AC-21 | ☑ | thẻ Cho phép/Từ chối/mọi lần ghi + chọn phương án (`AskUserQuestion`, gửi `answers`, không chọn hộ qua ⌥Y/chuông), menu quyền có mô tả, Bypass xác nhận lần hai |
| AC-22 | ◐ | model/effort/slash từ `initialize`, Context a/b từ `get_context_usage` sau mỗi lượt; còn thử đổi model trên giao diện với CLI thật |
| AC-23 | ☑ | danh sách phiên CLI chưa gắn + Tiếp tục (`--resume`), cảnh báo phiên vừa dùng <2 phút; đổi tên gửi `--name` ở lượt kế tiếp |
| AC-24 | ☑ | gợi ý `/`, đính kèm qua Mở nhanh, mic Web Speech, IME `isComposing` không gửi sớm — đã dogfood mobile & locale |
| AC-25 | ◐ | chip Hạn mức 5 giờ từ `rate_limit_event` (fake-claude); chưa đối chiếu CLI thật |
| AC-26 | ☑ | ⌘K / Ctrl+Alt+K (nút ở thanh bên + thanh trên): dự án, phiên, file của dự án hiện tại, lệnh; gõ không dấu; trống → phiên đang chạy/cần duyệt |
| AC-27 | ☑ | Chủ đề Tối/Sáng/Theo hệ thống + Tiếng Việt/English lưu theo người dùng, áp ngay, giữ qua F5 |
| AC-28 | ☑ | thẻ Bắt đầu 3 bước ở S2 (owner) tự đánh dấu, bỏ qua bước 1 được; rỗng/đang tải/lỗi theo khuôn §5 ở các màn đã dựng |
| AC-29 | ◐ | install.sh/beta.sh + CLI `-p -h -b --version doctor update restart import-v1`; thử trên macOS bằng kênh giả + `--no-service`, chạy đúng dưới `/remote`; còn Linux sạch (container) + cài service thật |
| AC-30 | ◐ | `hugremote import-v1`: sao lưu, chỉ đọc, nhập mật khẩu + 2FA + mã khôi phục + dự án + phiên Claude + mật khẩu SSH, chạy lại không trùng, báo cáo S7; định dạng v1 là giả định — cần đối chiếu file v1 thật |
| AC-31 | ☑ | S7: bản mới → xác nhận nêu số phiên sẽ dừng → Cập nhật ngay / Khi rảnh → 5 bước; bấm lại 409; bản hỏng tự quay về (đã thử kênh giả) |
| AC-32 | ☑ | SSO OIDC (Keycloak thử) + Google: PKCE S256 + state + nonce, `id_token` kiểm JWKS, allowlist email/@tên-miền, link sâu giữ qua SSO |
| AC-33 | ☑ | member: 403 với phiên/máy/hệ thống/SSO/2FA của owner, cây/chuông/⌘K lọc theo người dùng — đã dogfood 2 người dùng song song (`breaker` + `operator`) |
| AC-34 | ☑ | `apps/api/test/security.e2e.mjs` trong `make test`: 18/18 PASS (gồm 4 ca mới); sửa 413/400 cho lỗi body-parser, header bảo mật |
| AC-35 | ☑ | chia ô trái/phải: Claude/Terminal/Files/Git ở ô phải, kéo đổi tỉ lệ, giữ qua F5; Files/Git ô phải một cột; dưới 768px ẩn ô phải |
| AC-36 | ☑ | ⌘P khớp mờ + `:dòng`, trống → file đang mở; ⌘⇧F mở tab Tìm ở Files từ bất kỳ đâu |
| AC-37 | ☑ | `file:dòng` mở đúng dòng; Claude sửa file đang mở → tự tải lại + dải báo / xung đột khi đang sửa; file đổi ngoài Claude bắt ở lúc lưu (watcher → backlog) |
| AC-38 | ☑ | chuông ở thanh phiên + thanh trên, ✓/✗ tại chỗ, cập nhật qua events.v1 — đã dogfood desktop + mobile (askbar) |
| AC-39 | ☑ | model/effort/quyền lưu theo phiên, ⚠ đỏ Bypass ở cây/tab/ô soạn, ⇧Tab, nháp + đính kèm riêng từng phiên — đã dogfood F5 với 2 phiên khác cấu hình |
| AC-40 | ☑ | hàng chờ server (mờ, Huỷ), Esc/Dừng giữ hàng chờ, lượt lỗi/dừng → "Gửi tiếp" — thử trên trình duyệt 2026-11-22 |
| AC-41 | ☑ | tóm tắt lượt: thời gian · token · USD · file đổi (chỉ file ghi thành công), bấm file → Git `?file=` |
| AC-42 | ☑ | nút gọn (target) gom bước thành "N bước · sửa x file · chạy y lệnh"; bấm → xem đầy đủ |
| AC-43 | ☑ | dải mất kết nối ngay (offline + heartbeat), khoá nút + phím tắt ghi, mã NETWORK, nháp/bản sửa/commit message giữ, nối lại không tự gửi |
| AC-44 | ☑ | S7 thiết bị đang đăng nhập: đăng xuất từng cái / mọi thiết bị khác / thiết bị này |
| AC-45 | ☑ | S7 Nhóm: thành viên + Thu hồi (đăng xuất mọi nơi, dừng phiên, chặn đăng nhập) + Cho vào lại; lần bị từ chối + Cho phép; Tắt SSO |
| AC-46 | ☑ | S7 Hệ thống: tình trạng + nhật ký Ứng dụng/SSH/Cập nhật, tải/sao chép, không lộ bí mật — đã dogfood `operator` |
| AC-47 | ☑ | `hugremote reset-password` đặt mật khẩu tạm, bắt đổi, đăng xuất mọi thiết bị, giữ 2FA |
| AC-48 | ☑ | link sâu khi chưa đăng nhập về đúng chỗ (cả 2FA, SSO); bị khoá thấy đếm ngược |
| AC-49 | ☑ | ⌘K ⌘P ⌘⇧F ⌘/ ⌘\ ⌥1–9 Ctrl+Tab Ctrl+1/2/3 ⌥⇧N ⌥⇧T ⌥W Esc ⇧Tab ⌥Y/⌥N ⌘S ⌘Enter; bắt ở pha capture để thắng phím editor; PWA dùng ⌘ thay ⌥ |

Thời lượng vòng: `intake/loops/l1/_PROPOSAL.md` (~6 tuần công, gồm P1).

---

- [ ] `files-watch`: theo dõi file đổi ngoài Claude (terminal, công cụ khác) để tự tải lại — vòng sau (DECISIONS 2026-11-22 AC-37)

## 3. Backlog — ngoài scope vòng này

> Agent tự append vào đây khi gặp việc ngoài scope. Format: ngày · việc · vì sao bị đẩy ra · ai/cái gì kích hoạt lại.
> Đường intake: nếu việc đó đã nằm trong kế hoạch ở §1 thì ghi rõ "đã có ở vòng N" thay vì mở dòng mới.

| Ngày | Việc | Vì sao không làm vòng này | Kích hoạt lại khi |
|---|---|---|---|
| 2026-11-21 | Tính năng kiểu Orca: git worktree riêng cho mỗi phiên Claude, chạy song song nhiều agent một task, so sánh/gộp kết quả | Authority chỉ lấy UI của Orca ở bản này; ngoài 31 capability của intake | Authority thả tài liệu vòng / sau Phase 2 |
| 2026-11-21 | Deploy production thật (P2) và đo số liệu (E) | Công cụ chỉ chạy local (Authority) | Khi có người dùng ngoài Authority |

---

## 4. Đã quyết bỏ hẳn

> Khác với backlog — đây là thứ quyết định **không bao giờ làm**, ghi lại để không ai đề xuất lại.

| Ngày | Việc | Lý do bỏ |
|---|---|---|
| 2026-11-21 | Bot Telegram | Không bảo trì từ v1.1, chạy lệnh shell tuỳ ý (`intake/PRD.md §5`) |
| 2026-11-21 | Target Docker/container như một loại máy | Container truy cập qua SSH như mọi host (`intake/PRD.md §5`) |
| 2026-11-21 | Panel nhanh thứ hai (editor + Git riêng) | Gộp vào màn chính; desktop dùng chia ô (`intake/PRD.md §5`) |

---

## 5. Change log

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-21 | Tạo từ template VIPER | — |
| 2026-11-21 | Lập kế hoạch 6 vòng từ intake W1–W6 | Pha V vòng 1, đường intake |
| 2026-11-21 | Gộp 6 vòng thành 1 vòng | Authority chốt ở pha V |
| 2026-11-21 | §2 theo dõi 49 AC (thêm AC-36..AC-49) | Prototype lượt 3–7 + rà soát reviewer |
