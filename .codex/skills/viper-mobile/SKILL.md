---
name: viper-mobile
description: >
  Điều khiển app mobile thật trên iOS Simulator / Android Emulator để dùng thử sản phẩm VIPER — mở app, chạm,
  gõ, vuốt, xoay màn hình, chụp màn hình, đọc cây accessibility và crash log. Chạy bằng mobile-mcp
  (@mobilenext/mobile-mcp), khai sẵn trong template nên không phụ thuộc công cụ ngoài. Nạp skill này khi
  /viper-dogfood chạm một experience thuộc srcroot/mobile-experiences/, khi cần kiểm một luồng chạm được thật
  trên app native hay không, hoặc khi đóng vai người dùng thử (viper-user-*) trên mobile. Gồm: cách gọi,
  24 tool có sẵn, ràng buộc thiết-bị-dùng-chung (các vai chạy TUẦN TỰ), công thức cho từng vai dogfood,
  cách chứng minh mình đã dùng thật, và cách quay video demo cuối vòng ở pha R (screen recording). Web
  experience thì dùng viper-browse, không dùng skill này.
---

# viper-mobile — dùng thử app mobile thật trên simulator/emulator

> Luật #8 nói **không báo xong khi chưa tự dùng**. Với experience mobile, "dùng" nghĩa là mở app thật
> trên thiết bị (giả lập), chạm, nhìn màn hình. Đọc code React Native/Flutter rồi suy ra "chắc chạy được"
> **không tính** — y như web không được đọc code thay cho bấm.

## 1. Chạy bằng gì

mobile-mcp (`@mobilenext/mobile-mcp`) — điều khiển iOS Simulator, Android Emulator và cả thiết bị thật
qua **cây accessibility** (nhanh, rẻ, không cần vision model), chỉ rơi về screenshot + toạ độ khi cần.
Một API cho cả hai nền tảng. Template khai sẵn ở hai nơi, cùng khuôn với trình duyệt:

| Nơi khai | Dùng cho | Tên server |
|---|---|---|
| `.codex/config.toml` ở gốc repo | Phiên chính (meta tự tay dùng) | `mobile` |
| Kế thừa từ phiên chính | 3 khe dogfood `viper-user-k` | `mobile` — cùng server với phiên chính, vì thiết bị vốn chỉ có một |

**Khác biệt SỐNG CÒN so với viper-browse: không có `--isolated`.** Trình duyệt mỗi vai một cái được;
simulator/emulator là **một thiết bị dùng chung** — hai vai cùng chạm vào một màn hình là giẫm nhau
theo nghĩa đen. Vì vậy với experience mobile, các vai trong một đợt dogfood chạy **tuần tự**, không
song song (vẫn chia đợt theo `DOGFOOD-PLAN.md`, vẫn seed lại giữa đợt — xem `/viper-dogfood`).

**Điều kiện trước khi gọi tool** (web chỉ cần URL; mobile cần thiết bị + app đã cài):

1. **Đúng MỘT thiết bị đang bật** — iOS: `xcrun simctl list devices booted` · Android: `adb devices`.
   Nhiều thiết bị cùng bật thì server không biết chọn cái nào; tắt bớt trước.
2. **App đã build + cài lên thiết bị đó** — đây là việc của `make dev` target mobile
   (boot simulator/emulator + cài bản dev, ghi trong stack skill hoặc `custom (intake)`).
   Chưa cài thì `mobile_list_apps` không thấy app, và đó cũng là một phát hiện: `make dev` chưa tròn hợp đồng.
3. Ghi lại **bundle id / package name** của app (iOS: `vn.example.app` · Android: `com.example.app`) —
   tool `mobile_launch_app` nhận đúng chuỗi này, lấy từ `context/TECHSTACK.md` target mobile.

Không cần cài mobile-mcp trước — `npm exec` tải lần đầu. Nhưng simulator/emulator thì phải có sẵn:
iOS cần Xcode (macOS), Android cần Android SDK + platform-tools.

## 2. Bốn tool dùng nhiều nhất

| Tool | Việc |
|---|---|
| `mobile_launch_app` | Mở app theo bundle id. **Luôn vào từ màn đầu** — kill app (`mobile_terminate_app`) rồi mở lại, đừng tiếp tục từ trạng thái dở của vai trước |
| `mobile_list_elements_on_screen` | Đọc màn hình dạng cây accessibility — toạ độ, nhãn, thuộc tính từng phần tử. Đây là "nhìn màn hình", gọi sau mỗi thao tác |
| `mobile_click_on_screen_at_coordinates` · `mobile_type_keys` · `mobile_swipe_on_screen` | Chạm, gõ, vuốt |
| `mobile_take_screenshot` | Bằng chứng cho báo cáo, và là cách duy nhất bắt lỗi thị giác (accessibility tree không có màu) |

