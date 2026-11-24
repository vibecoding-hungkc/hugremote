NGUỒN: KẾ HOẠCH VÒNG — lập ngày 2026-11-24 từ yêu cầu trực tiếp của Authority qua chat (5 mục), 14 câu làm rõ đã trả lời ngày 2026-11-24 (§17)
Pha vòng này: V, I, P (chỉ P1 — không deploy production)
Thời lượng dự kiến: ~8–10 ngày công
UI vòng này: có màn mới — S13 Phiên trình duyệt, S14 Chuyển tiếp cổng; S6 thêm trạng thái tmux / mất kết nối; menu + thêm tmux + trình duyệt
Rà lại vòng 3: 2026-11-24

# Vòng 3 — Terminal dùng hằng ngày trên desktop: phím tắt macOS, tmux bền, mở lại tại chỗ, trình duyệt, chuyển tiếp cổng (Phase MVP)

## 1. Mục tiêu vòng

Sau vòng này, chủ instance dùng app desktop HugRemote để làm việc cả ngày **thay cho iTerm + `ssh -L` + trình duyệt riêng**:
gõ trong terminal (kể cả Claude CLI) bằng đúng phím tắt macOS quen tay, shell trong tmux sống qua lần tắt/mở app,
tab mất kết nối mở lại ngay tại chỗ, và xem được web app đang chạy trên máy SSH ngay trong app.

**Giả thuyết chạm tới**: H-2 (trải nghiệm dùng hằng ngày thay thế công cụ cũ mượt mà trên desktop).

## 2. Kịch bản demo cuối vòng

| Bước | Người dùng làm | Thấy gì (quan sát được) | AC |
|---|---|---|---|
| 1 | Trong terminal chạy `claude`, gõ một câu, bấm ⇧Enter, gõ dòng hai | Ô nhập của Claude CLI xuống dòng, chưa gửi | AC-53 |
| 2 | ⌥← nhảy về từ trước, ⌥⌫ xoá một từ, ⌘← về đầu dòng, ⌘⌫ xoá tới đầu dòng | Con trỏ/chữ đổi đúng như iTerm | AC-53 |
| 3 | Bôi đen câu trả lời của Claude, ⌘C, dán sang tab Files bằng ⌘V; rồi bỏ chọn, ⌘C lần nữa | Lần đầu: nội dung dán đúng, Claude không bị dừng. Lần hai (không có vùng chọn): gửi Ctrl+C, Claude dừng | AC-53 |
| 4 | Bấm + → *Phiên tmux mới*; chạy `pnpm dev` trong đó | Tab có biểu tượng tmux, server chạy | AC-54 |
| 5 | Mở + → *Phiên tmux mới* lần nữa; nhóm *tmux trên <máy>* liệt kê các session | Session thứ hai `<dự án>-2`; danh sách đúng `tmux ls` | AC-54 |
| 6 | ⌘Q thoát app, mở lại | Tab tmux hiện "Đang gắn lại…" rồi trở về đúng màn hình cũ, `pnpm dev` vẫn chạy | AC-55 |
| 7 | Tab terminal thường hiện "Mất kết nối với shell này" → bấm *Mở lại tại đây* | Shell mới mở **trong chính tab đó**, cùng tên + thư mục; số tab không tăng | AC-56 |
| 8 | + → *Trình duyệt mới* → thấy chip cổng đang nghe `:3000 node` | Tab trình duyệt mới trong thanh Phiên; chip đúng `ss -ltnp` của máy | AC-58, AC-59 |
| 9 | Bấm chip `:5173` chưa chuyển tiếp → *Chuyển tiếp và mở*; gõ link khác vào thanh địa chỉ | Trang hiện trong app; gõ link khác thì đổi trang **ngay trong tab đó** | AC-57, AC-59 |
| 10 | Vào *Chuyển tiếp cổng* → thêm `localhost:5432` → cổng 15432, bật "tự bật khi mở app"; thêm chiều Mac → máy SSH cho `11434`; ⌘Q, mở lại | Cả hai chuyển tiếp tự bật lại; `psql -p 15432` trên Mac và `curl localhost:11434` trên máy SSH nối được | AC-57 |
| 11 | (ngoài video) Thêm chuyển tiếp trùng cổng cục bộ đang dùng | Báo lỗi "Cổng … đang bị … dùng", không ghi đè | AC-57 |

## 3. Cỡ vòng

