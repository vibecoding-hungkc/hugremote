---
name: viper-browse
description: >
  Duyệt web thật để dùng thử sản phẩm VIPER ở localhost hoặc production — mở trang, bấm, gõ, chụp màn hình,
  đọc lỗi console và lời gọi mạng. Chạy bằng Playwright MCP (@playwright/mcp), khai ngay trong template nên
  không phụ thuộc công cụ ngoài. Nạp skill này khi chạy /viper-dogfood, khi cần kiểm một luồng bấm được thật
  hay không, hoặc khi đóng vai người dùng thử (viper-user-*). Gồm: cách gọi, 24 tool có sẵn, công thức cho
  từng vai dogfood (màn hình nhỏ, mạng chậm, gửi hai lần, nhiều tab), cách chứng minh mình đã dùng thật, và
  cách quay video demo cuối vòng ở pha R (browser_start_video, có chương cho từng bước).
---

# viper-browse — duyệt web để dùng thử thật

> Luật #8 nói **không báo xong khi chưa tự dùng**. Skill này là công cụ để "dùng" nghĩa là dùng thật:
> mở trình duyệt, bấm, nhìn màn hình. Đọc code rồi suy ra "chắc chạy được" **không tính**.

## 1. Chạy bằng gì

Playwright MCP (`@playwright/mcp`) — bản chính chủ của Playwright. Mọi server khai ở `.codex/config.toml`:

| Server | Dùng cho | Tool |
|---|---|---|
| `browser` | Phiên chính (meta tự tay dùng) · **quay video demo cuối vòng** ở pha R — bật thêm `--caps=devtools` (§7) | `mcp__browser__browser_*` |
| `pw-slot-1` · `pw-slot-2` · `pw-slot-3` | Mỗi khe dogfood `viper-user-k` **một trình duyệt riêng** — khe chạy thẻ vai nào thì trình duyệt đó là của vai ấy trong lượt đó | `mcp__pw_slot_k__browser_*` |

Mỗi server một tiến trình, `--isolated` (profile trong bộ nhớ) và `--output-dir .playwright-mcp/slot-k` riêng — **ba vai một đợt chạy song song mà không chung tab, cookie, localStorage, phiên đăng nhập hay file snapshot**. Mỗi khe chặn `browser` và hai khe kia bằng hook `guard_agent` (`.viper-kit/agent-policy.json`), nên chỉ thấy đúng server của mình. Khe được dùng lại qua nhiều vai, nên **việc đầu tiên mỗi lượt là `browser_close`** — trình duyệt mở lại trắng (đã thử thật: không đóng thì vai sau đọc được localStorage của vai trước). Chromium chỉ bật khi khe gọi tool đầu tiên. Vai là **thẻ** (skill `viper-roles`), không phải agent — thêm vai không phải thêm server.

Ba bẫy đã gặp thật: (1) khai server **inline** trong frontmatter agent thì Claude Code bỏ qua im lặng khi thư mục chưa được trust (và chỉ nhận dạng danh sách) — cả 6 vai rơi về trình duyệt của phiên chính, vai này đọc được localStorage vai kia ghi; (2) **sửa `.codex/config.toml` phải mở lại phiên** mới nạp server mới; (3) dùng lại khe mà không `browser_close` thì vai sau thừa hưởng phiên của vai trước.

Lưu ý: trình duyệt riêng **không** làm dữ liệu riêng. Server dev và DB vẫn dùng chung — mỗi vai còn phải có **tài khoản riêng** (`<vai>@dogfood.local`), và `/viper-dogfood` chia **đợt, tối đa 3 vai một đợt** cho phần dữ liệu dùng chung của cả hệ.

Không cần cài gì trước. Lần đầu chạy, npm tải gói và Playwright tải Chromium (vài trăm MB, chỉ một lần).

## 2. Bốn tool dùng nhiều nhất

