---
type: prd
tier: T0
status: ACTIVE
last_reviewed: "2026-11-21"
---

# PRD — hugremote

> **Mô tả sản phẩm ở lát cắt của VÒNG HIỆN TẠI (vòng 1).** Dịch từ `intake/PRD.md` (đường intake).
> Sau khi khoá scope, file này là nguồn sự thật cho mọi quyết định của agent.

---

## 1. Pain point

Lập trình viên làm việc với Claude Code và nhiều máy chủ SSH cần **điều khiển máy làm việc từ điện
thoại, tablet hoặc máy khác**: mở terminal thật, xem và sửa file, theo dõi Git, và nhất là giao việc rồi
duyệt quyền cho Claude Code khi không ngồi trước máy. Các Web IDE hiện có thiết kế desktop-first: nút quá
nhỏ để chạm, bàn phím ảo che terminal, thiếu phím `Ctrl/Esc/Tab/mũi tên`.

HugRemote v1.x đã giải phần kỹ thuật (PTY thật, SSH qua `~/.ssh/config` có Include/ProxyJump, Claude CLI
chạy nền, Git đa repo, cài một lệnh) nhưng sau 288 commit trong 5 tuần **trải nghiệm trở nên rối**: bảy
bề mặt điều hướng chồng nhau (chọn máy 4 lối, chọn dự án 4 lối, tạo phiên 3 lối); tab Files theo máy còn
Git/phiên theo dự án; tính năng làm hai lần (hai editor, hai giao diện Git); "phiên HugRemote" và "phiên
CLI" lộ ra người dùng; phiên terminal chỉ sống trong một trình duyệt; không có nút Đăng xuất; máy thêm vào
không sửa/xoá được; không có design system (~12 bán kính, ~25 cỡ chữ). Kèm **nợ bảo mật**: cấu hình OIDC
ghi đè được khi chưa đăng nhập, API trả mật khẩu SSH dạng rõ, mọi SSH tắt kiểm host key, phiên đăng nhập
chỉ trong RAM. Không làm lại thì mỗi tính năng mới lại thêm một lối điều hướng và một lớp vá; lỗ hổng OIDC
là rủi ro chiếm shell từ xa.

## 2. Đối tượng

Một lập trình viên solo (chủ instance) ở ba bối cảnh — **P-MOBILE** (điện thoại, hằng ngày, vài phút mỗi
lần), **P-DESK** (desktop/tablet, phiên dài, nhiều phiên song song — hạng nhất ngang mobile), **P-HOST**
(cài, bảo mật, cập nhật) — cùng vai `owner` — và **P-TEAM**: đồng nghiệp nhóm nhỏ đăng nhập SSO vào
instance chung (vai `member`). Hôm nay họ đang dùng HugRemote v1.x sau Cloudflare Tunnel.

Chân dung chi tiết + năng lực từng vai + ma trận phân quyền: `context/PERSONAS.md`.

## 3. Tiêu chí chấp nhận (AC) — vòng 1

Vòng 1 = **toàn bộ HugRemote mới** (Authority gộp 6 vòng làm một — DECISIONS 2026-11-21): 30 capability,
chạy local và qua SSH. AC-1..15 là nền (truy cập, máy, dự án, terminal, vỏ); AC-16..37 là Files, Git,
Claude, chuyển nhanh, chủ đề sáng/en, cài đặt + nhập v1 + cập nhật, SSO + member, pentest, và làm việc với file
kiểu developer (AC-36, AC-37); AC-38..49 là phần prototype lượt 4–7 làm lộ ra (chuông duyệt, cấu hình riêng từng
phiên, xếp hàng tin nhắn, tóm tắt lượt, chế độ gọn, mất kết nối, thiết bị, quản trị nhóm, nhật ký, quên mật khẩu,
deep link, phím tắt — DECISIONS 2026-11-21 D1–D17).

