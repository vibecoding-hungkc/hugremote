---
description: Tự dùng sản phẩm + chạy kế hoạch dogfood của vòng (context/DOGFOOD-PLAN.md) — smoke hồi quy đi đầu, các vai bật theo dự án chạy trên 3 khe trình duyệt riêng, tối đa 3 vai một đợt — bắt buộc trước khi báo xong
---

# /viper-dogfood — "You eat your own shit"

> **LUẬT #8.** Không báo xong khi chưa tự dùng. Bắt buộc cuối pha I (ở local) và cuối pha P (trên production).
> Không hỏi Authority trong suốt lệnh này — phát hiện thì xử hoặc ghi lại.

Đọc code rồi suy ra "chắc chạy được" không tính. Phải mở ra bấm. **Chạy cái gì, bằng vai nào** đã quyết ở pha V
trong `context/DOGFOOD-PLAN.md` — lệnh này **chạy đúng kế hoạch đó**, không tự chọn lại vai.

## Bước 1 — Chuẩn bị

```bash
make dev        # đảm bảo đang chạy
python3 scripts/gate.py V   # mục DOGFOOD-PLAN phải xanh — kế hoạch đúng của vòng này
```

Lấy URL đang chạy (mặc định `http://localhost:3000` hoặc `:8000`). Ở pha P thì dùng URL production.

**Experience mobile** (`srcroot/mobile-experiences/`, đối chiếu `ARCHITECTURE.md §3`): "URL" của nó là **bundle id / package name** (từ `context/TECHSTACK.md` target mobile), và `make dev` phải đã boot đúng **một** simulator/emulator + cài app lên đó — kiểm bằng `mobile_list_apps` trước khi bắt đầu. Công cụ là skill `viper-mobile` thay cho trình duyệt.

Đọc:
- `context/DOGFOOD-PLAN.md` — §1 vai bật, §2 việc từng vai + đợt + tài khoản, §3 danh sách smoke hồi quy
- `context/PRD.md §3` (AC) và `context/ARCHITECTURE.md §7` (luồng lõi) — thứ phải đi hết
- `context/PERSONAS.md` — chân dung (§1) và ma trận vai × hành động (§2, cho `breaker`)
- `context/PROTOTYPE.md` — bản đồ màn hình Authority đã chốt (bỏ qua nếu có marker `KHÔNG CÓ UI`)
- `context/DESIGN-SYSTEM.md` — §2 token · §4 trạng thái bắt buộc · §5 khuôn rỗng/lỗi/đang tải (nếu có UI). Nhiều design system → cột `Design system` ở `ARCHITECTURE.md §2–§3`; vai `picky` cần lát token đúng gói

**Dữ liệu + tài khoản riêng cho từng vai bật** — seed phải có sẵn (`deployment/local/README.md`): mỗi vai một tài khoản đúng như cột `Tài khoản` của `DOGFOOD-PLAN.md §2`, đuôi `@dogfood.local`; `edge@` để **trống**; `smoke@` mang dữ liệu của các vòng trước. Seed chưa có tài khoản vai → thêm vào seed trước khi spawn, đừng cho các vai dùng chung một tài khoản. Không có dữ liệu thì không dùng thử được, mà cũng là một phát hiện: người dùng mới vào cũng gặp cảnh y hệt.

## Bước 2 — Meta tự tay dùng

**Đích thân, trước khi giao cho ai.** Mở trình duyệt bằng skill `viper-browse` (server `browser` của phiên chính) — experience mobile thì mở app bằng skill `viper-mobile` — đóng vai **persona chính** (`PERSONAS.md §1`), đi hết luồng lõi như persona đó:

- Vào từ trang đầu, không nhảy thẳng vào URL trong
- Đi hết luồng ở `ARCHITECTURE.md §7` từ đầu đến cuối
- Kiểm từng AC trong `PRD.md §3` — làm được thật không, hay chỉ "về lý thuyết là được"
- Đối chiếu từng màn với `PROTOTYPE.md §1`: thông tin bắt buộc có đủ và đúng thứ tự ưu tiên không — **lệch bản Authority đã chốt là phát hiện**, không phải chuyện thẩm mỹ
- Soi hình thức theo `DESIGN-SYSTEM.md`: nút đang gửi có khoá lại không, lỗi có theo khuôn §5 không, có màu/kiểu lạc loài ngoài token không — đây là lượt nhìn nhanh của meta; vai `picky` (nếu bật) mới là lượt **đo** bằng computed style

Ghi lại mọi thứ vướng, kể cả thứ nhỏ: chữ khó hiểu, nút không rõ bấm để làm gì, chờ mà không biết có đang chạy không, quay lại thì mất dữ liệu đang nhập.

## Bước 3 — Chạy kế hoạch: smoke trước, rồi từng đợt