| Phần | Cỡ |
|---|:--:|
| Phím tắt terminal macOS + chép/dán (mục 1) | 1 ngày công |
| Phiên tmux: tạo / gắn / tự gắn lại (mục 2) | 2 ngày công |
| Mở lại tại chỗ (mục 3) | 0.5 ngày công |
| Chuyển tiếp cổng + phát hiện cổng (mục 5) | 2 ngày công |
| Phiên trình duyệt (mục 4) | 1.5 ngày công |
| Files giữ trạng thái + Home file ẩn (mục 6) | 0.5 ngày công |
| Ô chat gọn + hạn mức trong popup model (mục 7) | 0.5 ngày công |
| Pha P1 — checklist production-ready + soi bug/viết test | 1 ngày công |

## 4. Phạm vi — capability giao ở vòng này

| Mục Authority | Persona | Target | AC |
|---|---|---|---|
| 1. Phím tắt terminal (CAP-TERM-03) (⇧Enter, ⌘/⌥ + ⌫/←/→, ⌘C) | P-DESK | `apps/web` (terminal-pool), `apps/desktop` (menu) | AC-53 |
| 2. Option tmux ở nút + (CAP-TERM-04) | P-DESK, P-HOST | `apps/api` (terminal), `apps/web` | AC-54, AC-55 |
| 3. Mất kết nối → mở đè tại tab cũ (CAP-TERM-04) | P-DESK | `apps/api`, `apps/web` | AC-56 |
| 4. Trình duyệt (CAP-WEB-01) | P-DESK | `apps/desktop` (webview), `apps/web` | AC-59 |
| 5. Chuyển tiếp cổng (CAP-NET-01) | P-DESK, P-HOST | `apps/api` (ssh forward), `apps/web` | AC-57, AC-58 |
| 6. (CAP-FILE-01) Files giữ trạng thái cây + file ẩn ở Home (bổ sung 2026-11-24) | P-DESK | `apps/web` (files.store, FilesView) | AC-60, AC-61 |
| 7. (CAP-AI-03, CAP-AI-06) Ô chat Claude gọn + hạn mức trong popup model (bổ sung 2026-11-24) | P-DESK | `apps/web` (claude composer) | AC-62, AC-63 |

## 5. Ngoài phạm vi vòng này

| Không làm | Vì sao | Để vòng |
|---|---|---|
| Trình duyệt khi dùng HugRemote qua web/điện thoại (proxy ngược qua HugRemote) | `localhost` trên điện thoại là điện thoại; cần reverse proxy + viết lại URL, rủi ro bảo mật riêng | backlog |
| SOCKS (`-D`) | Không có nhu cầu | backlog |
| Chuyển tiếp cổng cho vai member | Mở cổng trên máy owner là quyền owner | backlog |
| Cài tmux hộ khi máy chưa có | Authority chốt (Q-5): chỉ báo lỗi | — |
| tmux trên "Máy này" | Authority chốt (Q-6): tmux chỉ trên máy SSH | — |
| Tự động chuyển tiếp cổng mới | Authority chốt (Q-11): bỏ | — |
| Nhiều trang trong một phiên trình duyệt | Authority chốt (Q-9): mỗi phiên một trang | — |
| Deploy production (P2) | Vẫn chỉ chạy local; P chỉ phần P1 (Q-14) | — |

## 6. AC chi tiết