| Tool | Việc |
|---|---|
| `browser_navigate` | Mở URL. **Luôn vào từ trang đầu**, không nhảy thẳng vào URL bên trong |
| `browser_snapshot` | Đọc nội dung trang dạng cây accessibility — đây là "nhìn màn hình". Gọi sau mỗi thao tác |
| `browser_click` · `browser_type` · `browser_fill_form` | Bấm và gõ |
| `browser_take_screenshot` | Bằng chứng cho báo cáo, và là cách bắt lỗi bố cục |

**Hai điều dễ vấp, đã kiểm bằng cách chạy thật:**

1. `browser_click` / `browser_type` nhận **`target`**, không phải `ref`. `target` ăn cả **ref lấy từ snapshot** (`e4`) lẫn **CSS selector** (`#them`, `button[type=submit]`) — selector thường nhanh hơn vì khỏi phải snapshot trước. Trường `element` chỉ là mô tả cho người đọc.
2. `browser_navigate` **không trả nội dung trang trong phản hồi** — nó ghi ra `.playwright-mcp/page-*.yml` (khe dogfood: `.playwright-mcp/slot-k/page-*.yml`) rồi trả đường dẫn. Muốn thấy trang thì `Read` file đó, hoặc gọi thẳng `browser_snapshot` (tool này trả inline). Thư mục `.playwright-mcp/` đã nằm trong `.gitignore`, đừng commit.

Còn lại: `browser_resize` · `browser_press_key` · `browser_navigate_back` · `browser_tabs` · `browser_hover` · `browser_drag` · `browser_drop` · `browser_select_option` · `browser_file_upload` · `browser_handle_dialog` · `browser_wait_for` · `browser_find` · `browser_console_messages` · `browser_network_requests` · `browser_network_request` · `browser_evaluate` · `browser_run_code_unsafe` · `browser_close`.

**`browser_snapshot` hơn `browser_take_screenshot` khi cần biết trang có gì** — nó trả về text đọc được kèm ref để bấm, không phải ảnh phải đoán.

## 3. Công thức cho từng vai dogfood

### Màn hình nhỏ (thẻ `mobile`)
Frontmatter đã đặt `--viewport-size 390,844`. Đổi cỡ giữa chừng:
```
browser_resize  width=360 height=640     # máy nhỏ
browser_resize  width=844 height=390     # xoay ngang
```

### Mạng chậm / mất mạng / API lỗi (thẻ `edge`)
Dùng `browser_run_code_unsafe` để chạy thẳng Playwright:
```js
// mất mạng
await page.context().setOffline(true);
// chặn một API cụ thể, xem UI hiện gì
await page.route('**/api/**', r => r.abort());
// mạng chậm
const c = await page.context().newCDPSession(page);
await c.send('Network.emulateNetworkConditions',
  { offline:false, latency:400, downloadThroughput:400*1024/8, uploadThroughput:400*1024/8 });
```
Rồi `browser_console_messages` và `browser_network_requests` để xem lỗi thật sự là gì.

### Gửi hai lần, bấm nhanh, nhiều tab (thẻ `rushed`)
```js
// hai lần trong ~50ms — thứ tay người không làm được nhưng mạng lag thì có
await Promise.all([ page.click('#submit'), page.click('#submit') ]);
```
`browser_tabs` mở tab thứ hai cùng một trang · `browser_navigate_back` cho nút quay lại.

### Nhập bậy (thẻ `breaker`)
`browser_type` với chuỗi 10.000 ký tự, emoji, `<script>alert(1)</script>`, `'; DROP TABLE x;--`, số âm.
Sau mỗi lần: `browser_snapshot` xem có hiện ra **như chữ thường** không, `browser_console_messages` xem có lỗi, `browser_network_requests` xem server trả mã gì.

Phép thử phân quyền A↛B: đăng nhập A tạo bản ghi → `browser_navigate` tới URL bản ghi đó khi đang là B → phải bị chặn.

### Người mới (thẻ `newbie`)
Không dùng tool đặc biệt. Chỉ `browser_navigate` vào trang đầu rồi `browser_snapshot` — và **đọc như người chưa biết gì**. Đừng dùng kiến thức về code để đoán ra cách dùng; mất vai là mất giá trị lượt thử.

### Khó tính về hình thức (thẻ `picky`)