**`mobile_list_elements_on_screen` hơn `mobile_take_screenshot` khi cần biết màn có gì** — nó trả text
đọc được kèm toạ độ để chạm, không phải ảnh phải đoán. Nhưng nó **không mang màu sắc/phong cách** —
soi hình thức thì bắt buộc screenshot (xem vai picky ở §3).

Còn lại: `mobile_list_available_devices` · `mobile_get_screen_size` · `mobile_get_orientation` ·
`mobile_set_orientation` · `mobile_list_apps` · `mobile_terminate_app` · `mobile_install_app` ·
`mobile_uninstall_app` · `mobile_save_screenshot` · `mobile_double_tap_on_screen` ·
`mobile_long_press_on_screen_at_coordinates` · `mobile_start_screen_recording` ·
`mobile_stop_screen_recording` · `mobile_press_button` (HOME, BACK, VOLUME…) · `mobile_open_url`
(deep link) · `mobile_list_crashes` · `mobile_get_crash`.

## 3. Công thức cho từng vai dogfood

### Màn hình nhỏ (thẻ `mobile`)
Trên native, "màn hình nhỏ" nghĩa là **thiết bị nhỏ + xoay + bàn phím**:
- Boot đúng thiết bị nhỏ trong dải hỗ trợ (iPhone SE / Pixel nhỏ), không phải máy to nhất cho dễ nhìn.
- `mobile_set_orientation landscape` giữa chừng một form — layout có vỡ, dữ liệu đang gõ có mất không.
- Chạm vào ô nhập **cuối màn hình** — bàn phím ảo hiện lên có che mất nút gửi không, màn có tự cuộn không.
- `mobile_swipe_on_screen` tới cuối danh sách dài — có bị cắt, có cuộn được không.

### Trạng thái biên (thẻ `edge`)
- **Rỗng**: mở app trên DB sạch (đợt 1) — màn đầu hiện gì.
- **Gián đoạn**: `mobile_press_button HOME` giữa luồng rồi mở lại — còn đứng đúng chỗ không;
  `mobile_terminate_app` giữa form rồi `mobile_launch_app` lại — dữ liệu dở dang ra sao.
- **API lỗi / mất mạng**: dừng server dev backend (hoặc Android: `adb shell svc wifi disable` +
  `svc data disable` qua Bash) rồi thao tác tiếp — app hiện khuôn lỗi hay treo/crash.
  iOS Simulator dùng mạng của máy host, không tắt riêng được — dùng cách dừng backend.
- Kết mỗi kịch bản: `mobile_list_crashes` — gián đoạn mà sinh crash report là phát hiện **nặng**.

### Người vội (thẻ `rushed`)
- `mobile_double_tap_on_screen` vào nút gửi — bản ghi có nhân đôi không.
- HOME → mở app khác → quay lại giữa chừng; kill app giữa luồng rồi vào lại.
- `mobile_open_url` deep link nhảy thẳng vào màn giữa luồng — app có gãy khi thiếu ngữ cảnh không.

### Người phá (thẻ `breaker`)
- `mobile_type_keys` chuỗi 10.000 ký tự, emoji, `<script>alert(1)</script>`, `'; DROP TABLE x;--`, số âm.
- Phép thử phân quyền A↛B: **tuần tự trên một thiết bị** (không có hai profile song song như web) —
  đăng nhập A tạo bản ghi, đăng xuất, đăng nhập B, thử mở bản ghi của A qua deep link/danh sách.
- `mobile_open_url` deep link tới màn của vai bị cấm — chặn ở server hay chỉ giấu nút.
- Sau mỗi đòn: `mobile_list_elements_on_screen` xem hiển thị, `mobile_list_crashes` xem có crash.

### Người mới (thẻ `newbie`)
Không tool đặc biệt. `mobile_launch_app` rồi `mobile_list_elements_on_screen` — và **đọc như người
chưa biết gì**, đừng dùng kiến thức về code để đoán màn kế tiếp. Mất vai là mất giá trị lượt thử.

### Khó tính về hình thức (thẻ `picky`)
Native **không có `getComputedStyle`** — luật "đo, đừng nhìn" đổi thước đo, không đổi tinh thần:
- **Kích thước & vị trí**: lấy frame từ `mobile_list_elements_on_screen` — nút dưới 44×44 điểm,
  phần tử lệch lưới nhịp đã chốt ở `DESIGN-SYSTEM.md §2.3`, đều là số đo được, trích thẳng vào báo cáo.