| AC | Cho trước | Khi | Thì | Kiểm bằng |
|---|---|---|---|---|
| AC-53 | Terminal đang mở trên macOS (desktop hoặc trình duyệt) | Bấm ⇧Enter · ⌥←/⌥→ · ⌘←/⌘→ · ⌥⌫ · ⌘⌫ · ⌘C · ⌘V | Gửi lần lượt `ESC CR` · `ESC b`/`ESC f` · `Ctrl-A`/`Ctrl-E` · `ESC DEL` · `Ctrl-U` (chuẩn macOS — Q-2); ⌘C **có** vùng chọn → chép vào clipboard, không gửi gì; ⌘C **không** vùng chọn → gửi `Ctrl-C` (Q-3); ⌘V dán. ⌥+kéo chọn được chữ cả khi app bắt chuột | unit (bảng phím → byte) + e2e + dogfood power |
| AC-54 | Máy **SSH** có `tmux` ("Máy này" không có mục tmux — Q-6) | Chọn *Phiên tmux mới* / bấm một phiên trong nhóm *tmux trên <máy>* ở menu + | Mỗi lần tạo = **một session tmux mới** (không phải window — Q-4a); nhiều session trên cùng máy/dự án, tên tự sinh `<dự án>`, `<dự án>-2`, … (đổi tên được); API chạy `tmux new-session -A -s <tên>` trong PTY; tab đánh dấu tmux; menu liệt kê `tmux ls` của máy, phiên đang mở ở tab → chuyển tới tab đó; máy không có tmux → lỗi "Máy chưa cài tmux", không cài hộ (Q-5); bấm × đóng tab tmux = **tắt hẳn session** (`tmux kill-session`) sau hộp thoại xác nhận như terminal thường (Q-4) | integration + dogfood |
| AC-55 | Có tab tmux đang mở | App/API khởi động lại hoặc WebSocket đứt | Tab tự gắn lại cùng phiên tmux, không cần bấm; tiến trình bên trong vẫn chạy | e2e + dogfood smoke |
| AC-56 | Tab terminal thường mất kết nối (tắt/mở app, hoặc mạng đứt) / kết thúc | — | Vừa tự nối lại ngầm (cơ chế vòng 1) **vừa** hiện ngay nút *Mở lại tại đây* (Q-7); nối lại được thì nút tự ẩn; bấm nút → shell mới trong **cùng tab** (cùng id, tên, cwd cuối cùng biết được); không thêm tab | e2e |
| AC-57 | Owner, máy SSH kết nối được | Thêm / tắt / xoá chuyển tiếp **hai chiều**: máy SSH → Mac (`-L`, `localhost:<L> ← <máy>:<host:port>`) và Mac → máy SSH (`-R`, cổng mở trên máy SSH trỏ về service trên Mac; chỉ bind 127.0.0.1 phía máy SSH); mỗi hàng có biểu tượng chiều, cổng phía đích sửa được; bấm *Chuyển tiếp* từng cổng đang nghe (không có chế độ tự động chuyển tiếp — chốt 2026-11-24) | Cổng trên máy này **điền sẵn** (= cổng phía máy đó, bận thì +10000) và **sửa được** cả trước lẫn sau khi chuyển tiếp; nghe chỉ trên 127.0.0.1; trùng cổng cục bộ → 409 `LOCAL_PORT_IN_USE`; bật "tự bật" → tự bật lại khi API khởi động; máy mất kết nối → trạng thái lỗi + tự thử lại 10 giây; member gọi → 403 | integration + breaker |
| AC-58 | Owner mở tab Trình duyệt hoặc S14 | — | Liệt kê cổng TCP đang nghe trên máy (`ss -ltnp`, fallback `lsof`) kèm tiến trình; làm mới khi mở màn | integration |
| AC-59 | Đang dùng app desktop | Chọn *Trình duyệt mới* ở nút + (hoặc *Mở bằng trình duyệt* ở file / ở S14), gõ `http://localhost:<cổng máy SSH>` | Mở một **phiên trình duyệt** (tab trong thanh Phiên, lưu lại như phiên khác); mỗi phiên một trang, nhập link khác đổi trang; trang hiện trong app (webview tách phiên khỏi HugRemote) qua chuyển tiếp; chưa chuyển tiếp → nút *Chuyển tiếp và mở*; cổng không nghe → lỗi rõ; có lùi/tiến/tải lại/mở ngoài. Menu chuột phải của file ở tab Files có *Mở bằng trình duyệt* → mở file đó (html/md/ảnh… render, file khác hiện thô) trong một phiên trình duyệt mới | e2e + dogfood |

