NGUỒN: KẾ HOẠCH VÒNG — lập ở vòng 2 ngày 2026-11-23, từ chỉ thị Authority + intake/PRD.md §3 (CAP-OPS-05)
Pha vòng này: V, I
Thời lượng dự kiến: ~3–5 ngày công — đóng gói Electron + signing ad-hoc + loopback auth
UI vòng này: không có màn mới
Rà lại vòng 2: 2026-11-23

# Vòng 2 — Ứng dụng macOS đóng gói: Electron, .dmg, loopback auth (Phase MVP)

## 1. Mục tiêu vòng

Sau vòng này, chủ instance trên macOS có thể **tải và mở ứng dụng HugRemote native (.dmg / .app)**,
chạy như một ứng dụng macOS thông thường trên Dock mà không cần mở trình duyệt hay nhớ URL/cổng.
Khi mở app, hệ thống tự động khởi động backend trên loopback và đăng nhập 1-chạm không cần gõ mật khẩu,
trong khi các kết nối từ bên ngoài vẫn được bảo vệ tuyệt đối.

**Giả thuyết chạm tới**: H-2 (trải nghiệm dùng hằng ngày thay thế v1 mượt mà, tiện lợi trên desktop).

## 2. Kịch bản demo cuối vòng

Đi đúng các bước này trên sản phẩm của vòng — `make dev` và bản build `.app` / `.dmg`:

| Bước | Người dùng làm | Thấy gì (quan sát được) | AC |
|---|---|---|---|
| 1 | Chạy lệnh `make desktop-build` (hoặc script đóng gói tương đương) trên máy macOS | Bản build `.app` và tệp `.dmg` được tạo trong `apps/desktop/dist/`; lệnh `codesign -v` kiểm tra chữ ký ad-hoc trả về hợp lệ | AC-52 |
| 2 | Mở tệp `.dmg` đã build, kéo HugRemote vào thư mục Applications | Tệp `.app` xuất hiện trong Applications kèm biểu tượng ứng dụng chuẩn | AC-52 |
| 3 | Khởi chạy HugRemote từ Applications | Cửa sổ native macOS xuất hiện với kích thước chuẩn 1200×800, biểu tượng app hiện trên Dock, menu native hỗ trợ ⌘C, ⌘V, ⌘W, ⌘Q | AC-50 |
| 4 | Quan sát quá trình vào ứng dụng | Ứng dụng tự động đăng nhập vai `owner` qua cơ chế loopback ephemeral secret, vào thẳng không gian làm việc (cây Máy › Dự án › Phiên) mà không yêu cầu mật khẩu hay 2FA | AC-51 |
| 5 | Mở tab Terminal và gửi lệnh shell, mở phiên Claude | Terminal PTY và Claude stream chạy mượt mà trong cửa sổ native, phím tắt ⌘K, ⌘P, ⌘⇧F hoạt động tốt | AC-50 |
| 6 | (ngoài video) Kiểm tra bảo mật loopback: gọi `curl http://127.0.0.1:<port>/api/hosts` mà không có header/cookie secret | Nhận phản hồi 401 Unauthorized / 403 Forbidden; không cho phép trình duyệt hoặc tiến trình ngoài truy cập trái phép | AC-51 |

## 3. Cỡ vòng

**~3–5 ngày công** (theo chỉ thị Authority 2026-11-23).

| Phần | Cỡ |
|---|:--:|
| `CAP-OPS-05` (vỏ Electron + build .dmg + loopback auth) | 4 ngày công |

## 4. Phạm vi — capability giao ở vòng này

| Capability | Persona | Target | AC (xem §6) |
|---|---|---|---|
| `CAP-OPS-05` — Ứng dụng macOS đóng gói, notarize (ký ad-hoc) | P-DESK, P-HOST | `srcroot/boundaries/hugremote/apps/desktop` | AC-50, AC-51, AC-52 |

## 5. Ngoài phạm vi vòng này

| Không làm | Vì sao | Để vòng |
|---|---|---|
| Ký Apple Developer ID thật + Notarize qua máy chủ Apple | Authority chưa cấp tài khoản/chứng chỉ Apple Developer; vòng này ký ad-hoc | Khi Authority cấp chứng chỉ |
| Ứng dụng desktop cho Windows / Linux (.exe / .deb / AppImage) | Vòng này tập trung cho macOS theo nhu cầu ưu tiên của Authority | backlog |
| Tự động cập nhật ứng dụng desktop (Auto-Updater qua Sparkle / GitHub Releases) | Vòng này cài đặt thủ công qua file `.dmg` | backlog |
| Giao diện / màn hình mới | Dùng lại 100% giao diện web đã hoàn thành ở vòng 1 (UI vòng này: không có màn mới) | — |