> **Ba lớp tách, thiếu lớp nào là các vai đè dữ liệu của nhau:**
>
> | Lớp | Tách bằng | Thiếu thì sao |
> |---|---|---|
> | Trình duyệt | 3 khe `viper-user-1..3`, mỗi khe một server Playwright riêng `pw-slot-k` ở `.mcp.json` (`--isolated`) · khe chặn `browser` của phiên chính và hai khe kia bằng `disallowedTools` · khe gọi `browser_close` đầu lượt — khe được dùng lại qua nhiều vai | Các vai chung tab, cookie, localStorage: vai này đăng nhập là đá phiên của vai kia, điều hướng là huỷ trang vai kia đang xem; dùng lại khe mà không đóng thì vai sau đọc được localStorage của vai trước (đã thử thật) |
> | Tài khoản | Mỗi vai một tài khoản seed sẵn `<vai>@dogfood.local` | Ba vai ghi vào cùng một tài khoản: bản ghi trùng của `rushed` hiện ra trong danh sách `newbie` đang đọc |
> | Dữ liệu chung | **Đợt**: tối đa 3 vai một đợt, seed lại giữa đợt | Dữ liệu dùng chung (danh mục, cấu hình, trạng thái rỗng của cả hệ) bị vai ghi/phá làm bẩn trước khi vai đọc kịp nhìn |
>
> Bản 1.9 đầu khai trình duyệt **inline** trong frontmatter agent — Claude Code bỏ qua im lặng (dạng map;
> từ 2.1.238 còn bỏ qua khi thư mục chưa trust), cả 6 vai rơi về trình duyệt của phiên chính. Server ở
> `.mcp.json` thì phiên nào nạp được `browser` cũng nạp được. **Sửa `.mcp.json` phải mở lại phiên.**

**Đợt 0 — `smoke` một mình, ĐẦU TIÊN.** Giao cho khe `viper-user-1` thẻ `smoke` + toàn bộ bảng `DOGFOOD-PLAN.md §3`. Smoke có `FAIL` ở luồng lõi hoặc AC vòng trước → **sửa trước** (Bước 4, dòng đầu), chạy lại smoke tới khi xanh, rồi mới mở đợt 1. Thả các vai khác lên một bản gãy luồng lõi là phí cả mấy đợt để nghe cùng một tin.

**Đợt 1, 2, … — theo cột `Đợt` của §2.** Mỗi đợt gửi **trong một lượt** (song song), mỗi vai một khe `viper-user-1` · `viper-user-2` · `viper-user-3`. Ba ràng buộc cứng: tối đa **3 vai một đợt** · **không mở đợt sau khi đợt trước chưa xong** · **seed lại** (`deployment/local/`) giữa hai đợt nếu đợt trước ghi dữ liệu chung. Muốn đổi vai sang đợt khác thì sửa `DOGFOOD-PLAN.md §2`, đừng sửa trong đầu. Experience mobile native: các vai trong một đợt chạy **tuần tự** — simulator/emulator là một thiết bị dùng chung (`viper-mobile §1`).

Mỗi khe nhận trong prompt:
0. **Tên vai** (khe đọc thẻ `.claude/skills/viper-roles/roles/<vai>.md`) + **tài khoản riêng của vai đó** (email + mật khẩu seed) — không bao giờ đưa cùng một tài khoản cho hai vai
1. URL + tóm tắt sản phẩm làm gì (experience mobile: **bundle id + tên thiết bị đang boot**, và ghi rõ "dùng skill `viper-mobile`"; không có UI: base URL của API)
2. **Persona** (chép từ `PERSONAS.md §1`) + **việc vòng này** — đúng dòng của vai đó ở `DOGFOOD-PLAN.md §2`
3. Luồng lõi từ `ARCHITECTURE.md §7` + AC liên quan + các màn liên quan ở `PROTOTYPE.md §1` (nếu có UI)
4. Thứ thẻ vai đòi thêm: `smoke` → bảng §3 · `breaker` → ma trận `PERSONAS.md §2` + tài khoản từng role · `picky` → **đúng một experience** + lát token của gói experience đó (`DESIGN-SYSTEM.md §2` lọc theo `ARCHITECTURE.md §2–§3`) + trạng thái §4 + khuôn §5 · `operator` → 2–3 tình huống hỗ trợ · `concurrent` → hai tài khoản + tài nguyên tranh chấp

**Chế độ intake, đa target**: vai có cột "Nơi thử" là experience nào thì chạy trên experience đó; luồng đi **xuyên nhiều target** (hành động ở A phải hiện ra ở B) là chỗ dễ gãy nhất — `smoke` §3 phải có dòng cho nó.

**Sau khi sửa xong mọi phát hiện (Bước 4) — `smoke` chạy lại lần cuối.** Sửa phát hiện là chỗ dễ làm gãy thứ đang chạy nhất. Smoke lượt cuối xanh mới được kết luận.

**Ghi `DOGFOOD-PLAN.md §4`** — mỗi lượt của mỗi vai một dòng: ngày · vai · nơi (`local` | `production`) · trình duyệt (đúng như dòng đầu báo cáo của khe) · số phát hiện nặng/vừa/nhẹ. `gate.py I` đòi đủ mọi vai bật + `smoke` 2 lượt; `gate.py P2` đòi `smoke` trên production.