| AC-60 | Đã mở vài thư mục ở tab Files của dự án | Chuyển sang tab Phiên / dự án khác rồi quay lại Files | Cây giữ nguyên các thư mục đang mở, cờ *hiện file ẩn* và vị trí cuộn — theo **từng dự án**, giữ qua tải lại trang (localStorage). Gốc lỗi: `expanded`/`hidden` là `useState` trong `FilesView.tsx`, mất khi component bị gỡ → chuyển vào `files.store` | e2e |
| AC-61 | Dự án **Home** (`~`) | Mở tab Files | Hiện file ẩn (`.ssh`, `.zshrc`, `.config`…) **mặc định bật** ở Home (dự án khác mặc định tắt như cũ); nút 👁 vẫn bật/tắt được và được nhớ (AC-60). Pha I tái hiện trước khi sửa: nếu bật 👁 vẫn không thấy dotfile ở Home thì là lỗi phía API — sửa luôn | e2e + dogfood |
| AC-62 | Ô chat Claude (S10) | — | Hàng chip chỉ hiện **giá trị**, không chữ nhãn: context `230k/1000k`, model `Sonnet 4.8 · Vừa`, quyền `Tự sửa file` (nhãn chuyển vào tooltip + `aria-label`); bỏ nút khiên cạnh mic (đổi quyền vẫn bằng chip quyền và ⇧Tab) | e2e |
| AC-63 | Popup chọn model | Mở popup | Có hai thanh % hạn mức: **phiên 5 giờ** và **tuần**, kèm giờ reset — **chỉ hiện trong popup**, bỏ chip hạn mức khỏi hàng chip ô chat (Authority 2026-11-24); ≥80% đổi màu cảnh báo; số lấy từ nguồn hạn mức đã có ở vòng 1 | e2e |

## 7. Luồng người dùng

### 7.1 Luồng chính — P-DESK: một ngày làm việc trong app desktop

1. Mở app → vào thẳng không gian làm việc (vòng 2). Tab tmux từ hôm qua tự gắn lại; chuyển tiếp có *Tự bật khi mở app* bật lại.
2. Ở dự án `demo-api`: + → *Phiên tmux mới* → chạy `pnpm dev`; + → *Trình duyệt mới* → chip `:3000` → *Chuyển tiếp và mở* → xem trang.
3. + → *Terminal mới* → `claude` → gõ yêu cầu, ⇧Enter xuống dòng, ↵ gửi; bôi đen câu trả lời ⌘C, dán sang Files ⌘V.
4. Files: mở `src/…`, sang tab Phiên, quay lại → cây còn nguyên.
5. ⌘Q cuối ngày.

**Nhánh phụ / lỗi**: Wi-Fi chập chờn → tab terminal thường hiện *Mất kết nối — đang nối lại* + *Mở lại tại đây*; máy chưa có tmux → lỗi "Máy chưa cài tmux"; cổng cục bộ bận → ô đỏ, điền cổng khác; máy SSH tắt → hàng chuyển tiếp đỏ, tự thử lại.

### 7.2 Luồng phụ — P-HOST: đưa service trên Mac lên máy SSH (`-R`)

S14 → Thêm → chiều *Mac → máy SSH* → cổng `11434` → Chuyển tiếp → trên máy SSH `curl localhost:11434` gọi được service trên Mac.

## 8. Màn hình

Prototype: `prototype/hugremote/index.html` (bảng điều khiển → hàng "Vòng 3").
- **S6** thêm: biểu tượng tmux ở tab/cây; trạng thái *đang gắn lại* (tmux); trạng thái *mất kết nối* với *Mở lại tại đây* / *Đóng tab*.
- **Menu +**: *Phiên tmux mới* (⌥⇧M, chỉ máy SSH) + nhóm *tmux trên <máy>* + *Trình duyệt mới* (⌥⇧B).
- **S13 Phiên trình duyệt** — một loại phiên mới ở nút + (*Trình duyệt mới*, ⌥⇧B), nằm chung thanh tab Phiên và cây như Claude/terminal/tmux, biểu tượng quả địa cầu, tên tab = địa chỉ trang. **Mỗi phiên xem một trang**; nhập link khác thì đổi trang ngay trong phiên đó; mở nhiều phiên = nhiều trang. Có thanh địa chỉ, chip cổng đang nghe, nhãn đường chuyển tiếp, mở ngoài, DevTools; trạng thái chưa chuyển tiếp / cổng không nghe / đang tải. Chỉ có trong app desktop (chốt Q-3).
- **S14 Chuyển tiếp cổng** — nút biểu tượng trên header (owner) + menu máy: danh sách hai chiều, lọc theo máy, cổng đang nghe chưa chuyển tiếp, sheet thêm mới (lỗi trùng cổng).
- **S8 Files**: Home có cây thư mục với file ẩn bật sẵn; trạng thái cây giữ khi đổi tab.
- **S10 ô chat**: chip context / model / quyền chỉ còn giá trị; bỏ nút khiên cạnh mic; popup model có thanh hạn mức phiên 5 giờ + tuần.
- **Header / thanh bên desktop (chỉnh theo Authority 2026-11-24)**: tab Phiên · Files · Git chỉ biểu tượng (bỏ tab Trình duyệt — đã thành loại phiên) (tooltip + nhãn ẩn; điện thoại giữ chữ); bỏ nút Chuyển nhanh trên header khi có thanh bên (giữ ô ở thanh bên; điện thoại vẫn có nút); bỏ nút Cài đặt ở chân thanh bên (giữ trên header); tên phiên tmux = tên tmux, không tiền tố, phân biệt bằng biểu tượng.