## 6. AC chi tiết

| AC | Capability | Cho trước | Khi | Thì | Kiểm bằng |
|---|---|---|---|---|---|
| AC-50 | `CAP-OPS-05` | Đã build `apps/api` và `apps/web` | Khởi chạy HugRemote `.app` | Cửa sổ native macOS xuất hiện, nạp giao diện SPA, menu native macOS hoạt động, các phím tắt ⌘C, ⌘V, ⌘W, ⌘Q phản hồi đúng | e2e + dogfood power |
| AC-51 | `CAP-OPS-05` | Ứng dụng Electron khởi động trên macOS | BrowserWindow gửi request tới API local | Electron tự sinh secret token ngẫu nhiên, gắn vào cookie/header; API nhận diện và tự động cấp phiên owner không cần đăng nhập; chặn request thiếu secret hoặc ngoài loopback | integration + dogfood breaker |
| AC-52 | `CAP-OPS-05` | Mã nguồn monorepo ở trạng thái sạch | Chạy lệnh đóng gói desktop build | Sinh ra file `.app` và `.dmg` cho macOS, chữ ký ad-hoc `codesign --sign -` hợp lệ | CLI script + dogfood operator |

## 7. Luồng người dùng

### 7.1 Luồng chính — P-DESK: Mở HugRemote desktop app trên macOS

1. Người dùng bấm biểu tượng HugRemote trên Dock hoặc Applications.
2. Electron main process khởi động child process `apps/api` (nếu chưa chạy) trên loopback port khả dụng, sinh ephemeral secret token.
3. BrowserWindow mở ra, nạp `http://127.0.0.1:<port>` kèm cookie secret.
4. Web frontend gửi request kèm cookie secret, backend xác nhận hợp lệ và trả session owner.
5. Người dùng thấy ngay không gian làm việc với các máy, dự án, terminal và Claude.

**Nhánh phụ / lỗi**:
- Cổng mặc định bị chiếm: Electron tự động dò cổng trống tiếp theo và truyền cổng đó vào child process.
- Người dùng đóng cửa sổ: trên macOS, ứng dụng vẫn có thể giữ trên Dock hoặc thoát hẳn theo quy ước standard macOS (⌘Q).

## 8. Màn hình

— vòng này không có màn mới, dùng lại toàn bộ 12 màn hình đã dựng ở vòng 1.

## 9. Thay đổi theo target

### 9.1 `srcroot/boundaries/hugremote/apps/desktop`

| Module / thư mục | Việc | Không được làm |
|---|---|---|
| `apps/desktop/src/main/` | Main process Electron: quản lý vòng đời app, child process API, quản lý cửa sổ, sinh secret token, menu native | Không mở rộng quyền Node.js trực tiếp vào Webview (tắt nodeIntegration, bật contextIsolation) |
| `apps/desktop/src/preload/` | Preload script: cầu nối an toàn nếu cần expose API hệ thống | Không bypass contextIsolation |
| `apps/desktop/electron-builder.yml` | Cấu hình đóng gói .app và .dmg, cấu hình signing ad-hoc | Không hardcode chứng chỉ giả mạo |

**Biến môi trường / cấu hình mới**: `HUGREMOTE_DESKTOP_SECRET` — secret token truyền giữa Electron main và API child process.

## 10. Contract delta

| Contract | Endpoint · event · tool | Mới / sửa / bỏ | Vào (trường chính) | Ra (trường chính) | Lỗi trả về | Tương thích ngược |
|---|---|---|---|---|---|---|
| `desktop-loopback.v1` | `POST /api/auth/desktop-loopback` hoặc middleware xác thực loopback | Mới | `secretToken` (qua header hoặc cookie) | `accessToken`, `user` (owner) | 401 Invalid Token · 403 Non-Loopback Origin | Giữ nguyên mọi route cũ của web vòng 1 |

## 11. Dữ liệu & migration

| DB / schema | Bảng | Mới / sửa | Trường · index · ràng buộc | Migration & dữ liệu cũ |
|---|---|---|---|---|
| SQLite | — | — | Không thêm bảng mới, dùng chung CSDL SQLite của vòng 1 | Dữ liệu vòng 1 giữ nguyên |