- **Màu & chữ**: bắt buộc qua `mobile_take_screenshot` từng màn, đối chiếu **bằng mắt có kỷ luật** với
  lát token: nêu đích danh *phần tử + màn + khác gì bảng token* ("nút chính S3 nền xanh nhạt hơn
  `--color-primary`, ảnh kèm"). Ảnh chụp là bằng chứng thay cho con số computed style.
- **Trạng thái component §4 + ba khuôn §5**: ép hiện thật — chạm nút gửi rồi chụp ngay để bắt "đang gửi",
  dừng backend để bắt khuôn lỗi, DB sạch cho khuôn rỗng.
- Báo cáo không kèm được **frame/toạ độ hoặc screenshot** nào thì chưa tính là đã soi — tương đương
  luật "không có computed style thì không tính" ở web.

## 4. Chứng minh đã dùng thật

Mọi phát hiện phải nêu được **thao tác cụ thể** và **thứ thấy trên màn hình**. Bốn thứ này là bằng chứng:

```
mobile_list_elements_on_screen  → trích đúng nhãn/phần tử + toạ độ đã thấy
mobile_take_screenshot          → ảnh chỗ hỏng
mobile_list_crashes             → crash report kèm mã, mobile_get_crash lấy nguyên văn
mobile_start/stop_screen_recording → video cho luồng khó tả bằng lời (đừng commit file video; video demo cuối vòng xem §7)
```

Báo "không thấy vấn đề gì" mà không kèm được thao tác đã làm thì gần như chắc chắn là chưa dùng —
xem `/viper-dogfood §Dấu hiệu dogfood giả`.

## 5. Ranh giới

- Chỉ thao tác trên **app của dự án này** trong simulator/emulator. Không đụng app khác trên thiết bị.
- Không sửa file dự án. Ba khe `viper-user-*` đã bị chặn `Write`/`Edit` — phát hiện thì **báo**.
- **Các vai chạy TUẦN TỰ trên experience mobile** — thiết bị là tài nguyên dùng chung, không có
  chuyện 3 vai song song như trình duyệt. Vẫn chia đợt + seed lại giữa đợt theo `DOGFOOD-PLAN.md`.
- Web experience (`srcroot/web-experiences/`) → skill `viper-browse`, không dùng skill này.
- Smoke test tất định cho mobile (`make test`) là chuyện của stack — nếu cần công cụ, cân nhắc
  Maestro (flow YAML, chạy native/RN/Flutter); ngoài phạm vi skill này.

## 6. Hỏng thì xem đây

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Server MCP không lên | `npx` trong PATH là gói standalone đời cũ — template dùng `npm exec` chính vì vậy |
| Không thấy thiết bị nào | Chưa boot: iOS `xcrun simctl boot "<tên máy>"` (cần Xcode) · Android mở AVD từ Android Studio hoặc `emulator -avd <tên>`; kiểm bằng `xcrun simctl list devices booted` / `adb devices` |
| Thấy nhiều thiết bị, tool chọn sai | Tắt bớt, chỉ để đúng một thiết bị bật khi dogfood |
| `mobile_launch_app` không thấy app | App chưa cài lên thiết bị — chạy `make dev` của target mobile trước; bundle id sai thì tra `mobile_list_apps` |
| Android không kết nối | `adb` không có trong PATH — cài Android platform-tools, hoặc `ANDROID_HOME` chưa đặt |
| Chạm không ăn | Toạ độ lấy từ snapshot cũ — màn đã đổi; gọi lại `mobile_list_elements_on_screen` ngay trước khi chạm |

## 7. Quay video demo cuối vòng (pha R)

Luật ở `VIPER.md §1.5`, quy trình ở `/viper-repeat` Bước 2 — đây chỉ là phần công cụ. Meta quay ở
**phiên chính**, một experience một tệp, trên app cài từ đúng commit sẽ đóng vòng.

| Tool | Việc |
|---|---|
| `mobile_start_screen_recording` | `device` (từ `mobile_list_available_devices`) · `output` = đường dẫn **tuyệt đối** tới `demos/vong-<N>/<experience>.mp4` (bắt buộc đuôi `.mp4`; bỏ trống thì tệp rơi vào thư mục tạm) · `timeLimit` đủ dài cho cả kịch bản |
| `mobile_stop_screen_recording` | Dừng, trả đường dẫn + dung lượng + thời lượng — chép vào dòng `Tệp` của `context/DEMOS.md` |

Thứ tự: `mobile_terminate_app` → `mobile_launch_app` (mở từ đầu, trạng thái sạch) →
`mobile_start_screen_recording` → mỗi bước: thao tác thật → `mobile_list_elements_on_screen` xác nhận đúng
"Thấy gì" → `mobile_stop_screen_recording`. Mobile **không có thẻ chương** như trình duyệt: bảng bước trong
sổ là chỗ người xem đối chiếu bước nào ứng với AC nào — ghi thời điểm (`0:42`) ở cột "Làm gì" nếu kịch bản dài.

Thiết bị dùng chung: đừng quay khi một khe dogfood còn đang chạy trên cùng thiết bị. Video **không commit**
(`demos/**/*.mp4` ở `.gitignore`).