## 9. Thay đổi theo target

### 9.1 `srcroot/boundaries/hugremote/apps/api`

| Module / thư mục | Việc | Không được làm |
|---|---|---|
| `modules/terminal` | `tmux` trong tạo phiên, `reopen`, `tmux-sessions`, kill khi xoá; `last_cwd` từ OSC 7; khởi động giữ phiên tmux `running` | Không nối chuỗi lệnh shell (G-17) |
| `modules/forwards` (mới) | Bảng `port_forwards`, listener `-L`/`-R` trên client SSH dùng chung, `listening-ports`, `forward_status` | Không bind ngoài 127.0.0.1; không mở cho member |
| `modules/web-sessions` (mới) | CRUD `web_sessions`, kiểm URL | Không proxy nội dung trang |
| migrations | Thêm cột/bảng như §11 | Không đổi/xoá cột cũ |

### 9.2 `srcroot/boundaries/hugremote/apps/web`

| Module / thư mục | Việc | Không được làm |
|---|---|---|
| `features/terminal` | `mac-keys.ts`, custom key handler, cover mất kết nối + *Mở lại tại đây*, tab tmux | Không đổi phím trên Windows/Linux |
| `features/forwards` (mới) | S14, nút header | — |
| `features/web` (mới) | Loại phiên `web`, S13, gọi preload | Không hiện mục khi không có `window.hugremoteDesktop` |
| `features/files` | State cây vào `files.store` | — |
| `features/claude` | Chip gọn, popup model có hạn mức | — |
| `app/shell` | Header: tab chỉ biểu tượng, nút ⇄, bỏ Chuyển nhanh/Cài đặt trùng | Không đổi bản điện thoại ngoài phạm vi trên |

### 9.3 `srcroot/boundaries/hugremote/apps/desktop`

| Module / thư mục | Việc | Không được làm |
|---|---|---|
| `src/main` | `WebContentsView` cho phiên trình duyệt, chặn điều hướng ngoài localhost | Không bật `nodeIntegration` cho webview |
| `src/preload` | `openWebView`, `closeWebView`, bounds | Không bypass contextIsolation |

**Biến môi trường / cấu hình mới**: — (không có).

## 10. Contract delta

| Contract | Endpoint · event | Mới / sửa | Ghi chú |
|---|---|---|---|
| `terminal-api.v1` | `POST /api/terminal-sessions` | sửa — thêm trường tuỳ chọn `tmux: { name }` | Thiếu trường = hành vi cũ |
| `terminal-api.v1` | `POST /api/terminal-sessions/:id/reopen` | mới | 409 nếu phiên đang chạy |
| `terminal-api.v1` | `GET /api/hosts/:id/tmux-sessions` | mới | 422 `TMUX_NOT_INSTALLED` |
| `forwards.v1` | `GET/POST/PATCH/DELETE /api/port-forwards`, `GET /api/hosts/:id/listening-ports` | mới | owner-only |
| `web-sessions-api.v1` | `GET/POST /api/projects/:id/web-sessions`, `PATCH/DELETE /api/web-sessions/:id` | mới | chỉ localhost/127.0.0.1/file trong gốc |
| `events.v1` | `forward_status` | sửa (thêm sự kiện) | client cũ bỏ qua |

Chi tiết đầy đủ: `context/ARCHITECTURE.md §5`.

## 11. Dữ liệu & migration

| Bảng | Mới / sửa | Trường |
|---|---|---|
| `terminal_sessions` | sửa (cột nullable) | `tmux_name`, `last_cwd` |
| `port_forwards` | mới | `id, direction ('L'|'R'), host_id, remote_host, remote_port, local_port (UNIQUE khi direction='L'), label, auto_start, created_at` |
| `web_sessions` | mới | `id, project_id, owner_user_id, url, name, created_at, last_opened_at` |

**Seed cho dev, dogfood & demo**: seed vòng 1 (`deployment/local/`) + container `demo-sshd` cài thêm `tmux` và một `python3 -m http.server 3000` mẫu để có cổng đang nghe.

