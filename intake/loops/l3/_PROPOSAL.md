NGUỒN: KẾ HOẠCH VÒNG — lập ngày 2026-11-24 từ yêu cầu trực tiếp của Authority qua chat (5 mục), 14 câu làm rõ đã trả lời ngày 2026-11-24 (§17)
Pha vòng này: V, I, P (chỉ P1 — không deploy production)
Thời lượng dự kiến: ~6–8 ngày công
UI vòng này: có màn mới — S13 Phiên trình duyệt, S14 Chuyển tiếp cổng; S6 thêm trạng thái tmux / mất kết nối; menu + thêm tmux + trình duyệt
Rà lại vòng 3: 2026-11-24

# Vòng 3 — Terminal dùng hằng ngày trên desktop: phím tắt macOS, tmux bền, mở lại tại chỗ, trình duyệt, chuyển tiếp cổng (Phase 3)

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
| Pha P1 — checklist production-ready + soi bug/viết test | 1 ngày công |

## 4. Phạm vi

| Mục Authority | Persona | Target | AC |
|---|---|---|---|
| 1. Phím tắt terminal (⇧Enter, ⌘/⌥ + ⌫/←/→, ⌘C) | P-DESK | `apps/web` (terminal-pool), `apps/desktop` (menu) | AC-53 |
| 2. Option tmux ở nút + | P-DESK, P-HOST | `apps/api` (terminal), `apps/web` | AC-54, AC-55 |
| 3. Mất kết nối → mở đè tại tab cũ | P-DESK | `apps/api`, `apps/web` | AC-56 |
| 4. Trình duyệt | P-DESK | `apps/desktop` (webview), `apps/web` | AC-59 |
| 5. Chuyển tiếp cổng | P-DESK, P-HOST | `apps/api` (ssh forward), `apps/web` | AC-57, AC-58 |

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

## 5b. Legacy được phép phá

| Phá gì | Vì sao | Di trú |
|---|---|---|
| AC-2 (vòng 1): phiên terminal `exited` khi restart → nút "Terminal mới ở thư mục này" **mở tab mới** | Authority yêu cầu (chat 2026-11-24, mục 3): mở đè ngay tại tab mất kết nối | Đổi thành *Mở lại tại đây* tái dùng cùng `terminal_sessions.id`; bản ghi cũ không cần chuyển, chỉ thêm cột (§11) |

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

## 8. Màn hình

Prototype: `prototype/hugremote/index.html` (bảng điều khiển → hàng "Vòng 3").
- **S6** thêm: biểu tượng tmux ở tab/cây; trạng thái *đang gắn lại* (tmux); trạng thái *mất kết nối* với *Mở lại tại đây* / *Đóng tab*.
- **Menu +**: *Phiên tmux mới* (⌥⇧M, chỉ máy SSH) + nhóm *tmux trên <máy>* + *Trình duyệt mới* (⌥⇧B).
- **S13 Phiên trình duyệt** — một loại phiên mới ở nút + (*Trình duyệt mới*, ⌥⇧B), nằm chung thanh tab Phiên và cây như Claude/terminal/tmux, biểu tượng quả địa cầu, tên tab = địa chỉ trang. **Mỗi phiên xem một trang**; nhập link khác thì đổi trang ngay trong phiên đó; mở nhiều phiên = nhiều trang. Có thanh địa chỉ, chip cổng đang nghe, nhãn đường chuyển tiếp, mở ngoài, DevTools; trạng thái chưa chuyển tiếp / cổng không nghe / đang tải. Chỉ có trong app desktop (chốt Q-3).
- **S14 Chuyển tiếp cổng** — nút biểu tượng trên header (owner) + menu máy: danh sách hai chiều, lọc theo máy, cổng đang nghe chưa chuyển tiếp, sheet thêm mới (lỗi trùng cổng).
- **Header / thanh bên desktop (chỉnh theo Authority 2026-11-24)**: tab Phiên · Files · Git chỉ biểu tượng (bỏ tab Trình duyệt — đã thành loại phiên) (tooltip + nhãn ẩn; điện thoại giữ chữ); bỏ nút Chuyển nhanh trên header khi có thanh bên (giữ ô ở thanh bên; điện thoại vẫn có nút); bỏ nút Cài đặt ở chân thanh bên (giữ trên header); tên phiên tmux = tên tmux, không tiền tố, phân biệt bằng biểu tượng.

