---
name: viper-roles
description: >
  Danh mục 14 vai dogfood của VIPER (smoke hồi quy · newbie · edge · picky · a11y · locale · mobile ·
  power · rushed · breaker · concurrent · money · operator · integrator), tín hiệu bật từng vai, luật chia
  đợt, và cách lập context/DOGFOOD-PLAN.md. Nạp skill này ở pha V của MỌI vòng khi lập kế hoạch dogfood,
  khi chạy /viper-dogfood, hoặc khi là khe viper-user-k nhận một thẻ vai. Không vai nào bật mặc định —
  trừ smoke hồi quy, luôn bật.
---

# viper-roles — danh mục vai dogfood + cách chọn vai cho từng vòng

> Luật #8: không báo xong khi chưa tự dùng. Skill này trả lời **dùng bằng con mắt nào**. Sáu vai cố định
> của bản cũ bỏ sót đúng những chỗ hay hỏng nhất của phần mềm thật (tiền, hai người cùng lúc, quản trị,
> tích hợp, trợ năng, ngày giờ) — và bắt dự án không có mobile vẫn chạy vai mobile. Giờ vai **chọn theo
> dự án và theo vòng**, ghi trong `context/DOGFOOD-PLAN.md`.

## 1. Danh mục

Mỗi vai là một **thẻ** ở `.claude/skills/viper-roles/roles/<vai>.md`: tín hiệu bật · tài khoản · đợt gợi ý · kịch bản · khuôn báo cáo.

| Vai | Đi tìm | Bật khi (tóm tắt — đủ ở thẻ) | Đợt |
|---|---|---|---|
| `smoke` | Luồng lõi + mọi AC đã giao (vòng này + các vòng trước) còn chạy | **LUÔN BẬT** | 0 |
| `newbie` | Người mới tự hiểu phải làm gì | Có UI người dùng cuối + vòng có luồng/màn người mới chạm | 1 |
| `edge` | Rỗng · lỗi · chậm · mất mạng · nhiều dữ liệu | Có UI đọc dữ liệu từ server | 1 |
| `picky` | Giao diện thật lệch design system đã chốt | Có DESIGN-SYSTEM + vòng có màn mới/đổi giao diện | 1 |
| `a11y` | Chỉ bàn phím · trình đọc màn hình · phóng to 200% | Yêu cầu trợ năng · đại chúng/khu vực công · persona nhìn kém, lớn tuổi | 1 |
| `locale` | Dấu tiếng Việt · ngày giờ/múi giờ · tiền/số · tìm/sắp xếp | Có ngày giờ nghiệp vụ, tiền, nhiều ngôn ngữ/múi giờ, tìm theo tên | 1–2 |
| `mobile` | Màn nhỏ, chạm, bàn phím ảo; app native | Persona dùng điện thoại · đòi responsive · **có mobile experience (bắt buộc bật)** | 2 |
| `power` | Việc lặp lại hằng ngày tốn bao nhiêu bước; danh sách dài | Persona dùng hằng ngày · màn quản lý nhiều bản ghi | 2 |
| `rushed` | Bấm hai lần · quay lại · bỏ giữa chừng · nhiều tab | Có form ghi / luồng nhiều bước | 2 |
| `breaker` | Nhập bậy · vượt quyền theo ma trận · injection | Có ô nhập hoặc ≥2 vai (gần như mọi dự án có đăng nhập) | 2 (cuối) |
| `concurrent` | Hai người tranh một tài nguyên · ghi đè im lặng | Đặt chỗ/tồn kho/khung giờ · nhiều người sửa chung · thời gian thực | 2 |
| `money` | Từng đồng · trừ hai lần · server tin giá client | Có thu tiền, giá, giảm giá, số dư, hoàn tiền | 2 |
| `operator` | Hỗ trợ khách không cần kỹ sư · lịch sử · vượt quyền nội bộ | Có persona/experience quản trị, vận hành, CSKH | 2 (cuối) |
| `integrator` | API ngoài · webhook · import/export · email/SMS · bên thứ ba lỗi | Có API công khai, webhook, file, thông báo, tích hợp | 2 |

Sản phẩm **không có UI** (marker `KHÔNG CÓ UI`): `picky` · `mobile` · `a11y` luôn tắt; `smoke` chạy bằng `curl`
trên API thật; `breaker` · `integrator` · `concurrent` · `money` vẫn chạy được qua HTTP.

## 2. Lập kế hoạch dogfood — pha V, mỗi vòng

`context/DOGFOOD-PLAN.md` viết lại mỗi vòng (bản cũ nằm ở `context/archive/vong-N/`). Trình tự:

1. **Quét tín hiệu** trong `PRD.md` (§3 AC, §7 quyết định: đăng nhập, thu tiền…), `PERSONAS.md` (thiết bị chính,
   tần suất dùng, có vai quản trị không, ma trận §2), `ARCHITECTURE.md` (§3 mobile, §5 contract, §6 ca biên,
   §9 dịch vụ ngoài), `DESIGN-SYSTEM.md`, và **phạm vi của vòng này** (`intake/loops/l<N>/` hoặc tài liệu vòng).
2. **§1 — mọi vai trong danh mục một dòng**: `bật` hoặc `tắt` + **căn cứ** trỏ đúng file và mục
   (`PERSONAS §1 — thiết bị chính điện thoại`, `PRD §7 — không thu tiền`). Tắt cũng phải có căn cứ — để
   thấy là đã cân nhắc, không phải quên. Vai vào **đúng vòng có tín hiệu**: vòng đưa thanh toán vào mới
   bật `money`, vòng chưa có màn mới thì `picky` có thể tắt.
3. **§2 — mỗi vai bật một dòng**: đợt · persona · tài khoản · nơi thử · **việc phải làm vòng này** (AC, luồng,
   màn cụ thể — không chép lại thẻ vai, chỉ nói vòng này soi chỗ nào).
4. **§3 — danh sách smoke hồi quy**: luồng lõi (`ARCHITECTURE.md §7`) + **mọi AC đã giao** ở các vòng trước
   (`context/archive/vong-*/PRD.md §3`) + AC vòng này. Mỗi dòng 2–4 bước kiểm được PASS/FAIL.
5. Seed tài khoản cho mọi vai bật (`deployment/local/README.md`).

Ngắn: cả file **một trang**. Authority đọc §1–§2 để biết vòng này được thử bằng con mắt nào.

## 3. Luật chia đợt

Server dev và DB **dùng chung** giữa các vai; trình duyệt và tài khoản thì riêng. Nên:

| Luật | Vì sao |
|---|---|
| **Đợt 0 = `smoke` một mình, chạy đầu tiên** | Luồng lõi gãy thì mọi vai khác chỉ báo lại đúng cái gãy đó — sửa trước rồi mới thả đợt sau |
| **Tối đa 3 vai một đợt** (= 3 khe `viper-user-1..3`) | Ba trình duyệt riêng; nhiều hơn là giành khe |
| Vai cần **cảnh sạch** (`edge` tài khoản trống, `newbie`, `picky`, `a11y`) đi trước | Trạng thái rỗng chết ngay khi có bản ghi đầu tiên |
| Vai **ghi dữ liệu chung** (`breaker`, `operator`, `concurrent`) đi sau, không chung đợt với vai đang đọc đúng dữ liệu đó | Dữ liệu rác của vai này là cảnh hỏng của vai kia |
| **Seed lại** giữa hai đợt nếu đợt trước ghi dữ liệu chung | Mỗi đợt bắt đầu từ mốc dữ liệu biết trước |
| Experience mobile native: các vai trong đợt chạy **tuần tự** | Simulator/emulator là một thiết bị dùng chung (`viper-mobile §1`) |
| Sửa phát hiện xong → **`smoke` chạy lại lần cuối** | Sửa là chỗ dễ làm gãy thứ đang chạy nhất |

## 4. Khe chạy thẻ như thế nào

Ba khe `viper-user-1` · `-2` · `-3`, mỗi khe **một trình duyệt riêng** (`pw-slot-1..3` ở `.agents/mcp_config.json`,
`--isolated`). Khe chặn trình duyệt của phiên chính và của hai khe kia bằng `disallowedTools`. Một khe được
**dùng lại** qua nhiều đợt, nên việc đầu tiên của khe là `browser_close` — trình duyệt mở lại trắng, không còn
cookie, localStorage, tab của vai trước.

Phiên chính giao cho mỗi khe: tên vai (khe đọc `.claude/skills/viper-roles/roles/<vai>.md`) · tài khoản riêng · persona · việc phải làm
(dòng §2) · tài liệu thẻ đòi (ma trận cho `breaker`, lát token cho `picky`, bảng §3 cho `smoke`).

## 5. Vai ngoài danh mục

Ngành có góc nhìn riêng (bác sĩ đọc kết quả xét nghiệm, tài xế dùng một tay khi dừng đèn đỏ…) → chép
một thẻ gần nhất thành `.claude/skills/viper-roles/roles/<vai-mới>.md`, sửa bảng đầu thẻ + kịch bản, thêm một dòng vào bảng §1
của `DOGFOOD-PLAN.md`. Không phải sửa agent hay `.agents/mcp_config.json` — khe chạy được mọi thẻ.