Vai này **đo**, không nhìn. `browser_evaluate` gom giá trị thật đang render trên màn:

```js
() => {
  const seen = new Map();                       // "prop|giá trị" → selector đầu tiên gặp
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;         // bỏ phần tử không hiển thị
    const cs = getComputedStyle(el);
    const sel = el.tagName.toLowerCase()
      + (el.id ? '#' + el.id : '')
      + (el.className && typeof el.className === 'string'
         ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    for (const p of ['color', 'background-color', 'border-color', 'font-family',
                     'font-size', 'padding', 'gap', 'border-radius', 'box-shadow']) {
      const v = cs.getPropertyValue(p);
      if (!v || v === 'none' || v === 'rgba(0, 0, 0, 0)' || v === '0px') continue;
      const k = p + '|' + v;
      if (!seen.has(k)) seen.set(k, sel);
    }
  }
  return [...seen].map(([k, sel]) => k + ' @ ' + sel).sort();
}
```

Trả về **tập giá trị thật + selector đầu tiên dùng nó** — đối chiếu thẳng với lát token `DESIGN-SYSTEM.md §2`. Giá trị nào không có trong lát là phát hiện; giá trị thuộc gói design system khác là **trộn design system**, nặng hơn.

Tương phản thì đọc cặp chữ/nền của đúng phần tử đang nghi:

```js
() => {                                          // nền thật: leo lên tới tổ tiên có nền đục
  const el = document.querySelector('.canh-bao');
  let bg = 'rgba(0, 0, 0, 0)', n = el;
  while (n && bg === 'rgba(0, 0, 0, 0)') { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
  return { fg: getComputedStyle(el).color, bg, size: getComputedStyle(el).fontSize };
}
```

Ép hiện trạng thái component: `browser_hover` cho hover · bấm submit rồi `browser_snapshot` ngay để bắt "đang gửi" · `page.route('**/api/**', r => r.abort())` cho khuôn lỗi (§5).

### Ngày giờ, múi giờ, ngôn ngữ (thẻ `locale`)
Đổi múi giờ / ngôn ngữ của trang đang mở bằng CDP, rồi tải lại trang:
```js
const c = await page.context().newCDPSession(page);
await c.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });
await c.send('Emulation.setLocaleOverride', { locale: 'en-US' });
await page.reload();
```
Giá trị thật gửi lên server: `browser_network_requests` → `browser_network_request` xem body.

### Chỉ bàn phím, trình đọc màn hình (thẻ `a11y`)
`browser_press_key` Tab / Shift+Tab / Enter / Space / Escape để đi cả luồng không chuột. Focus đang ở đâu:
```js
() => { const e = document.activeElement;
  return { tag: e.tagName, name: e.getAttribute('aria-label') || e.innerText?.slice(0, 40),
           outline: getComputedStyle(e).outlineStyle }; }
```
Tên/vai trò mà trình đọc màn hình đọc ra = cây trong `browser_snapshot`. Phóng to 200% ≈ `browser_resize` về 640 rộng.

### Hai người cùng lúc (thẻ `concurrent`)
Hai người = **hai context** (không phải hai tab — tab chung cookie). Trong `browser_run_code_unsafe`:
```js
const b = await page.context().browser().newContext();
const p2 = await b.newPage();                         // người B, đăng nhập riêng
await Promise.all([ page.click('#dat'), p2.click('#dat') ]);   // cùng một nhịp
```

## 4. Chứng minh đã dùng thật

Mọi phát hiện phải nêu được **thao tác cụ thể** và **thứ thấy trên màn hình**. Ba thứ này là bằng chứng:

```
browser_snapshot          → trích đúng đoạn text/nhãn đã thấy
browser_take_screenshot   → ảnh chỗ hỏng
browser_console_messages  → lỗi JS kèm nguyên văn
```

Báo "không thấy vấn đề gì" mà không kèm được thao tác đã làm thì gần như chắc chắn là chưa dùng — xem `/viper-dogfood §Dấu hiệu dogfood giả`.

## 5. Ranh giới