## 12. Luật nghiệp vụ, mặc định & giới hạn

| Luật | Mặc định | Chỉnh ở đâu | Vi phạm thì | Thông điệp người dùng thấy |
|---|---|---|---|---|
| Tên session tmux | `<dự án>`, trùng thì `<dự án>-2`, `-3`… | Đổi tên phiên (alias) | Tên ngoài whitelist → 400 | "Tên chỉ gồm chữ, số, `_ . -`" |
| tmux chỉ trên máy SSH | "Máy này" không có mục tmux | Cố định (Q-6) | 400 `TMUX_LOCAL_NOT_SUPPORTED` | — (mục bị ẩn) |
| Cổng cục bộ chuyển tiếp | = cổng phía máy SSH; bận → +10000 | Ô cổng ở S14 | Trùng → 409; <1024 → 400 | "Cổng 3000 đang dùng cho demo-api" |
| Tự bật khi mở app | Bật khi thêm qua sheet; tắt khi bấm *Chuyển tiếp* từ *Đang nghe* | Sheet Thêm | — | — |
| Thử lại chuyển tiếp lỗi | Mỗi 10 giây | Cố định | — | Chữ đỏ ở hàng |
| File ẩn ở Files | Home bật, dự án khác tắt | Nút 👁, nhớ theo dự án | — | — |
| Phiên trình duyệt | Chỉ `localhost`/`127.0.0.1`/`file://` trong dự án | Cố định | 400 / chặn điều hướng | Link ngoài mở bằng trình duyệt mặc định |

## 13. Ca biên & lỗi

| Ca | Kích hoạt khi | Hệ thống làm gì | Người dùng thấy gì |
|---|---|---|---|
| Session tmux bị kill bên ngoài | Gắn lại sau khi mở app | `-A` tạo mới cùng tên | Dải "Phiên tmux đã bị đóng bên ngoài, đã tạo mới" |
| Mạng đứt khi đang dùng terminal thường | WS mất | Tự nối lại + hiện nút ngay (Q-7) | "Mất kết nối — đang nối lại (lần n)" + *Mở lại tại đây* |
| Bấm *Mở lại tại đây* khi phiên vẫn sống | Nối lại vừa thành công | 409 → coi như đã nối | Nút biến mất |
| Cổng cục bộ bận bởi app khác | Thêm / bật chuyển tiếp | 409 `LOCAL_PORT_IN_USE` | Ô đỏ + câu báo |
| Máy SSH cấm forwarding | Bật chuyển tiếp | `err` `FORWARDING_DENIED` | "Máy không cho chuyển tiếp cổng" |
| Máy SSH tắt khi đang chuyển tiếp | SSH đứt | `err`, thử lại 10s | Hàng đỏ |
| Webview điều hướng ra ngoài | Bấm link ngoài | Chặn, mở bằng trình duyệt mặc định | Trang ngoài mở trong Safari/Chrome |
| ⌘C khi đang gõ IME tiếng Việt | `isComposing` | Không chặn | Gõ dấu bình thường |

Chi tiết + các ca của vòng trước: `context/ARCHITECTURE.md §6`.

## 14. Quyền & bảo mật

- Chuyển tiếp cổng và listening-ports: **owner-only**; cổng cục bộ chỉ bind `127.0.0.1`; chặn `local_port < 1024`.
- Webview trình duyệt: `partition` riêng, `nodeIntegration` tắt, không chia cookie với HugRemote; chỉ cho `http(s)://localhost|127.0.0.1`.
- `tmux` name: chỉ `[A-Za-z0-9_.-]{1,64}` (đi vào lệnh shell).
- **Dòng ma trận `PERSONAS.md §2` vòng này chạm**: owner (chuyển tiếp cổng, tmux, trình duyệt); member chỉ dùng tmux/terminal trong phiên của mình (G-13), không có S14.
- **Ca ✗ mới phải kiểm (vai `breaker`)**: member gọi `/api/port-forwards` → 403; không listener nào nghe ngoài 127.0.0.1; tên tmux chứa `;`/`$()` → 400; webview điều hướng ra domain ngoài → bị chặn.
- **Bí mật mới**: —

## 15. Phi chức năng