## Bước 4 — Xử phát hiện

Gộp phát hiện của mình + mọi vai, phân loại:

| Loại | Xử |
|---|---|
| `smoke` FAIL — luồng lõi gãy, AC vòng trước không còn chạy (hồi quy) | **Sửa ngay, trước mọi thứ khác** |
| Hỏng luồng lõi, mất dữ liệu, lỗ hổng phân quyền, sai tiền, đặt vượt số lượng | **Sửa ngay**, không hoãn |
| **Trộn design system** — experience dùng token của gói khác | **Sửa ngay**, ngang lỗ phân quyền: mỗi gói là một hợp đồng hình thức riêng, mượn token gói khác là phá cả hai |
| Lệch `DESIGN-SYSTEM.md`: màu/chữ/nhịp ngoài lát token · thiếu trạng thái bắt buộc §4 · sai khuôn §5 | Sửa về token đã chốt; cố ý giữ khác → 1 dòng `DECISIONS.md`; đổi chính token → 1 dòng `DESIGN-SYSTEM.md §7` |
| Lệch `PROTOTYPE.md` đã chốt | Sửa theo prototype; cố tình giữ khác → 1 dòng `DECISIONS.md` |
| Nhỏ, sửa dưới 15 phút | Sửa ngay |
| Cần nhiều thời gian nhưng trong scope | `STATE.md §Phát hiện từ dogfood chưa xử` |
| Ngoài scope đã khoá | `ROADMAP.md` backlog |

Sửa xong chạy lại `make check`, **dùng lại** phần vừa sửa, rồi `smoke` lượt cuối (Bước 3).

## Bước 5 — Kết luận

Báo cho Authority theo dạng này:

```
Đã dùng thử ở <local|production>, đóng vai <persona>, <n> vai theo DOGFOOD-PLAN vòng <N> (<m> đợt)

Smoke hồi quy: lượt đầu <x>/<y> PASS · lượt cuối <x>/<y> PASS
Luồng lõi:     đi hết được / gãy ở bước <n>
AC:            <x>/<y> làm được thật
Phân quyền:    <x>/<y> ô ✗ trong ma trận đã thử, chặn đúng hết / thủng ở <đâu>   (n/a nếu breaker tắt)
Prototype:     khớp bản đã chốt / lệch ở <màn nào> (n/a nếu không có UI)
Design system: <x> màu lạ · <y>/<z> cặp tương phản đạt · <a>/<b> component đủ trạng thái   (n/a nếu picky tắt)
               trộn DS: không / <experience> dùng token của gói <ds>
Vai khác:      <vai>: <tóm tắt một dòng> …

Đã sửa ngay:      <danh sách>
Ghi lại chưa xử:  <danh sách + ở đâu>
Đẩy sang Phase 2: <danh sách>
```

## Dấu hiệu dogfood giả

Nếu mọi vai đều báo "không thấy vấn đề gì" ngay lần đầu — **gần như chắc chắn chúng không thực sự dùng**. Sản phẩm mới dựng luôn có chỗ vướng. Kiểm lại xem khe có mở trình duyệt thật không, có bấm thật không, hay chỉ đọc code rồi suy ra. Rồi cho chạy lại với yêu cầu nêu **thao tác cụ thể đã làm** và **thứ nhìn thấy trên màn hình**.

`smoke` báo toàn `PASS` mà không có cột "Thấy gì" nào, hoặc số dòng ít hơn §3 → chưa đi hết danh sách, chạy lại. Vai `picky`: báo "khớp hết" mà **không nêu được một giá trị computed style nào** thì nó đã đọc `DESIGN-SYSTEM.md` rồi suy ra chứ chưa mở trình duyệt — không có số đo thì không tính là đã soi.

**Dùng chung trình duyệt cũng là dogfood giả** — kết quả của mọi vai cùng hỏng, vì vai này thấy cảnh vai kia tạo ra. Dòng đầu báo cáo mỗi khe phải là `Vai: <vai> · Khe: <k> · Trình duyệt: mcp__pw-slot-<k>__ · Tài khoản: <email>`. Khe báo `KHÔNG CÓ TRÌNH DUYỆT RIÊNG`, hoặc ghi `mcp__browser__`, hoặc hai vai cùng một tài khoản → bỏ kết quả lượt đó, sửa (thường là phiên chưa nạp `.mcp.json` mới — mở lại phiên), chạy lại. `gate.py` không tính dòng §4 ghi trình duyệt `mcp__browser__`.

Một dấu hiệu giả nữa: báo cáo không nêu được mình đóng persona nào, hoặc đi một luồng chẳng liên quan gì đến luồng chính của persona — tức là đã thử như "người dùng nói chung", đúng thứ `PERSONAS.md` sinh ra để tránh.

Điều này áp cho cả chính mình ở bước 2.