- Chỉ thao tác trên **localhost của dự án này** hoặc **URL production của chính nó**. Không đụng trang nào khác.
- Skill này cho **web**. Experience mobile (`srcroot/mobile-experiences/`) là app native thật — dùng skill `viper-mobile` (simulator/emulator), không phải viewport nhỏ của trình duyệt.
- Không sửa file dự án. Ba khe `viper-user-*` đã bị chặn `Write`/`Edit` bằng frontmatter — phát hiện thì **báo**, việc sửa là của phiên chính.
- `browser_run_code_unsafe` chạy code tuỳ ý trong ngữ cảnh trang: dùng cho mô phỏng mạng và nhịp bấm, **không** dùng để đi tắt qua UI rồi kết luận "luồng chạy được". Đi tắt là hết dogfood.

## 6. Hỏng thì xem đây

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Server MCP không lên | `npx` trong PATH là gói standalone đời cũ, không hiểu `-y`. Template dùng `npm exec` chính vì vậy — `npm` chỉ có một bản nên không nhập nhằng |
| Lần đầu chạy rất lâu | Đang tải Chromium. Chạy trước `npx playwright install chromium` cho xong một lần |
| Trang trắng | App chưa chạy. `make dev` trước, và lấy đúng cổng (Next.js 3000 · FastAPI 8000 · Spring 8080) |
| Không thấy tool `browser_*` | Chưa duyệt server MCP cho dự án này. Duyệt một lần khi Claude Code hỏi |

## 7. Quay video demo cuối vòng (pha R)

Luật ở `VIPER.md §1.5`, quy trình ở `/viper-repeat` Bước 2 — đây chỉ là phần công cụ. Chỉ server
`browser` của **phiên chính** có bộ quay (`--caps=devtools` ở `.codex/config.toml`); ba khe dogfood không có, và
không cần: video là thứ giao cho Authority, không phải một vai dùng thử.

| Tool | Việc |
|---|---|
| `browser_start_video` | Bắt đầu quay. `filename` **tương đối tính từ gốc dự án** → ghi thẳng `demos/vong-<N>/<experience>.webm`; `size` `{width: 1280, height: 800}` khớp viewport; `cursor: true` vẽ con trỏ di chuyển tới từng điểm bấm (chậm 800 ms mỗi thao tác — dễ xem hơn) |
| `browser_video_show_actions` | Chú thích từng thao tác ngay trong video (tên thao tác + khung phần tử). Gọi một lần ngay sau khi bắt đầu quay |
| `browser_video_chapter` | Thẻ chương toàn màn hình: `title` "Bước k — AC-n: <việc>", `description` "<thấy gì>", `duration` ~1500 ms. **Mỗi bước của kịch bản một chương** — người xem biết đang thấy AC nào |
| `browser_stop_video` | Dừng, trả đường dẫn tệp. Chép đúng đường dẫn đó vào dòng `Tệp` của `context/DEMOS.md` |

Thứ tự: `browser_close` (phiên trắng) → `browser_navigate` trang đầu → `browser_start_video` →
`browser_video_show_actions` → mỗi bước: `browser_video_chapter` → thao tác thật → `browser_snapshot`
xác nhận đúng cột "Thấy gì" → `browser_stop_video`. Đã chạy thật trên `@playwright/mcp` 0.0.83 (headless): tệp
`.webm` ra đúng `demos/vong-<N>/` của dự án, `browser_stop_video` trả lại đường dẫn đó.

Bẫy:

- **Không gọi `browser_annotate`** (cũng thuộc `--caps=devtools`): nó mở bảng vẽ và **chờ người vẽ** —
  phiên treo tới khi có người bấm.
- Quên `browser_stop_video` thì tệp không được ghi trọn. Gãy giữa chừng vẫn phải stop rồi mới quay lại.
- Bước mà `browser_snapshot` không thấy đúng "Thấy gì" → **dừng quay**: đó là regression, không phải cảnh
  cần cắt (`/viper-repeat` Bước 2, luật 2).
- Video **không commit** (`demos/**/*.webm` ở `.gitignore`); `.playwright-mcp/` vẫn là chỗ của snapshot.