**Seed cho dev, dogfood & demo**: Dữ liệu seed local từ vòng 1 (`deployment/local/`).

## 12. Luật nghiệp vụ, mặc định & giới hạn

| Luật | Mặc định | Chỉnh ở đâu | Vi phạm thì | Thông điệp người dùng thấy |
|---|---|---|---|---|
| Giới hạn loopback cho desktop secret | Chỉ chấp nhận kết nối từ `127.0.0.1` hoặc `localhost` | Cố định ở backend middleware | Từ chối truy cập (403) | "Chỉ hỗ trợ xác thực loopback trên máy cục bộ" |
| Thời hạn secret token desktop | Hết hạn khi tắt ứng dụng Electron | Sinh ngẫu nhiên mỗi lần chạy | Token cũ bị từ chối | "Phiên desktop đã hết hạn" |

## 13. Ca biên & lỗi

| Ca | Kích hoạt khi | Hệ thống làm gì | Người dùng thấy gì |
|---|---|---|---|
| Cổng loopback 8099 bị ứng dụng khác chiếm | Khi khởi động app Electron | Electron dò tìm port trống ngẫu nhiên khác (ví dụ 8100..8199) và truyền cổng vào child process qua biến môi trường | App vẫn khởi động bình thường |
| Tiến trình API bị dừng đột ngột | Người dùng kill process qua Activity Monitor | Electron phát hiện sự kiện `exit` của child process và hiển thị thông báo lỗi hoặc tự động restart | Thông báo "Dịch vụ nền gặp sự cố, đang khởi động lại..." |

## 14. Quyền & bảo mật

- **Dòng ma trận `context/PERSONAS.md §2` vòng này chạm**: vai `owner` trên máy cá nhân.
- **Ca ✗ mới phải kiểm (vai `breaker`)**: gọi endpoint desktop secret từ trình duyệt khác hoặc từ IP ngoài localhost → chặn 401/403.
- **Bí mật mới**: `HUGREMOTE_DESKTOP_SECRET` — sinh ngẫu nhiên 32-byte lúc khởi chạy app, lưu trong bộ nhớ Electron, không ghi ra đĩa.
- **Đầu vào không tin cậy mới**: —

## 15. Phi chức năng

| Hạng mục | Mức yêu cầu | Đo bằng |
|---|---|---|
| Thời gian khởi động app tới khi render giao diện | < 2.5 s trên Apple Silicon Mac | Thước đo thời gian khởi chạy Electron |
| Dung lượng file cài đặt `.dmg` | < 120 MB | Kích thước file build |

**Sự kiện đo mới**: —

## 16. Phụ thuộc ngoài & việc của Authority

| Thứ cần | Ai chuẩn bị | Trước khi | Tốn tiền / đăng ký dịch vụ? | Không có thì |
|---|---|---|---|---|
| Máy tính macOS (Apple Silicon hoặc Intel) | Authority | Pha I | Không | Không build/test được gói macOS native |
| Chứng chỉ Apple Developer (nếu muốn notarize thật) | Authority | Phase sau | Có phí $99/năm | Tạm ký ad-hoc theo DECISIONS 2026-11-23 |

## 17. Quyết định & câu hỏi mở

| # | Loại | Nội dung | Phương án đề xuất | Ai chốt | Đảo ngược được? |
|---|---|---|---|---|---|
| D-1 | đã chốt | Ký ad-hoc cho app macOS thay vì notarize thật | Dùng `codesign --sign -` | Authority (2026-11-23) | Có |
| D-2 | đã chốt | Tự động đăng nhập qua loopback ephemeral secret | Sinh secret per-run, gắn cookie | Meta chốt ở pha V | Có |

## 18. Kế hoạch test

| Lớp | Phủ gì | Công cụ (theo `context/TECHSTACK.md`) |
|---|---|---|
| unit | Cơ chế sinh secret, kiểm tra token loopback | Jest / Vitest |
| integration | API xác thực desktop secret, spawn child process API | Supertest / Node.js child_process test |
| contract | Contract `desktop-loopback.v1` | Jest contract test |
| e2e | Khởi chạy Electron app, hiển thị BrowserWindow, phím tắt | Playwright Electron runner |

## 19. Gợi ý dogfood