| Hạng mục | Mức yêu cầu | Đo bằng |
|---|---|---|
| Gắn lại tab tmux sau khi mở app | < 2 giây / tab khi SSH sẵn | đo thời gian e2e |
| Độ trễ thêm của chuyển tiếp `-L` | < 20 ms so với `ssh -L` | `curl -w %{time_total}` |
| Phím tắt | < 5 ms xử lý mỗi phím trong handler | unit benchmark handler |

**Sự kiện đo mới**: — (vòng không chạy E).

## 16. Phụ thuộc ngoài & việc của Authority

| Thứ cần | Ai chuẩn bị | Trước khi | Tốn tiền / đăng ký dịch vụ? | Không có thì |
|---|---|---|---|---|
| Máy SSH có `tmux` (container `demo-sshd` cài sẵn trong seed) | meta (seed) | Pha I | Không | AC-54/55 không kiểm được |
| Máy macOS để chạy app desktop thật (AC-59, phím ⌘) | Authority | Dogfood pha I | Không | Kiểm bằng Playwright Electron trên Linux + bản web; ghi rõ ở `DOGFOOD-PLAN.md §4` |

## 17. Quyết định & câu hỏi mở

| # | Câu hỏi | Chốt |
|---|---|---|
| Q-1 | "Không dùng được Shift" là ca nào | ⇧Enter xuống dòng trong Claude CLI |
| Q-2 | ⌘ / ⌥ khi xoá, di chuyển | Chuẩn macOS: ⌥ = một từ, ⌘ = cả dòng |
| Q-3 | ⌘C không có vùng chọn | Gửi Ctrl+C |
| Q-4a | Phiên tmux mới = session hay window | Session mới mỗi lần |
| Q-4 | × đóng tab tmux | Tắt hẳn session (có xác nhận) |
| Q-5 | Máy chưa cài tmux | Chỉ báo lỗi |
| Q-6 | tmux trên "Máy này" | Không — chỉ máy SSH |
| Q-7 | Mạng đứt khi app đang mở | Tự nối lại ngầm + nút *Mở lại tại đây* hiện ngay |
| Q-8 | Trình duyệt dùng ở đâu | Chỉ app desktop |
| Q-9 | Trình duyệt mở mấy trang | Là một loại phiên ở nút +; mỗi phiên một trang, nhập link đổi trang |
| Q-10 | Chiều chuyển tiếp | Cả hai (`-L`, `-R`) |
| Q-11/12 | Tự động chuyển tiếp | Bỏ hẳn |
| Q-13 | Video demo | Không cần — bỏ khỏi gate R mọi vòng (DECISIONS 2026-11-24) |
| Q-14 | Deploy | Thêm pha P (chỉ P1, vẫn local) |
| — | Giao diện | Bỏ nút tìm kiếm trên header (giữ ở thanh bên), bỏ Cài đặt ở thanh bên, nút Chuyển tiếp cổng lên header, tab dự án chỉ biểu tượng, tên tmux không tiền tố, bỏ dòng chữ hướng dẫn |

Quyết định kỹ thuật của vòng: `context/DECISIONS.md` dưới mốc `(vòng 3)`. Không còn câu hỏi mở.

## 18. Kế hoạch test

| Lớp | Phủ gì | Công cụ (theo `context/TECHSTACK.md`) |
|---|---|---|
| unit | Bảng phím mac → byte; whitelist tên tmux; parser `ss`/`lsof`; files.store persist | Vitest (web), Jest (api) |
| integration | Terminal tmux/reopen trên container `demo-sshd`; forwards `-L`/`-R` thật qua SSH; 403 member | Jest + container `demo-sshd` |
| contract | `terminal-api.v1` delta, `forwards-api.v1`, `web-sessions-api.v1` | Jest contract test (OpenAPI) |
| e2e | AC-53..63 theo §2; smoke hồi quy vòng 1–2 | Playwright (web) + Playwright Electron (desktop) |

## 19. Gợi ý dogfood

| Vai | Bật vì | Kịch bản |
|---|---|---|
| `smoke` | luôn bật | §2 + AC-1..52 |
| `power` | phím tắt | Toàn bộ AC-53 trong Claude CLI, vim, tmux |
| `breaker` | cổng mở + webview | member gọi forwards (403), bind ngoài 127.0.0.1, tên tmux chứa `;` |
| `edge` | mất kết nối | Kill tmux bên ngoài khi tab đang mở; máy SSH tắt khi đang forward; cổng cục bộ bận |
| `operator` | tự bật khi mở app | ⌘Q / mở lại nhiều lần, chuyển tiếp hai chiều tự bật, tmux tự gắn |