| # | Làm được gì | Coi là xong khi | Capability |
|---|---|---|---|
| AC-1 | Đăng nhập lần đầu bằng mật khẩu khởi tạo và bị bắt đổi mật khẩu | Instance mới: nhập mật khẩu khởi tạo → màn "Đặt mật khẩu mới" (≥10 ký tự, khác mật khẩu cũ) → vào app; mọi API khác trả 403 `password_change_required` tới khi đổi xong | CAP-ACCESS-01 |
| AC-2 | Đăng xuất, và phiên đăng nhập còn nguyên sau khi restart dịch vụ | Cài đặt → Đăng xuất → về màn đăng nhập, refresh token bị thu hồi; restart service trong thời hạn 14 ngày → mở lại app không phải đăng nhập | CAP-ACCESS-01 |
| AC-3 | Bật 2FA và đăng nhập bằng mã | Cài đặt → Bảo mật → quét QR, nhập mã đúng → thấy 10 mã khôi phục (tải/sao chép được); lần đăng nhập sau phải nhập mã 6 số hoặc một mã khôi phục (dùng một lần); sai 5 lần → khoá 15 phút, hiện thời gian còn lại | CAP-ACCESS-02 |
| AC-4 | Thấy danh sách máy, gồm máy local và host trong `~/.ssh/config` (kể cả file `Include`) | Màn Máy liệt kê `Máy này` + mọi `Host` không phải wildcard; phản hồi API danh sách máy không chứa trường mật khẩu/passphrase nào (test) | CAP-HOST-01 |
| AC-5 | Thêm, sửa, xoá máy SSH từ giao diện và thử kết nối | Form: tên, host, user, cổng, xác thực (khoá có sẵn / mật khẩu), jump host, thư mục bắt đầu → Lưu ghi Host block vào `~/.ssh/config`; "Thử kết nối" báo Thành công hoặc lỗi có câu hướng dẫn; Xoá hỏi xác nhận rồi gỡ Host block; ProxyJump qua jump host chạy được; **sửa máy**: trường bí mật/thư mục để trống giữ giá trị cũ, đổi host/port/user phải Thử kết nối lại thành công mới Lưu được; xoá máy đang là jump host của máy khác → bị chặn, nêu tên các máy phụ thuộc (409 `HOST_IS_JUMP`) | CAP-HOST-02 |
| AC-6 | Kết nối lần đầu phải tin host key; host key đổi thì bị chặn | Lần đầu: hộp thoại hiện loại khoá + vân tay SHA256 → "Tin máy này" mới kết nối, lưu vào `known_hosts` riêng; host key đổi: kết nối bị chặn, hộp cảnh báo đỏ hiện vân tay cũ/mới, nút "Tôi đã kiểm, tin khoá mới" chỉ bật sau khi tick ô "Tôi đã kiểm vân tay mới với quản trị máy" | CAP-HOST-03 |
| AC-7 | Tạo dự án bằng cây thư mục và chọn dự án làm phạm vi hiện hành | Máy nào cũng có dự án `Home (~)`; "Dự án mới" → cây thư mục của máy (local/SSH) → chọn → dự án xuất hiện ở thanh bên; chọn dự án → thanh trên hiện `máy › dự án`, URL hash `#/s/<máy>/p/<dự án>`; F5 và nút Back giữ đúng chỗ; tạo trùng đường dẫn → mở dự án đã có, không nhân bản; **đổi tên hiển thị (alias)** dự án ở cây hoặc trang dự án — thư mục trên máy giữ nguyên | CAP-PROJ-01 |
| AC-8 | Quản lý không gian làm việc: ghim, bỏ, sắp thứ tự, đồng bộ giữa thiết bị | Ghim/bỏ ghim máy (menu ⋯ ở cây hoặc màn Máy), bỏ dự án khỏi không gian làm việc (owner; xoá dự án cho **cả nhóm**, dừng mọi phiên của dự án kể cả của member — hộp xác nhận nêu số phiên sẽ dừng; thư mục trên máy giữ nguyên), đổi thứ tự máy; mở trên thiết bị/trình duyệt khác thấy đúng danh sách và thứ tự | CAP-PROJ-03 |
| AC-9 | Mở nhiều phiên terminal trong dự án, chạy nền và nối lại đúng | Phiên mở ở gốc dự án (local và SSH); chạy `htop`, đóng trình duyệt, mở trên thiết bị khác → phiên vẫn chạy, màn hình phục hồi đúng kích thước, không chữ chồng; danh sách phiên giống nhau trên mọi thiết bị | CAP-TERM-01 |
| AC-10 | Trên desktop, xem hai phiên terminal cạnh nhau; đổi tên và đóng phiên | Vùng chính dạng tab; "Chia đôi" đặt hai phiên trái/phải, kéo vạch chia đổi tỉ lệ, terminal tự vừa khung; đổi tên phiên; đóng phiên hỏi xác nhận nếu tiến trình còn chạy | CAP-TERM-01 |
| AC-11 | Trên điện thoại, gõ được shell/TUI bằng thanh phím cảm ứng mà bàn phím ảo không che | Thanh phím nhanh (Esc, Tab, Ctrl, ↑↓←→, Enter, ^C) + ngăn mở rộng (tổ hợp Ctrl, ký tự shell, lệnh nhanh, **F1–F12**, phím có nhãn); **chạm vào vùng terminal mở bàn phím ảo**; bàn phím ảo bật thì vùng terminal co theo `visualViewport`, dòng con trỏ luôn thấy | CAP-TERM-02 |
| AC-12 | Một mô hình điều hướng duy nhất, như nhau trên mobile và desktop | Desktop: thanh bên cây Máy → Dự án → Phiên, mỗi phiên có chấm trạng thái (đang chạy / đã kết thúc) + thời gian; mobile: màn Không gian làm việc là cây đó dạng danh sách + thanh dưới; cây **chỉ mở máy và dự án đang dùng** (có Thu gọn tất cả), mỗi hàng chỉ có **+** và **⋯**; mỗi dự án liệt kê phiên Claude trước, terminal sau; **bấm dự án mở lại đúng tab đang dùng ở dự án đó** (không có màn tổng quan dự án), dự án chưa có phiên thì hiện ngay nút Phiên Claude mới / Terminal mới; trong dự án **một tab Phiên chung cho Claude và terminal** (tab trộn, cùng thứ tự với cây), nút **+** hỏi mở Claude hay Terminal; mọi phiên đổi được tên hiển thị; mỗi thứ chỉ có **một** lối tới từ cây; **mobile: bộ chọn phiên** (tên phiên hiện tại · số phiên · danh sách nhóm Claude/Terminal) thay dải tab | CAP-UX-01 |
| AC-13 | Giao diện theo design system đã chốt, chuỗi qua i18n | Mọi màu/cỡ chữ/khoảng cách trong `apps/web` lấy từ token `DESIGN-SYSTEM.md §2` (vai `picky` đo trên app); mọi chuỗi qua khoá i18n (test bắt chuỗi cứng trong JSX) | CAP-UX-02 |
| AC-14 | Nền bảo mật: không đăng nhập thì không chạm được gì | Mọi `/api/*` (trừ đăng nhập, health) và WebSocket trả 401/đóng khi chưa có token hợp lệ; WebSocket từ Origin lạ bị đóng 1008; vé stream dùng một lần, hết hạn 30s; duyệt thư mục local ngoài `ALLOWED_ROOT` (`..`, symlink) bị từ chối; file DB và `secret.key` mode 0600 | CAP-SEC-01 |
| AC-15 | Kiểm tra sức khoẻ và chẩn đoán | `GET /api/health` 200 khi DB mở được; `make doctor` in rõ thiếu gì (Node, git, ssh, python3/zip, quyền DATA_DIR, biến môi trường); Cài đặt → Hệ thống hiện phiên bản + tình trạng | CAP-OPS-04 |
| AC-16 | Duyệt và sửa file của dự án như một developer | Tab Files mở ở **gốc dự án**; cây file lọc theo tên, ẩn/hiện file ẩn, file trong `.gitignore` chữ mờ, M/A cho file đã sửa/mới; **nhiều file mở dạng tab** (chấm chưa lưu); CodeMirror có tô màu cú pháp, số dòng, **đánh dấu dòng mới/đã sửa so với commit**; ⌘/Ctrl+S lưu; **⌘F tìm/thay trong file**, **tới dòng**; `.md` xem trước, HTML trong iframe sandbox, **ảnh xem trực tiếp**, **log có theo dõi (tail -f) và lọc theo mức** (error/warn/info); file >10MB → xem 1.000 dòng cuối hoặc tải xuống; **URL mang `file:dòng`** (`…/files/<đường dẫn>/<dòng>`) — F5/chia sẻ link mở đúng dòng; rời file hoặc **đóng tab file** chưa lưu → hỏi Lưu/Bỏ/Ở lại | CAP-FILE-01 |
| AC-17 | Thao tác file kiểu IDE từ menu ⋯ (nhấn giữ trên mobile) | File: Mở · Mở ở ô bên cạnh · Gửi cho Claude (**chọn phiên Claude nhận**, hoặc phiên mới) · Mở terminal tại thư mục (**terminal mới mở đúng thư mục chứa file**) · Sao chép đường dẫn (tuyệt đối/tương đối) · Xem thay đổi so với commit · Đổi tên/di chuyển · Nhân bản · Tải xuống · Bỏ thay đổi chưa commit · Xoá (hỏi xác nhận). Thư mục: File mới · Thư mục mới · Tải lên vào đây (nhiều file, cả thư mục, có tiến độ) · Tải xuống `.zip` · Mở terminal tại đây · Gửi cho Claude · Đổi tên · Xoá; file nén tạm tự dọn sau 60 phút | CAP-FILE-02 |
| AC-18 | Duyệt và commit thay đổi Git của dự án | Tab Git tìm repo lồng ≤5 cấp; thấy nhánh + **ahead/behind**; file staged/unstaged + số dòng +/−; xem diff; stage/unstage từng file hoặc **tất cả**; **bỏ thay đổi** một file (hỏi xác nhận); nhập message → Commit (**⌘/Ctrl+Enter**); Fetch · Pull (chỉ fast-forward) · Push (tự đặt upstream) là **nút biểu tượng kèm số commit** + tooltip, Push tắt khi không có gì để đẩy; đổi nhánh (danh sách nhánh); mobile: danh sách → chi tiết **xem được diff**, desktop: hai cột | CAP-GIT-01 |
| AC-19 | Xem lịch sử commit | Tab Lịch sử: commit phân trang 50/lần (tác giả, thời gian, message), chọn commit → **danh sách file đổi** (mobile cũng có) → diff từng file | CAP-GIT-02 |
| AC-20 | Giao việc cho Claude Code trong dự án và bỏ máy đi | Phiên Claude chạy ở gốc dự án (local và SSH — `pwd` đúng thư mục); stream suy nghĩ, văn bản, thẻ công cụ, agent con; đóng tab giữa chừng, mở lại (thiết bị khác) thấy phần còn lại, không lặp chữ; Dừng → trạng thái "Đã dừng" thật | CAP-AI-01 |
| AC-21 | Duyệt yêu cầu quyền của Claude trong một chạm | Claude xin quyền/hỏi lựa chọn → thẻ Cho phép/Từ chối/chọn phương án trong luồng chat + chấm "cần duyệt" ở cây; chế độ quyền chọn bằng menu có mô tả (Auto · Manual · Plan · AcceptEdits · Bypass); bật Bypass phải xác nhận lần hai | CAP-AI-02 |
| AC-22 | Chọn model và mức suy nghĩ từ chính Claude CLI | Danh sách model lấy bằng `initialize` trên đúng máy + thư mục; effort Low/Medium/High/Max; chip Context hiện **token đã dùng / sức chứa** context window của model đang chọn dạng `a/b` (vd `227k/1000k`, không hiện phần trăm), chuyển vàng khi >80% | CAP-AI-03 |
| AC-23 | Một danh sách phiên Claude cho mỗi dự án | Danh sách gộp phiên tạo từ HugRemote và phiên CLI có sẵn trong `~/.claude/projects`; tiếp tục (resume), đổi tên (đồng bộ `--name`), xoá; không còn khái niệm "phiên HugRemote vs phiên CLI" trên giao diện | CAP-AI-04 |
| AC-24 | Soạn prompt nhanh trên điện thoại | Gõ `/` → gợi ý slash command; đính kèm file/thư mục của dự án làm ngữ cảnh; nút mic nhận giọng nói theo ngôn ngữ giao diện; gõ Telex/VNI không gửi sớm khi bấm Enter | CAP-AI-05 |
| AC-25 | Thấy hạn mức dùng Claude | Khi CLI cung cấp: chip "Hạn mức 5 giờ x%" ở ô soạn, tooltip/nhấn giữ hiện thêm hạn mức tuần + giờ reset của cả hai; cảnh báo khi ≥80%; CLI không cung cấp → ẩn mục, không có ô nhập tay | CAP-AI-06 |
| AC-26 | Tới đúng chỗ trong ≤3 thao tác bằng chuyển nhanh | ⌘K (Mac) / Ctrl+Alt+K / nút tìm trên mobile mở hộp tìm: dự án, phiên terminal, phiên Claude, file gần đây trên mọi máy đã ghim; tìm không dấu ("viet" khớp "Việt"), ↑↓ Enter Esc; Enter đổi đúng máy + dự án + tab | CAP-PROJ-02 |
| AC-27 | Chủ đề sáng và tiếng Anh | Cài đặt → Giao diện: Tối / Sáng / Theo hệ thống; Ngôn ngữ: Tiếng Việt / English đủ 100% khoá (test bắt khoá thiếu); giọng nói đổi theo ngôn ngữ | CAP-UX-02 |
| AC-28 | Người mới tự dùng được | Instance mới: thẻ "Bắt đầu" 3 bước (Thêm máy → Tạo dự án → Mở terminal hoặc phiên Claude), tự đánh dấu bước đã xong; mọi màn có rỗng/đang tải/lỗi theo khuôn `DESIGN-SYSTEM.md §5` | CAP-UX-03 |
| AC-29 | Cài bằng một lệnh | `curl … install.sh \| bash` (stable) / `beta.sh` trên Linux và macOS sạch: kiểm Node/git/công cụ build, hỏi địa chỉ nghe/cổng/chế độ đăng nhập, tạo `~/.config/hugremote/.env`, cài user service (systemd `--user` / launchd), in mật khẩu khởi tạo; CLI `hugremote -p -h -b --version doctor update`; chạy đúng dưới `BASE_PATH` sau reverse proxy | CAP-OPS-01 |
| AC-30 | Chuyển từ HugRemote v1 không mất dữ liệu | Có v1 trên máy → trình cài hỏi "Nhập dữ liệu v1?" → sao lưu, **chỉ đọc** `projects.json`, `auth.json`, `two_factor.json`, `~/.ssh/hugcode_claude_sessions.json`, mật khẩu SSH v1; báo cáo số dự án/phiên/máy đã nhập; đăng nhập bằng mật khẩu + 2FA cũ được | CAP-OPS-02 |
| AC-31 | Cập nhật ngay trong app | Cài đặt → Hệ thống: thấy bản mới (stable/beta), bấm Cập nhật → **hộp xác nhận nêu số phiên Claude/terminal đang chạy sẽ dừng**, chọn *Cập nhật ngay* hoặc *Khi rảnh* (chờ tới khi không còn phiên chạy, trạng thái "Đang chờ") → tiến độ từng bước (tải, cài thư viện, build, chuyển bản); bấm lần hai không chạy trùng; bản lỗi health check → tự quay về bản trước | CAP-OPS-03 |
| AC-32 | Đăng nhập SSO cho nhóm | Owner cấu hình Google hoặc OIDC (preset Keycloak/Authentik/Okta/Entra, nút Kiểm tra) — chỉ khi đã đăng nhập đủ 2FA; allowlist email rỗng = từ chối tất cả; kiểm chữ ký `id_token` theo JWKS; gọi cấu hình SSO khi chưa đăng nhập → 401 | CAP-ACCESS-03 |
| AC-33 | Thành viên chỉ thấy phiên của mình | Người dùng `member` (vào bằng SSO) chỉ thấy/điều khiển phiên terminal và Claude do mình tạo — **ở mọi nơi**: cây, S2 (Cần bạn, Đang chạy), chuông, ⌘K, thanh phiên, URL gõ thẳng (bị chặn, về S2); màn Máy chỉ xem + ghim cho riêng mình, không thêm/sửa/xoá máy; không thấy Bảo mật 2FA, SSO, Thành viên, Nhật ký, Cập nhật; gọi thẳng API phiên của người khác → 403 | CAP-AI-07 |
| AC-34 | Đóng mọi lỗ hổng đã biết của v1 | Bộ pentest v1 (truy cập chưa xác thực, rate limit, cookie, CSWSH, CORS, path traversal, prototype pollution, body quá lớn, fuzz WS) + 4 ca mới (cấu hình OIDC khi chưa đăng nhập, SSRF qua discover, rò mật khẩu ở API danh sách máy, host key đổi) chạy tự động, đều PASS | CAP-SEC-01 |
| AC-35 | Desktop làm việc song song kiểu Orca | Cây hiện cả phiên Claude (chấm đang chạy / cần duyệt / xong + thời gian) cạnh phiên terminal; vùng chính chia ô trái/phải với bất kỳ cặp nào: Claude + Terminal, Claude + Files, Terminal + Git | CAP-UX-01 |
| AC-36 | Mở nhanh file và tìm trong cả dự án | **⌘P** (nút "Mở nhanh" trên mobile): gõ vài ký tự (khớp mờ) → Enter mở file; thêm `:số` để tới dòng; khi trống hiện file đang mở + vừa thay đổi. **⌘⇧F** (tab Tìm ở Files): tìm nội dung mọi file của dự án (bỏ qua `.gitignore`), kết quả nhóm theo file có số dòng và chữ khớp tô sáng, bấm → mở đúng dòng; tuỳ chọn phân biệt hoa thường, regex, giới hạn thư mục | CAP-FILE-01 |
| AC-37 | Làm việc liền mạch giữa Claude, Git và Files | Đường dẫn `file:dòng` trong thẻ công cụ/tin nhắn của Claude và trong output test bấm được → mở file đúng dòng; diff ở Git có nút Mở file; Claude sửa file đang mở mà người dùng chưa sửa → **tự tải lại** + dải báo "Claude vừa sửa file này" + Xem thay đổi; đang có sửa chưa lưu → hỏi **So sánh · Lấy bản trên máy · Giữ bản của tôi** (không ghi đè im lặng) | CAP-FILE-01 |
| AC-38 | Biết ngay phiên nào cần mình và duyệt mà không rời màn đang làm | Nút chuông ở thanh phiên (desktop S6/S10) và thanh trên (S8/S9, mobile) hiện số phiên Claude đang chờ duyệt trên **mọi dự án mình được thấy**, cập nhật tức thời qua kênh sự kiện toàn cục; mở → mỗi phiên một dòng (tên phiên · yêu cầu · `máy › dự án`) với **✓ Cho phép / ✗ Từ chối** ngay tại chỗ (dòng biến mất sau khi trả lời); bấm dòng → vào đúng phiên; phiên vừa xong lượt có nhãn "xong"; cuối danh sách có "Tất cả phiên của dự án này"; mất kết nối → ✓/✗ khoá | CAP-AI-02 |
| AC-39 | Mỗi phiên Claude giữ cấu hình riêng; Bypass chỉ áp một phiên | Model, effort, chế độ quyền lưu **theo từng phiên** (đổi ở phiên A không đổi phiên B, kể cả sau F5/thiết bị khác); phiên bật Bypass có biểu tượng ⚠ đỏ ở cây, tab và ô soạn; **⇧Tab** trong ô soạn xoay vòng chế độ quyền (trừ Bypass — Bypass luôn qua hộp xác nhận lần hai); nháp và file đính kèm của ô soạn giữ riêng từng phiên trên trình duyệt đó | CAP-AI-02, CAP-AI-03 |
| AC-40 | Gửi tiếp khi Claude đang chạy mà không phá lượt hiện tại | Gửi khi phiên đang chạy → tin vào **hàng chờ phía server** (mờ, có Huỷ), tối đa 10 tin/phiên (vượt → báo "Hàng chờ đã đầy"); lượt xong thì server tự gửi tin kế tiếp, kể cả khi mọi trình duyệt đã đóng; thiết bị khác thấy cùng hàng chờ; **Esc** (hoặc nút Dừng) dừng lượt đang chạy, hàng chờ giữ nguyên | CAP-AI-01 |
| AC-41 | Thấy tóm tắt mỗi lượt Claude | Cuối mỗi lượt có một dòng: thời gian chạy · token vào/ra · chi phí (USD) · số file đã đổi — bấm tên file mở diff của file đó; tóm tắt lưu cùng hội thoại, mở lại phiên (thiết bị khác) vẫn thấy | CAP-AI-01 |
| AC-42 | Xem hội thoại Claude dạng gọn | Nút **gọn** (target) ở ô soạn: bật → chỉ còn tin của bạn, dòng "Claude đang làm · <bước hiện tại>", kết quả, yêu cầu quyền, lỗi chặn lượt và tóm tắt lượt; các bước công cụ gộp thành "n bước · sửa x file · chạy y lệnh" (bấm để xem đủ); tắt → toàn bộ suy nghĩ + thẻ công cụ; lựa chọn nhớ theo người dùng (mọi phiên, mọi thiết bị), mặc định tắt | CAP-AI-01 |
| AC-43 | Mất kết nối không làm mất việc và không báo "xong" giả | Mất kết nối server → dải C13 "Mất kết nối — đang thử lại (lần n)" + Thử ngay; trong lúc đó **khoá mọi thao tác ghi** (Gửi, ✓/✗ duyệt, Lưu file, Commit, Push, Pull, Cập nhật) với tooltip "Đang mất kết nối"; nháp ô soạn, bản sửa file chưa lưu và message commit **giữ nguyên**; nối lại → mở khoá, không tự gửi gì | CAP-UX-03 |
| AC-44 | Xem và đăng xuất các thiết bị đã đăng nhập | Cài đặt → Thiết bị: mỗi thiết bị một dòng (trình duyệt/HĐH, IP, lần đầu, lần cuối dùng, "thiết bị này"); Đăng xuất một thiết bị · Đăng xuất mọi nơi khác; thiết bị bị đăng xuất về S1 ở lần gọi kế tiếp; **đổi mật khẩu → mọi thiết bị khác bị đăng xuất**; member chỉ thấy thiết bị của mình | CAP-ACCESS-01 |
| AC-45 | Owner quản trị nhóm SSO | Cài đặt → Thành viên: danh sách member (email, lần cuối đăng nhập, số phiên đang chạy) + **Thu hồi** (hỏi xác nhận: đăng xuất mọi thiết bị, dừng phiên của họ, gỡ khỏi allowlist); danh sách **lần SSO bị từ chối** gần nhất (email, nhà cung cấp, lý do, giờ) có "Cho phép" một chạm (thêm vào allowlist); allowlist nhận email hoặc `@tên-miền`; **Tắt SSO** (member không đăng nhập được nữa, owner vẫn vào bằng mật khẩu) | CAP-ACCESS-03, CAP-AI-07 |
| AC-46 | Đọc nhật ký ngay trong app | Cài đặt → Nhật ký (owner): chọn Ứng dụng · Cập nhật · SSH, 200 dòng cuối, đã che bí mật; làm mới; tải xuống | CAP-OPS-04 |
| AC-47 | Quên mật khẩu vẫn vào lại được | S1 có "Quên mật khẩu?" → hướng dẫn chạy `hugremote reset-password` trên máy cài; lệnh in mật khẩu tạm, bắt đổi ở lần đăng nhập tới, đăng xuất mọi thiết bị; 2FA giữ nguyên | CAP-ACCESS-01, CAP-OPS-01 |
| AC-48 | Mở link sâu khi chưa đăng nhập thì về đúng chỗ; bị khoá thấy còn bao lâu | Mở `#/s/<máy>/p/<dự án>/files/<đường dẫn>/<dòng>` khi chưa đăng nhập → S1 → đăng nhập (kể cả 2FA, SSO) → về đúng đích; đích không còn/không có quyền → S2 kèm câu báo; bị khoá đăng nhập → đếm ngược mm:ss, hết giờ nút Đăng nhập tự bật | CAP-ACCESS-01 |
| AC-49 | Làm việc bằng bàn phím trên desktop | Phím tắt: chuyển phiên (1–9), Ctrl+Tab, đóng tab, phiên Claude/Terminal mới, duyệt ✓/✗ phiên đang xem, ⌘\\ ẩn thanh bên, ⌘K, ⌘P, ⌘⇧F, ⌘S, ⌘Enter commit, Esc dừng Claude; trong tab trình duyệt thường các tổ hợp trình duyệt giữ (⌘W, ⌘T, ⌘N, ⌘⇧N, ⌘⇧T, ⌘1–9, ⌘Y) dùng **⌥/Alt** thay thế, khi chạy PWA standalone dùng phím gốc; **⌘/** mở bảng phím tắt hiện đúng bộ phím của môi trường đang chạy | CAP-UX-01 |

## 4. Ưu tiên — vòng này giao gì, phần còn lại nằm đâu

Vòng 1 giao **cả hệ thống** — 6 wave của `intake/ROADMAP.md` gộp làm một theo chốt của Authority. Thứ tự
wave giữ làm thứ tự triển khai bên trong vòng (lát cắt dọc, rủi ro cao trước): nền + truy cập + máy/dự án +
terminal → Files/Git → Claude → hoàn thiện (chuyển nhanh, sáng/en, cài đặt, nhập v1) → SSO + member + lịch
sử Git → tiện ích Claude + tự cập nhật. Vòng 1 cũng chạy **P1**. Ngoài vòng: chỉ CAP-OPS-05 (app macOS,
Phase 3). Bản đồ ở `CAPABILITIES-MAP.md`, kế hoạch ở `ROADMAP.md §1`.

## 5. Out-of-scope — chắc chắn KHÔNG làm ở vòng này

- Ứng dụng macOS đóng gói (Electron, `.dmg`, notarize) — CAP-OPS-05, Phase 3
- Tính năng của Orca ngoài bố cục: git worktree riêng mỗi phiên, chạy song song nhiều agent một task, so sánh/gộp kết quả (backlog — `ROADMAP.md §3`)
- Bàn phím laptop ảo đầy đủ 5 hàng (thanh phím + ngăn mở rộng đủ cho AC-11; backlog)
- Nhập hạn mức Claude bằng tay / dán văn bản
- Bot Telegram, target Docker riêng, panel nhanh thứ hai, debugger/LSP, Windows native, đa tenant mức hệ điều hành (`intake/PRD.md §5`)
- Production/PaaS, analytics gửi ra ngoài, pha E (chỉ chạy local)

## 6. Giả thuyết + success metric

**Vòng này không chạy pha E** (chỉ chạy local, DECISIONS 2026-11-21) — tiêu chí xong là 49 AC ở §3 +
checklist P1. Metric của sản phẩm, đọc ở pha R vòng 1 từ nhật ký dùng cục bộ của Authority (không analytics):
**Authority dùng bản mới thay v1 ≥ 7 ngày liên tiếp** (H-2) — ≥7 ngày → GO (mở vòng 2 cho backlog) · quay
lại v1 trong 3 ngày đầu → PIVOT (xem lại điều hướng) · quay lại v1 sau một lượt sửa → KILL bản mới, giữ v1.

Kiểm được bằng test trong vòng: **H-1** (≤3 thao tác — AC-26), **H-3** (0 lỗi sai phạm vi), **H-4** (0 lần đăng
nhập lại sau restart), **H-5** (pentest — AC-34). Rủi ro R-1..R-3 → `EXPERIMENTS.md`.

---

## 7. Quyết định đã chốt ở pha V

| Hạng mục | Chốt |
|---|---|
| Đăng nhập | Tài khoản chủ (`owner`) bằng mật khẩu; thành viên (`member`) bằng SSO Google/OIDC do owner cấu hình. Owner: mật khẩu (PBKDF2-SHA512 100k), không tên đăng nhập; mật khẩu khởi tạo từ `AUTH_PASSWORD` hoặc sinh ngẫu nhiên in ra log lần chạy đầu; bắt đổi lần đầu, ≥10 ký tự. 2FA TOTP tuỳ chọn (bật ở Cài đặt). JWT access 15 phút trong bộ nhớ + refresh 14 ngày trượt (cookie httpOnly `SameSite=Strict`). Khoá 15 phút sau 5 lần sai (mật khẩu và 2FA đếm riêng). Đổi mật khẩu thu hồi mọi thiết bị khác; quên mật khẩu → `hugremote reset-password` trên máy cài; tắt 2FA / tạo mã khôi phục mới cần mã TOTP hoặc một mã khôi phục |
| Thu tiền | Không — công cụ tự host |
| Mô hình dữ liệu lõi | 17 bảng: `users` (kèm `preferences` JSON, `revoked_at`) · `refresh_tokens` (một dòng mỗi thiết bị: `family_id`, IP, user agent) · `two_factor` · `login_attempts` · `sso_config` · `sso_denials` · `hosts_meta` (bổ sung cho Host block của `~/.ssh/config`) · `known_hosts` · `pinned_hosts` · `projects` (thuộc một máy) · `terminal_sessions` + `claude_sessions` + `claude_messages` + `claude_queue` (thuộc một dự án, có chủ) · `recent_files` · `update_runs` · `settings` (khoá hệ thống) — chi tiết `ARCHITECTURE.md §6`. Nháp ô soạn + đính kèm chỉ ở trình duyệt (localStorage theo người dùng + phiên) |
| Ca biên phải xử | Dự án trùng đường dẫn chuẩn hoá trên cùng máy → mở cái có sẵn; xoá máy còn dự án/phiên → hỏi, đóng phiên, xoá dự án của máy đó; xoá máy đang là jump host → chặn (409 `HOST_IS_JUMP`); gửi tin khi Claude đang chạy → xếp hàng ở server; sửa `~/.ssh/config` bên ngoài app → đọc lại theo mtime; host key đổi → chặn; gửi form hai lần → nút khoá khi đang gửi + API idempotent theo khoá tự nhiên; mất WebSocket → tự nối lại, replay buffer |
| Trạng thái rỗng | Chưa có máy SSH: "Chỉ có máy này. Thêm máy SSH để điều khiển máy khác" + nút **Thêm máy**; dự án chưa có phiên: "Chưa có phiên nào" + nút **Mở terminal**; mọi màn theo khuôn `DESIGN-SYSTEM.md §5` |
| Trạng thái lỗi | Mất kết nối server: dải trên "Mất kết nối — đang thử lại (lần n)" + nút Thử ngay, giữ nguyên nội dung terminal; **khoá mọi thao tác ghi** (gửi, duyệt, lưu, commit, push/pull, cập nhật), giữ nháp/bản sửa chưa lưu/message commit, nối lại không tự gửi (AC-43); SSH lỗi: câu nói nguyên nhân (sai khoá / từ chối / không tới được host / host key đổi) + hành động (Sửa máy / Thử lại) |
| Dữ liệu mẫu | `deployment/local/`: container `sshd` (user `dev`, khoá thử, có Claude CLI giả lập `fake-claude` phát fixture stream-json) đứng sau container `jump` (ProxyJump); `~/projects/{demo-api,demo-web}` có repo git, nhánh, 60 commit, file đang sửa; `~/.ssh/config` mẫu dùng `Include conf.d/*.conf`; một host cố ý đổi host key (AC-6); Keycloak container với 2 người dùng thử (AC-32/33); thư mục dữ liệu v1 mẫu (AC-30); kênh phát hành giả qua git repo cục bộ có 2 tag (AC-31) |
| Tên / domain / giọng | HugRemote; không domain công khai (người dùng tự đặt sau Cloudflare Tunnel, ví dụ `BASE_PATH=/remote`); giọng: ngắn, trực tiếp, xưng "bạn", tiếng Việt có dấu |
| Nơi deploy | Máy local của người dùng: user service (systemd `--user` / launchd), nghe `127.0.0.1:8099`, ra ngoài qua reverse proxy/Cloudflare Tunnel do người dùng tự dựng. Không PaaS |

## 8. Nguồn

- `intake/PRD.md`, `intake/ARCHITECTURE.md`, `intake/TECHSTACK.md`, `intake/ROADMAP.md` (render nhận 2026-11-21)
- `intake/loops/l1/_PROPOSAL.md` — kế hoạch vòng 1
- Bảng truy vết đầy đủ: `context/INTERVIEW.md`; chốt của Authority ở pha V: `context/DECISIONS.md` ngày 2026-11-21

---

## 9. Change log

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-21 | Tạo từ template VIPER | — |
| 2026-11-21 | Dịch intake, AC vòng 1 (15 AC) | Pha V vòng 1, đường intake |
| 2026-11-21 | Gộp 6 vòng → vòng 1 có 35 AC, đủ 30 capability | Authority chốt ở pha V |
| 2026-11-21 | Thêm AC-36, AC-37 (làm việc với file kiểu developer) → 37 AC | Phản hồi prototype lượt 3 |
| 2026-11-21 | Thêm AC-38..AC-49 (chuông, cấu hình riêng phiên, xếp hàng, tóm tắt lượt, chế độ gọn, mất kết nối, thiết bị, quản trị nhóm, nhật ký, quên mật khẩu, deep link, phím tắt) → 49 AC; gộp vào AC cũ: máy an toàn (AC-5/6), F1–F12 + bộ chọn phiên mobile (AC-11/12), Files tiện tay (AC-16/17), Git tiện tay (AC-18/19), context `a/b` (AC-22), hạn mức chip 5 giờ (AC-25), xác nhận cập nhật (AC-31), member chỉ thấy phiên mình mọi nơi (AC-33); bỏ dự án = xoá cho cả nhóm (AC-8); §7 đồng bộ 17 bảng + mất kết nối khoá thao tác ghi | Prototype lượt 4–7 + rà soát reviewer; DECISIONS 2026-11-21 D1–D17 |