| Vai | Bật vì | Persona | Kịch bản vòng này | Hồ sơ dữ liệu |
|---|---|---|---|---|
| `smoke` | luôn bật | P-DESK | §2 + smoke hồi quy các vòng trước | Dữ liệu local vòng 1 |
| `newbie` | cài đặt app lần đầu | P-HOST | Tải `.dmg`, mở app, kiểm tra không cần gõ mật khẩu | Môi trường macOS sạch |
| `power` | kiểm tra phím tắt | P-DESK | Sử dụng các tổ hợp ⌘C, ⌘V, ⌘W, ⌘Q, ⌘K, ⌘P trong app desktop | Workspace sẵn có |
| `breaker` | kiểm tra bảo mật loopback | P-HOST | Thử truy cập API secret từ bên ngoài | curl / trình duyệt ngoài |
| `operator` | quy trình build | P-HOST | Chạy lệnh build `.dmg` và kiểm tra chữ ký ad-hoc | CLI macOS |

**Dòng smoke hồi quy thêm từ vòng này**: AC-50, AC-51, AC-52 (ứng dụng macOS desktop hoạt động, xác thực tự động).

## 20. Rủi ro & thứ tự cắt

| Rủi ro | Dấu hiệu sớm | Phòng | Nếu xảy ra |
|---|---|---|---|
| Gatekeeper của macOS chặn mở app ký ad-hoc | Báo lỗi "App is damaged" hoặc "unidentified developer" | Hướng dẫn mở qua Control + Click hoặc `xattr -cr` trong README | Ghi rõ trong tài liệu hướng dẫn |
| Đụng độ thư viện native giữa Node của API và Electron | Lỗi ABI mismatch khi nạp `node-pty` / `better-sqlite3` | Dùng child process tách biệt chạy Node hệ thống thay vì nhúng trực tiếp vào Electron runtime | Child process cô lập giải quyết 100% rủi ro ABI |

**Thứ tự cắt nếu vượt biên hoặc trễ**: 1. Đóng gói `.dmg` (chỉ xuất thư mục `.app`) → 2. Cửa sổ Settings riêng (giữ nguyên web settings).

## 21. Thứ tự triển khai

| Bước | Lát cắt | Target chạm | Cỡ | Xong khi |
|---|---|---|:--:|---|
| 1 | Scaffold target `apps/desktop` + cấu hình Electron cơ bản | `apps/desktop` | 1 ngày công | Chạy được `pnpm --filter @app/desktop dev` mở cửa sổ trắng |
| 2 | Cơ chế spawn API child process + loopback secret auth | `apps/api`, `apps/desktop` | 1.5 ngày công | Mở Electron app là tự động đăng nhập vào giao diện web |
| 3 | Menu native macOS, phím tắt, window bounds persistence | `apps/desktop` | 0.5 ngày công | ⌘Q, ⌘W, ⌘C, ⌘V hoạt động đúng |
| 4 | Cấu hình electron-builder, script build `.app` và `.dmg` ký ad-hoc | `apps/desktop`, Makefile | 1 ngày công | `make desktop-build` sinh ra `.dmg` cài đặt được |

## 22. Định nghĩa xong

- [ ] Mọi AC ở §6 (AC-50, AC-51, AC-52) đạt, kiểm bằng đúng cách ghi ở cột "Kiểm bằng"
- [ ] Kịch bản §2 chạy trọn trên máy macOS
- [ ] `make check` + `make test` xanh
- [ ] Dogfood theo §19 (`smoke` đầu + cuối)
- [ ] Video demo kịch bản §2 đã quay, ghi `context/DEMOS.md` mục `## Vòng 2`

## 23. Phụ thuộc vòng trước

| Cần gì | Từ vòng | Hỏng thì sao |
|---|---|---|
| Monorepo NestJS `apps/api` và React `apps/web` hoàn chỉnh | 1 | Không có backend và giao diện để Electron đóng gói |

## 24. Legacy được phép phá

| Phá gì | Ai/dữ liệu đang dùng | Đường di trú |
|---|---|---|
| — | — | Không phá legacy vòng 1, ứng dụng desktop chỉ là vỏ bọc ngoài cho trải nghiệm native |

## 25. Điều chỉnh khi mở vòng

| Ngày | Đổi gì | Vì sao |
|---|---|---|
| 2026-11-23 | Mở vòng 2 cho CAP-OPS-05 (ứng dụng macOS đóng gói) | Chỉ thị trực tiếp của Authority qua chat, dời từ Phase 3 lên làm ngay |