## 20. Rủi ro & thứ tự cắt

| Rủi ro | Dấu hiệu sớm | Phòng | Nếu xảy ra |
|---|---|---|---|
| `WebContentsView` chồng lớp lệch khi chia ô / đổi tab | Trang trình duyệt đè lên UI khác | Gửi bounds qua IPC mỗi lần resize/đổi tab; ẩn khi tab không hiện | Cắt chia ô cho phiên trình duyệt |
| Bảng phím ⌘ xung đột menu Electron (⌘W, ⌘Q, ⌘K) | Phím tắt app không chạy khi focus terminal | Handler để mọi phím ngoài bảng đi tiếp như cũ | Thu hẹp bảng về ⇧Enter, ⌥/⌘ + ←/→/⌫, ⌘C |
| Không có Mac để dogfood thật | Kiểm chỉ chạy trên Linux | Playwright Electron trên Linux + ghi rõ | Authority tự thử trên Mac ở pha R |

**Thứ tự cắt nếu vượt biên hoặc trễ**: 1. Phiên trình duyệt (giữ "Mở bằng trình duyệt ngoài" ở S14) → 2. Phát hiện cổng đang nghe (AC-58) → 3. *Gắn vào tmux có sẵn* (giữ *Phiên tmux mới*).

## 21. Thứ tự triển khai

| Bước | Lát cắt | Xong khi |
|---|---|---|
| 1 | AC-53 phím tắt (bảng phím → byte, `attachCustomKeyEventHandler`, `macOptionIsMeta`, `macOptionClickForcesSelection`) | unit test bảng phím xanh |
| 2 | AC-56 mở lại tại chỗ | tab không tăng |
| 3 | AC-54/55 tmux | ⌘Q / mở lại thấy tmux cũ |
| 4 | AC-57/58 chuyển tiếp cổng | `psql -p 15432` nối được |
| 5 | AC-59 Trình duyệt | trang :3000 hiện trong app |
| 6 | AC-60/61 Files | thư mục còn mở sau khi đổi tab |
| 7 | AC-62/63 ô chat + popup model | popup có 2 thanh % |
| 8 | Pha P1: checklist production-ready + soi bug/viết test | `gate.py P1` xanh |

## 22. Định nghĩa xong

- [ ] Mọi AC ở §6 (AC-53..63) đạt, kiểm bằng đúng cách ghi ở cột "Kiểm bằng"
- [ ] Kịch bản §2 chạy trọn (app desktop; phần phím ⌘ trên Mac do Authority xác nhận)
- [ ] `make check` + `make test` xanh; smoke hồi quy AC-1..52 giữ xanh
- [ ] Dogfood theo `DOGFOOD-PLAN.md` (`smoke` đầu + cuối)
- [ ] Pha P1: `PRODUCTION-READY.md` + `BACKWARD-COMPATIBILITY-CHECKLIST.md §3` xanh
- [ ] Video demo: không bắt buộc (DECISIONS 2026-11-24)

## 23. Phụ thuộc vòng trước

| Cần gì | Từ vòng | Hỏng thì sao |
|---|---|---|
| Terminal PTY qua SSH, `terminal-ws.v1` | 1 | Không có nền cho tmux / mở lại |
| App desktop Electron | 2 | AC-59 (webview) và "tự bật khi mở app" không có chỗ chạy |

## 24. Legacy được phép phá

| Phá gì | Vì sao | Di trú |
|---|---|---|
| AC-2 (vòng 1): phiên terminal `exited` khi restart → nút "Terminal mới ở thư mục này" **mở tab mới** | Authority yêu cầu (chat 2026-11-24, mục 3): mở đè ngay tại tab mất kết nối | Đổi thành *Mở lại tại đây* tái dùng cùng `terminal_sessions.id`; bản ghi cũ không cần chuyển, chỉ thêm cột (§11) |

## 25. Điều chỉnh khi mở vòng

| Ngày | Điều chỉnh | Lý do |
|---|---|---|
| 2026-11-24 | Proposal lập mới ở pha V vòng 3 (không có sẵn từ kế hoạch vòng 1); thêm mục 6–7 (AC-60..63) sau phản hồi bổ sung; pha P (chỉ P1) theo Q-14; Phase giữ MVP | Yêu cầu Authority qua chat 2026-11-24; DECISIONS 2026-11-24 |