## 10. Contract delta (additive)

| Contract | Endpoint · event | Mới / sửa | Ghi chú |
|---|---|---|---|
| `terminal.v1` | `POST /api/terminal-sessions` | sửa — thêm trường tuỳ chọn `tmux: { name }` | Thiếu trường = hành vi cũ |
| `terminal.v1` | `POST /api/terminal-sessions/:id/reopen` | mới | 409 nếu phiên đang chạy |
| `terminal.v1` | `GET /api/hosts/:id/tmux-sessions` | mới | 422 `TMUX_NOT_INSTALLED` |
| `forwards.v1` | `GET/POST/PATCH/DELETE /api/port-forwards`, `GET /api/hosts/:id/listening-ports` | mới | owner-only |

## 11. Dữ liệu & migration

| Bảng | Mới / sửa | Trường |
|---|---|---|
| `terminal_sessions` | sửa (cột nullable) | `tmux_name`, `last_cwd` |
| `port_forwards` | mới | `id, direction ('L'|'R'), host_id, remote_host, remote_port, local_port (UNIQUE khi direction='L'), label, auto_start, created_at` |

## 14. Quyền & bảo mật

- Chuyển tiếp cổng và listening-ports: **owner-only**; cổng cục bộ chỉ bind `127.0.0.1`; chặn `local_port < 1024`.
- Webview trình duyệt: `partition` riêng, `nodeIntegration` tắt, không chia cookie với HugRemote; chỉ cho `http(s)://localhost|127.0.0.1`.
- `tmux` name: chỉ `[A-Za-z0-9_.-]{1,64}` (đi vào lệnh shell).

## 17. Câu hỏi đã chốt với Authority (chat 2026-11-24)

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

## 19. Gợi ý dogfood

| Vai | Bật vì | Kịch bản |
|---|---|---|
| `smoke` | luôn bật | §2 + AC-1..52 |
| `power` | phím tắt | Toàn bộ AC-53 trong Claude CLI, vim, tmux |
| `breaker` | cổng mở + webview | member gọi forwards (403), bind ngoài 127.0.0.1, tên tmux chứa `;` |
| `edge` | mất kết nối | Kill tmux bên ngoài khi tab đang mở; máy SSH tắt khi đang forward; cổng cục bộ bận |
| `operator` | tự bật khi mở app | ⌘Q / mở lại nhiều lần, chuyển tiếp hai chiều tự bật, tmux tự gắn |

## 20. Thứ tự cắt nếu trễ

1. Phiên trình duyệt (giữ "Mở bằng trình duyệt ngoài" ở S14) → 2. Phát hiện cổng đang nghe (AC-58) → 3. *Gắn vào tmux có sẵn* (giữ *Phiên tmux mới*).

## 21. Thứ tự triển khai

| Bước | Lát cắt | Xong khi |
|---|---|---|
| 1 | AC-53 phím tắt (bảng phím → byte, `attachCustomKeyEventHandler`, `macOptionIsMeta`, `macOptionClickForcesSelection`) | unit test bảng phím xanh |
| 2 | AC-56 mở lại tại chỗ | tab không tăng |
| 3 | AC-54/55 tmux | ⌘Q / mở lại thấy tmux cũ |
| 4 | AC-57/58 chuyển tiếp cổng | `psql -p 15432` nối được |
| 5 | AC-59 Trình duyệt | trang :3000 hiện trong app |

## 23. Phụ thuộc vòng trước

| Cần gì | Từ vòng | Hỏng thì sao |
|---|---|---|
| Terminal PTY qua SSH, `terminal-ws.v1` | 1 | Không có nền cho tmux / mở lại |
| App desktop Electron | 2 | AC-59 (webview) và "tự bật khi mở app" không có chỗ chạy |
