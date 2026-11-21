---
name: viper-validate
description: "Pha V — vòng 1 hai đường vào (phỏng vấn sâu Authority, hoặc nhận tài liệu MESH-render qua intake/ + lập kế hoạch chia vòng); vòng ≥2 không phỏng vấn — đọc intake/loops/l<N>/ (tài liệu vòng, hoặc _PROPOSAL.md ở đường intake) + kết quả vòng trước; chốt PRD + persona + stack + kiến trúc + design system + prototype, challenge rồi mới khoá scope — CHỈ chạy khi người dùng gõ /viper-validate hoặc $viper-validate."
---

# /viper-validate — Pha V

**Đây là nơi DUY NHẤT được hỏi Authority.** Sau khi khoá scope, mọi câu hỏi tiếp theo là ma sát. Vì vậy: hiểu sản phẩm ở đây cho đủ và cho **sâu**.

Mục tiêu: xong `context/PRD.md` + `context/INTERVIEW.md` + `context/PERSONAS.md` + `context/TECHSTACK.md` + `context/ARCHITECTURE.md` + `context/DESIGN-SYSTEM.md` + `context/PROTOTYPE.md` + **`context/SOLUTION.md`** (bộ giải pháp: phần A ở vòng đầu mỗi Phase, phần B mọi vòng — Bước 5b) + **`context/DOGFOOD-PLAN.md`** (mọi vòng, mọi đường — Bước 7b), qua challenge, khoá scope. Đường intake thêm `context/CAPABILITIES-MAP.md` + `context/ROADMAP.md §1` + `intake/loops/l<N>/_PROPOSAL.md`. Vòng ≥2 chỉ cập nhật delta, không viết lại từ đầu.

## Trình tự

### Bước 0 — Nhận diện đường vào

Hai trục, rẽ theo **vòng trước, chế độ sau** ([VIPER.md §1.3](../../VIPER.md)):

- **Vòng** — dòng `Vòng` trong `STATE.md`.
- **Chế độ** — `context/INTERVIEW.md` có marker `NGUỒN: INTAKE` (ngoài `<!-- -->`) không. Đây là dấu hiệu **duy nhất**; nó ở lại kể cả khi INTERVIEW đóng băng từ vòng 2, nên vòng nào đọc cũng ra đúng chế độ. Vòng 1 chưa có marker thì dò bằng `intake/PRD.md`.

```
Vòng ≥ 2 + marker NGUỒN: INTAKE
    → KẾ HOẠCH VÒNG — nhảy tới "Vòng ≥ 2 · đường intake", bỏ qua Bước 1–5
Vòng ≥ 2, không marker
    → TÀI LIỆU VÒNG — nhảy tới "Vòng ≥ 2 · đường phỏng vấn", bỏ qua Bước 1–5
Vòng 1 + intake/PRD.md tồn tại + không rỗng (đúng tên file, KHÔNG phải _PRD-TEMPLATE.md)
    → ĐƯỜNG INTAKE — nhảy tới "Đường intake" (I1–I6), bỏ qua Bước 1–5
Vòng 1, không có intake/PRD.md
    → ĐƯỜNG PHỎNG VẤN — đi tiếp Bước 1 như thường
```

Đường intake dùng khi Authority đã có bộ tài liệu MESH-render (xem `intake/README.md`).
Thấy `intake/PRD.md` còn placeholder `{{…}}` → đó là template chưa resolve, báo Authority
thả bản render thật; trong lúc chờ, KHÔNG tự đi đường phỏng vấn thay.

**Ràng buộc nào áp cho đường nào** — đọc kỹ trước khi làm, đây là chỗ hay lẫn nhất:

| | Phỏng vấn | Intake |
|---|---|---|
| Ngân sách pha V | 2–3 tiếng, khoá scope trong 2h, xong sản phẩm trong 1 tuần | Không ép — mỗi vòng khai thời lượng riêng trong `_PROPOSAL.md` |
| Số AC | 3–7, quá 7 là cắt | Không trần; đổi lại mọi AC phải có ở `CAPABILITIES-MAP.md` |
| Persona | 2–3 | Theo intake PRD, giữ mã `P-…` |
| Cấu trúc code | Một app, gốc repo (luật #5) | Đa target `srcroot/{boundaries,web-experiences,mobile-experiences}/` đúng danh sách intake |
| Prototype | MỘT `prototype/index.html` | `prototype/<experience>/index.html` |
| Pha mỗi vòng | Trọn V-I-P-E-R | V+I bắt buộc, P/E/R theo `_PROPOSAL.md` |

### Bước 1 — Đọc trước khi hỏi

`VIPER.md` · `STATE.md` · `context/PRD.md` (xem đã có gì chưa). Nếu Authority đã viết sẵn brief ở đâu đó, đọc trước để không hỏi lại thứ đã có.

### Bước 2 — Phỏng vấn sâu

**Ngân sách: 2–3 tiếng — là ngân sách, không phải mục tiêu tốc độ.** Phỏng vấn xong trong 20 phút gần như chắc chắn là hỏi hời hợt. Hỏi không giới hạn số câu, nhưng chỉ ở đây.

**Hai chế độ hỏi — chọn đúng chế độ cho từng mục:**

| Loại mục | Cách hỏi |
|---|---|
| **Khám phá** — pain point, persona, ca biên, trạng thái rỗng/lỗi, dữ liệu mẫu, giao diện | **Hội thoại MỞ bằng lời**, đào theo mạch trả lời. KHÔNG dùng `request_user_input` — lựa chọn có sẵn sẽ mớm lời, Authority bấm option nghe hợp lý thay vì kể thực tế của mình |
| **Quyết định** — stack, đăng nhập, thu tiền, nơi deploy | `request_user_input` với lựa chọn cụ thể kèm đánh đổi: "Clerk (20 phút, có phí khi scale) hay Auth.js (1-2 tiếng, miễn phí)?" |

**Ngôn ngữ phỏng vấn**: Authority là **Founder / Product Owner, không phải kỹ sư**. Hỏi bằng ngôn ngữ business và sản phẩm — "hai khách đặt cùng một khung giờ thì sao?" chứ không phải "xử race condition thế nào?". Term kỹ thuật mà bắt buộc phải dùng (auth, webhook, migration…) thì **giảng giải ngay theo hướng business/product** trước khi hỏi: "đăng nhập bằng Google — tức là khách bấm một nút, không phải nhớ thêm mật khẩu; đổi lại mình phụ thuộc Google". Authority không hiểu câu hỏi thì câu trả lời vô giá trị — và họ sẽ trả lời đại cho xong.

**Bốn luật đào sâu** (mất một luật là mất chiều sâu):

1. **Hỏi về quá khứ cụ thể, không hỏi tương lai giả định.** "Lần gần nhất bị trùng lịch là khi nào — kể lại?" chứ không phải "anh có muốn app xếp lịch không?". Ai cũng nói "có" với tương lai; chỉ quá khứ mới không nói dối.
2. **Mỗi mục cần ≥1 bằng chứng**: một câu chuyện thật đã xảy ra, một con số, hoặc một hiện vật (ảnh cuốn sổ, file Excel, tin nhắn Zalo đang dùng).
3. **"Thường", "nhiều", "hay bị" → quy ra số.** Tần suất bao nhiêu lần/tuần? Mỗi lần tốn bao nhiêu phút/tiền?
4. **Đào theo mạch, đừng nhảy mục.** Sau mỗi câu trả lời tự hỏi: "đã đủ để code mà không phải quay lại hỏi chưa?" — chưa thì hỏi tiếp cùng chủ đề. Một mục hỏi 3–4 lượt là bình thường.

**Ghi sổ ngay trong lúc hỏi**: `context/INTERVIEW.md` — mỗi mục một khối `Trả lời:` + `Bằng chứng:`. `gate.py V` kiểm đúng 14 dòng bằng chứng không rỗng; với mục thuần quyết định, bằng chứng = ràng buộc thật khiến chọn phương án đó.

Đi tới khi **đủ tất cả 14 mục**:

| # | Phải làm rõ | Đủ khi |
|---|---|---|
| 1 | Pain point | Có câu chuyện thật + con số: ai chịu, tần suất, mỗi lần tốn gì (thời gian/tiền/khách) |
| 2 | Persona + năng lực được cấp | Tối đa 3 persona (thường 2–3; một loại người dùng thì 1 là đủ, đừng bịa thêm): chân dung, bối cảnh, thiết bị chính, mức thành thạo; VAI (role) của từng persona và **năng lực được cấp / không được cấp** — đủ để điền `PERSONAS.md` kèm ma trận vai × hành động |
| 3 | AC | 3–7 tiêu chí quan sát được. Nhiều hơn 7 là scope quá lớn cho một tuần — cắt |
| 4 | Out-of-scope | Liệt kê tường minh thứ dễ bị cuốn vào làm |
| 5 | Success metric | MỘT con số + ngưỡng go/pivot/kill |
| 6 | Đăng nhập | Không cần / provider nào |
| 7 | Thu tiền | Không / có + cách tính |
| 8 | Mô hình dữ liệu + ca biên | Thực thể chính, quan hệ; trùng/xoá/sửa/đồng thời/gửi hai lần xử ra sao — hỏi bằng ca thật: "hai khách gọi cùng lúc thì hiện giờ anh làm gì?" |
| 9 | Trạng thái rỗng và lỗi | Chưa có dữ liệu hiện gì; mất mạng, API fail hiện gì |
| 10 | Dữ liệu mẫu | Lấy đâu để dùng thử ở pha dogfood — tốt nhất là dữ liệu thật Authority đang có |
| 11 | Tên, domain, giọng, nơi deploy | |
| 12 | Giao diện | Sản phẩm **có UI không**? Backend-only (API/CLI/worker) → Bước 6–7 được bỏ qua, mục 13 ghi `KHÔNG CÓ UI`. Có UI → màn hình ĐẦU TIÊN persona chính nhìn thấy là gì, họ cần thấy gì trong 10 giây đầu |
| 13 | Phong cách thị giác | Hỏi bằng **hiện vật**, không hỏi thẩm mỹ suông: app nào Authority dùng hằng ngày thấy dễ nhìn — mở lên xem cùng; cái nào nhìn là ngợp/tránh; sản phẩm dùng ở đâu (ngoài nắng, trong xưởng → chữ to, tương phản mạnh). Đủ khi rút được **3 tính từ + 1–2 neo tham chiếu thật** cho `DESIGN-SYSTEM.md §1` |
| 14 | Legacy & tương thích | Checklist này chỉ chạy ở **vòng 1** nên ghi `Vòng 1 — chưa có legacy`. Từ vòng 2 chuyện phá legacy chốt trong `intake/loops/l<N>/` ([VIPER.md §1.2](../../VIPER.md)) |

Ngờ scope quá lớn cho một ngày → **nói thẳng ngay tại đây**, đề xuất cắt cái gì. Đây là lúc duy nhất cắt được mà không tốn gì. Sản phẩm hoá ra là một hệ thống lớn thật (nhiều service, nhiều app, nhiều tháng) → nói thẳng luôn: đường phỏng vấn sai cỡ, việc cần làm là phân tích rồi vào bằng **đường intake** ([VIPER.md §0](../../VIPER.md)), không phải nhồi vào một tuần.

### Bước 3 — Đọc lại cho Authority (playback)

Trước khi viết tài liệu: tóm tắt lại từng mục, đọc cho Authority nghe — *"tôi hiểu là X, đúng chưa?"*. Sai ở đâu sửa ngay tại chỗ. Hiểu sai bị bắt ở đây tốn một phút; lọt sang pha I là tốn nửa ngày code sai.

### Bước 4 — Chọn stack

Đọc mục "Khi nào chọn / không chọn" của các skill `stack-*`. Đề xuất một stack kèm lý do và đánh đổi, để Authority chốt. Mặc định cân nhắc trước: `stack-nextjs-fullstack` (nhanh nhất cho MVP một ngày).

(Đường intake: bước này chỉ chạy khi intake **không** có `TECHSTACK.md` — có thì stack đã được Authority định nghĩa, xem I2.)

### Bước 5 — Viết context

Điền, xoá hết dấu `_CHƯA ĐIỀN_`:

1. `context/INTERVIEW.md` — đã điền dần từ Bước 2; rà lại lần cuối, đủ 14 dòng `Bằng chứng:`
2. `context/PRD.md` — §1 đến §9. AC ở §3: 3–7 cái, cột `Capability` để trống (đó là cột của đường intake)
3. `context/PERSONAS.md` — 1–3 persona (tối đa 3, gate chặn nhiều hơn) + năng lực được cấp + **ma trận vai × hành động** (spec phân quyền cho pha I, vai đóng cho dogfood). Ô `Mã (intake)` ghi `—`
4. `context/TECHSTACK.md` — §1 đúng MỘT khối `### Target: app` (luật #5), §2, §3, §6
5. `context/ARCHITECTURE.md` — §1 và §2 mỗi mục một dòng, §3 ghi `—`, §5 ghi `—` (một app thì không có ranh giới nào để ký contract); §4 và §6–§10 điền đủ
6. `context/DECISIONS.md` — append quyết định stack + các quyết định lớn khác đã chốt
7. `context/ROADMAP.md` — §1 một dòng cho vòng hiện tại (vòng sau chỉ mở khi pha R quyết GO/PIVOT, không lập trước); §2 bám AC; thứ Authority nhắc mà không thuộc vòng này → §3

`ARCHITECTURE.md` là tài liệu quan trọng nhất cho backend. Viết mỏng nhưng **quyết đủ** — mọi ca biên ở §6 phải có câu trả lời, vì sau đây không được hỏi lại.

### Bước 5b — Bộ giải pháp (mọi đường, mọi vòng)

Sau pha V không được hỏi nữa — nên **cách giải bài toán** phải nằm trên giấy trước khi khoá scope, đủ
để builder ở pha I chỉ còn làm theo. Bộ giải pháp = `context/SOLUTION.md` (đầu mối) + `ARCHITECTURE.md`
+ `TECHSTACK.md` + `DESIGN-SYSTEM.md`. **Phase** là giai đoạn sản phẩm (MVP, Phase 2…) — dòng `Phase` ở
`STATE.md` cho biết vòng này thuộc Phase nào và có phải **vòng đầu của Phase** không.

**Vòng đầu của Phase** (vòng 1 luôn là vòng đầu của MVP) — lập **phần A, giải pháp tổng thể của Phase**:

1. **A1 Sản phẩm cuối Phase** — trước hết xác định *cả Phase* giao gì, không chỉ vòng này: hết Phase,
   ai làm được gì, năng lực nào vào vòng nào. Đường intake: mọi capability có cột Phase = Phase này
   (`CAPABILITIES-MAP.md`, `ROADMAP.md §1`). Đường phỏng vấn: AC vòng này + thứ Authority nói sẽ cần
   trong Phase — **hỏi thẳng**, đang pha V.
2. **A2 Hướng giải pháp** — các lựa chọn lớn, khó đảo ngược, ảnh hưởng nhiều vòng (đồng bộ hay hàng đợi,
   xoá mềm/cứng, tính tiền ở đâu, đa tenant, tích hợp kiểu gì…), kèm phương án đã loại. Đồng thời rà
   `ARCHITECTURE.md` + `TECHSTACK.md` cho đủ **phạm vi cả Phase** (target, mô hình dữ liệu, contract) —
   không chỉ vòng này, để vòng sau không phải đập lại nền.
3. **A3 Quy ước bắt buộc** (mã `G-<số>`) — luật xuyên suốt pha I phải tuân: phân quyền, validate, lỗi,
   kiểu API, tiền/làm tròn, múi giờ, migration, log, gọi dịch vụ ngoài. Viết đủ cụ thể để kiểm được.
4. **A4 Yêu cầu phi chức năng có số** · **A5 Rủi ro lớn của Phase**.
5. **Trình phần A cho Authority** — bằng ngôn ngữ business trước, kỹ thuật sau; tập trung vào A1, A2,
   A5. Authority đồng ý → ghi `Authority chốt Phase: <ngày ISO>`. Đây là chỗ Authority **thấy giải pháp
   lớn trước khi agent làm**, không phải đọc lại sau qua DECISIONS.

**Mọi vòng** (kể cả vòng đầu Phase) — làm giàu **phần B, giải pháp chi tiết của vòng**:

1. Vòng ≥2 cùng Phase: phần nào của B vòng trước **còn hiệu lực lâu dài** (contract, bảng, quy ước mới)
   → **nâng lên** `ARCHITECTURE.md` hoặc A3 trước, rồi mới viết lại B (bản cũ nằm ở `archive/vong-N/`).
   Giữa Phase mà thực tế đòi đổi phần A → một dòng §A6 + `DECISIONS.md`; đổi A2 thì trình Authority.
2. Đổi dòng `Vòng: N` của phần B cho đúng vòng này.
3. **B1 — mỗi AC của `PRD.md §3` một dòng**: target nào đổi · endpoint/contract · bảng/cột · màn/component
   · ca biên phải xử · quy ước A3 áp dụng · kiểm chứng bằng test nào, vai dogfood nào. Viết tới mức
   builder không phải đoán; chỗ phải tự quyết khi viết → 1 dòng `DECISIONS.md`.
4. **B2 — thay đổi kỹ thuật của vòng**: migration, contract, biến môi trường, dịch vụ ngoài, job —
   vòng ≥2 kèm cột tương thích ngược.

Ngắn: phần A ~2 trang, phần B ~1 trang. `gate.py V` kiểm: Phase khớp `STATE.md` · A1–A5 đủ, có quy ước
G-… · có `Authority chốt Phase` (vòng đầu Phase từ vòng 2: ngày ≥ `Vòng mở`) · B đúng vòng · B1 phủ mọi AC.

### Bước 6 — Bản đồ màn hình + design system (chỉ khi có UI)

**Backend-only** (đã chốt ở mục 12): ghi đúng một dòng `KHÔNG CÓ UI — bỏ qua prototype` vào `context/PROTOTYPE.md` và `KHÔNG CÓ UI — bỏ qua design system` vào `context/DESIGN-SYSTEM.md` (xoá phần còn lại của cả hai) + 1 dòng lý do vào `DECISIONS.md`, sang Bước 7b.

**Có UI** — quyết cấu trúc và hình thức TRƯỚC, dựng prototype SAU. Đảo thứ tự là mất tác dụng: token rút ra từ prototype đã dựng chỉ là bản mô tả những màu đã lỡ chọn.

1. Điền `context/PROTOTYPE.md` §1–§3: bản đồ màn hình (thông tin bắt buộc **theo thứ tự ưu tiên** của persona), sơ đồ điều hướng, map AC ↔ màn hình. AC nào không map được vào màn hình nào là thiếu màn hình hoặc AC thừa — xử ngay tại đây.
2. Điền `context/DESIGN-SYSTEM.md` từ mục 13 của phỏng vấn:
   - §1 ba tính từ + neo tham chiếu — lấy từ hiện vật Authority đã chỉ, không tự bịa gu
   - §2 token: màu (semantic, mã hex) · chữ (một họ, 3–4 bậc) · nhịp/bo góc/bóng · điểm gãy theo thiết bị chính của persona (`PERSONAS.md §1`)
   - §3 giữ đủ các cặp tương phản — `gate.py V` sẽ tự tính WCAG AA từ mã hex, chưa đạt là gate đỏ
   - §4 kho component: đi từng màn ở `PROTOTYPE.md §1`, liệt kê khối cần dùng, ghi rõ màn nào dùng khối nào + trạng thái bắt buộc của từng khối
   - §5 ba khuôn trạng thái dùng chung (rỗng / lỗi / đang tải)
3. Tự soát một lượt bằng `python3 scripts/gate.py V` — các mục design system phải hết đỏ (trừ phần cần prototype) trước khi sang Bước 7.

Design system ở đây là **công cụ tăng tốc, không phải nghi thức**: 30–45 phút, quyết một lần để prototype và pha I chỉ còn lắp ráp. Không đẻ thêm token/component "cho đủ bộ" — bảng nào không dùng thì xoá dòng.

### Bước 7 — Prototype tương tác + Authority chốt (chỉ khi có UI)

1. Dựng file prototype theo spec ở `PROTOTYPE.md §4` — **phỏng vấn**: một `prototype/index.html`; **intake**: `prototype/<experience>/index.html` cho từng experience có UI ở `ARCHITECTURE.md §2–§3`, mã màn `S<số>` toàn cục. Mỗi file tự chứa: đủ màn hình của experience đó, điều hướng bấm được, dữ liệu giả từ `PRD.md §7`, có trạng thái rỗng/lỗi, responsive theo thiết bị chính của persona, không CDN.
2. **Toàn bộ hình thức lấy từ `DESIGN-SYSTEM.md`**: token khai trong `:root`, dùng qua `var(--…)`, màn hình lắp từ kho component §4. **Không hardcode màu, không khai token mới ngay trong HTML, không vẽ khối ngoài kho.** Hook `guard_ds` chặn thẳng lệnh ghi file nếu vi phạm — bị chặn thì sửa `DESIGN-SYSTEM.md` trước, đừng tìm cách ghi kiểu khác.
3. **DỪNG LẠI — mời Authority bấm thử.** Đưa đường dẫn file (`open prototype/index.html`), đề nghị đi hết luồng lõi như persona chính. Đa target: mở lần lượt từng experience. Đây vẫn là pha V — hỏi và nhận phản hồi thoải mái.
4. Ghi từng lượt phản hồi vào `PROTOTYPE.md §5`, sửa, mời bấm lại. Phản hồi về hình thức ("chữ nhỏ quá", "màu chìm quá") → **sửa token trong `DESIGN-SYSTEM.md §2` rồi để nó lan ra prototype**, không sửa tay từng chỗ. Lặp tới khi Authority nói **chốt** → ghi `Chốt bởi Authority: <ngày ISO>`. Chốt prototype là chốt luôn design system.

Đường phỏng vấn: giới hạn 60–90 phút cho cả bước. Prototype là tài liệu để chốt IA + hình thức, không phải sản phẩm — đẹp vừa đủ hiểu, không đánh bóng. Đường intake nhiều experience thì tính theo từng file, nhưng luật "vừa đủ hiểu" không đổi.

### Bước 7b — Kế hoạch dogfood của vòng (mọi đường, mọi vòng)

Dogfood chạy ở cuối pha I, nhưng **dùng thử bằng con mắt nào thì quyết ở đây** — lúc còn được hỏi, và lúc
phạm vi vòng vừa khoá xong. Nạp skill `viper-roles`, viết lại `context/DOGFOOD-PLAN.md` cho vòng này
(dòng `Vòng: N` đúng số vòng ở `STATE.md`):

1. **§1 Chọn vai** — mọi vai trong danh mục một dòng `bật`/`tắt` + căn cứ trỏ file + mục. Quét tín hiệu trong
   PRD (§3, §7) · PERSONAS (thiết bị chính, tần suất dùng, có vai quản trị không) · ARCHITECTURE (§3 mobile,
   §5 contract, §6 ca biên, §9 dịch vụ ngoài) · DESIGN-SYSTEM · **phạm vi của chính vòng này**. Không vai
   nào bật mặc định — dự án không có app mobile và không đòi responsive thì `mobile` tắt — **trừ `smoke`:
   luôn bật**.
2. **§2 Vai bật làm gì** — đợt · persona · tài khoản riêng · nơi thử · việc vòng này (AC/luồng/màn cụ thể).
   Đợt 0 = `smoke` một mình; tối đa 3 vai một đợt (skill `viper-roles §3`).
3. **§3 Smoke hồi quy** — luồng lõi + **mọi AC đã giao ở các vòng trước** + AC vòng này, mỗi dòng 2–4 bước.
4. Trình §1–§2 cho Authority xem nhanh (vẫn pha V) — Authority muốn thêm/bớt vai thì sửa ngay tại đây.

Cả file một trang. `gate.py V` kiểm: đúng vòng · đủ vai danh mục · có căn cứ · `smoke` bật ở đợt 0 · đợt ≤3
vai · không hai vai chung tài khoản · §3 có dòng (vòng ≥2: có dòng của vòng trước) · có app mobile thì
`mobile` bật · `KHÔNG CÓ UI` thì `picky`/`mobile`/`a11y` tắt.

### Bước 8 — Challenge pha V (luật #8)

Trước khi khoá scope, tự ra **3–5 câu hỏi khó nhất** về dự án — loại chỉ trả lời được nếu tài liệu đủ sâu:

- "AC-2 và ca biên 'gửi hai lần' — tài liệu đã nói xử thế nào chưa?"
- "Persona phụ bấm vào hành động bị cấm — màn hình nào hiện gì?"
- "Success metric đo bằng gì, event nào, ai gắn?"
- "Nút đang gửi ở màn S2 trông thế nào — component nào trong `DESIGN-SYSTEM.md §4` chốt trạng thái đó?"

Trả lời từng câu **chỉ bằng những gì đã ghi trong PRD/INTERVIEW/PERSONAS/ARCHITECTURE/DESIGN-SYSTEM/PROTOTYPE** (đường intake thêm `CAPABILITIES-MAP.md` + `_PROPOSAL.md`). Câu nào không trả lời được từ tài liệu = một lỗ → vá theo đúng đường mình đang đi:

| Đường | Vá ở đâu |
|---|---|
| Vòng 1 — phỏng vấn | **Quay lại Bước 2**, hỏi tiếp phần đó (vẫn đang pha V, còn được hỏi) |
| Vòng 1 — intake | Quay lại **I2/I3**: dịch chưa đủ, hoặc lỗ hổng chưa vá. Dịch mà không trả lời được là dịch hỏng |
| Vòng ≥2 | Đọc lại `intake/loops/l<N>/` + kết quả vòng trước; tài liệu vòng còn lỗ thì hỏi Authority qua chat, meta ghi hộ vào `l<N>/` |

Trả lời được hết → ghi 1 dòng `STATE.md §Challenge log` với pha `V`, phán quyết PASS. `gate.py V` bắt dòng này (vòng ≥2: ngày phải ≥ `Vòng mở`).

### Bước 9 — Khoá scope

```bash
python3 scripts/gate.py V
```

Xanh → cập nhật `STATE.md`: pha `I`, tick hết gate V, ghi stack đã chốt.

Rồi nói với Authority, nguyên văn ý này:

> Scope đã khoá. Từ đây tôi không hỏi nữa — gặp mơ hồ sẽ tự quyết theo PRD/PERSONAS/ARCHITECTURE/DESIGN-SYSTEM/PROTOTYPE và ghi vào `DECISIONS.md` để anh xem lại cuối buổi. Chỉ dừng lại nếu chạm việc không đảo ngược được.

## Đường intake — dịch tài liệu + lập kế hoạch vòng

Vào đây từ Bước 0 khi có `intake/PRD.md`. **14 mục phỏng vấn không áp cho đường này** — nguồn hiểu sản phẩm là bộ tài liệu MESH-render, việc của meta là **dịch trung thành** sang `context/`, không phải phỏng vấn lại. Ba chốt cuối giữ nguyên: prototype Authority chốt (có UI) · challenge pha V · khoá scope.

**Cùng với đó, mọi ràng buộc cỡ của đường phỏng vấn cũng không áp** ([VIPER.md §0](../../VIPER.md)): sản phẩm ở đây là một hệ thống đã phân tích xong, có thể lớn, nhiều target, chạy nhiều vòng. Không trần AC, không trần persona, không ép một tuần, không ép một app. Đổi lại có ràng buộc riêng — trung thành với hợp đồng intake, và **lập kế hoạch chia vòng** (I5).

### I1 — Đọc trọn bộ drop

Mọi file trong `intake/`: `PRD.md` (bắt buộc) + `ARCHITECTURE.md` / `TECHSTACK.md` / `ROADMAP.md` / `design-systems/<ds-name>/` (tuỳ chọn, có gì đọc nấy). Định dạng chuẩn của từng file nằm ở `intake/_*-TEMPLATE.md` — đọc template trước để biết mục nào nằm đâu. Drop còn `{{…}}` → dừng, báo Authority (Bước 0).

### I2 — Dịch sang context/

**Intake là hợp đồng — dịch trung thành, không "cải tiến".** Chỗ nào phải diễn giải (cắt lát, đặt AC) thì ghi lại được ở I4. Bảng dịch:

| Nguồn intake | Đích context/ | Cách dịch |
|---|---|---|
| PRD §1 Problem | `PRD.md §1` pain point | Giữ nguyên ý; "ai chịu" lấy từ §2 |
| PRD §2 Personas | `PERSONAS.md` | Đúng shape gate: `### Persona N — … (role: …)` + năng lực được cấp / KHÔNG được làm + `## 2. Ma trận` vai × hành động (vai dogfood chọn riêng ở `DOGFOOD-PLAN.md`, Bước 7b — persona vận hành là tín hiệu bật `operator`, có `mobile-experiences` là `mobile`…). **Không trần 2–3** — PRD định nghĩa bao nhiêu thì dịch bấy nhiêu; giữ mã `P-…` ở ô `Mã (intake)` |
| PRD §3 Capabilities | `CAPABILITIES-MAP.md` **+ `PRD.md §3` AC** | Toàn bộ capability vào map (giữ mã `CAP-…`), điền cột `Vòng giao` sau khi làm I5. Lát cắt của vòng này → viết thành AC quan sát được ở `PRD.md §3`, **cột `Capability` của từng AC bắt buộc điền** — `gate.py` đối chiếu để thay cho trần 7 AC. Không cắt AC cho vừa con số; cắt là cắt ở mức **vòng** (I5), không phải ở mức AC |
| PRD §4 Phase priority | `PRD.md §4` + `ROADMAP.md §1` | Thứ tự phase là đầu vào chính của kế hoạch chia vòng (I5) |
| PRD §5 Out of scope | `PRD.md §5` | Giữ nguyên + thêm phần đẩy sang vòng sau ở dòng trên |
| PRD §6 Hypotheses | `PRD.md §6` success metric | Chọn MỘT giả thuyết đo được làm metric + ngưỡng go/pivot/kill; các giả thuyết còn lại → sổ EXPERIMENTS. Vòng không chạy pha E → ghi rõ "vòng này không đo, tiêu chí xong là AC §3" + vòng nào sẽ đo |
| ARCHITECTURE (nếu có) | `ARCHITECTURE.md` | §1–§3 giữ nguyên danh sách boundary/experience + tên (đây là tên thư mục con của `srcroot/boundaries|web-experiences|mobile-experiences/` ở pha I), §4 topology, §5 contract giữa target; mỗi boundary một khối mô hình dữ liệu + ca biên ở §6 |
| TECHSTACK (nếu có) | `TECHSTACK.md` | Một khối `### Target: <tên>` mỗi target, giữ nguyên Choice + Reason. `Skill đang dùng`: skill khớp nhất nếu có — kèm mục **"Sai khác so với skill"** liệt kê từng chỗ intake khác default; không khớp skill nào → `custom (intake — theo intake/TECHSTACK.md)`. **Intake thắng default của skill** — intake nói Prisma+Chakra thì không đổi sang Drizzle+shadcn |
| design-systems/<ds>/ (nếu có) | `DESIGN-SYSTEM.md` | Dịch token (`color.primary` + `tokens.json` → `--color-primary`…) về **đúng shape §2/§3/§4** — bảng token có mã hex, cặp tương phản, component có màn dùng. **Dịch ĐỦ và ĐÚNG**: không bỏ rơi token nào của gói, không bịa thêm, không đổi giá trị — hook `guard_ds` chặn lúc ghi và `gate.py` đối chiếu lại. Gói thiếu hex hoặc thiếu cặp AA thì bổ khuyết + ghi DECISIONS (đó là bổ khuyết, không phải đổi) |
| ROADMAP (nếu có) | `ROADMAP.md §1` | Wave sequence là **xương sống của kế hoạch chia vòng** — xem I5 |

File tuỳ chọn nào **không có** trong drop → dựng phần đó như đường phỏng vấn (Bước 4 cho stack, Bước 6.2 cho design system…) — vẫn đang pha V, **được hỏi Authority**.

### I3 — Vá lỗ hổng

Những thứ PRD MESH thường không nói mà `PRD.md §7` cần: đăng nhập · thu tiền · trạng thái rỗng/lỗi · dữ liệu mẫu · tên/domain/giọng · nơi deploy · con số go/pivot/kill. Thứ tự xử:

1. Tìm trong các file intake còn lại (TECHSTACK hay có auth/deploy; ROADMAP hay có ngưỡng).
2. Không có → **hỏi Authority** (mục quyết định, dùng `request_user_input` — vẫn pha V).
3. Authority vắng → tự quyết phương án hợp lý nhất + **1 dòng `DECISIONS.md` cho từng lỗ**.

### I4 — Ghi INTERVIEW.md thành sổ dịch

`context/INTERVIEW.md` xoá 14 mục, thay bằng (marker phải nằm **ngoài** `<!-- -->`):

```markdown
NGUỒN: INTAKE — render nhận ngày <ISO>

## Truy vết intake → context

| Mục context | Nguồn intake |          ← từng file context lấy từ đâu

## Lỗ hổng & cách xử

| Lỗ hổng | Cách xử |                 ← kết quả I3: hỏi ai / tự quyết dòng DECISIONS nào
```

(Đường intake chỉ còn của vòng 1 — chuyện legacy vòng ≥2 nằm trong tài liệu vòng
`intake/loops/l<N>/`, xem mục "Vòng ≥ 2" bên dưới.)

`gate.py V` đường intake kiểm: marker + bảng `## Truy vết` + `intake/PRD.md` là render thật + `CAPABILITIES-MAP.md` đã tách. Không đòi dòng `Bằng chứng:` nào.

### I5 — Lập kế hoạch chia vòng

**Đây là việc riêng của đường intake, và là lý do nó tồn tại.** Intake giao cả một hệ thống; nhồi hết vào một vòng là quay về đúng cái sai mà đường phỏng vấn không giải được. Cắt nó ra ([VIPER.md §1.4](../../VIPER.md)):

1. **Đọc nguồn cắt**: `intake/ROADMAP.md §2` (wave sequence — đã có dependency ordering, at-risk, contract-gate; đây là xương sống, đừng tự nghĩ lại) + `intake/PRD.md §3–§4` (capability × phase) + `context/ARCHITECTURE.md §1–§3` (target nào tồn tại).
2. **Quyết số vòng**. Mặc định: **một wave = một vòng**. Gộp wave khi hai wave nhỏ chạm cùng target và không có contract-gate giữa chúng; tách wave khi một wave chạm quá nhiều target đến mức không dogfood nổi trong một lượt. Không có wave sequence → cắt theo `Phase` của capability map, MVP trước.
3. **Quyết pha mỗi vòng.** V và I bắt buộc. Thêm:
   - `P` ở vòng mà sản phẩm **đã đủ dùng được cho persona thật** — deploy một wave hạ tầng chưa ai chạm là nghi thức. Thường là vòng đóng xong lát cắt dọc đầu tiên.
   - `E` ở vòng **sau khi đã deploy** — chưa có người dùng thật thì không có gì để đo.
   - `R` ở vòng có `E` (quyết go/pivot/kill từ số liệu), hoặc vòng cuối kế hoạch.
   Đây là chỗ **đề xuất cho Authority chốt** — vẫn đang pha V, được hỏi. Trình bày bảng vòng kèm lý do rồi hỏi thẳng: "deploy lần đầu ở vòng mấy?".
4. **Ghi `context/ROADMAP.md §1`** — bảng kế hoạch: mỗi vòng một dòng (Vòng · **Phase** · Phạm vi · Pha chạy · Phụ thuộc · Trạng thái). Cột Phase lấy theo cột Phase của capability (MVP, Phase 2…) — vòng có Phase khác vòng trước là **vòng đầu của Phase mới**, pha V của nó lập lại `SOLUTION.md` phần A. Đây là bản sống, nguồn sự thật.
5. **Sinh `intake/loops/l<N>/_PROPOSAL.md` cho TỪNG vòng, kể cả `l1/`** — theo `intake/loops/_PROPOSAL-DETAIL-TEMPLATE.md`, **đủ 25 mục**: mục tiêu · **kịch bản demo cuối vòng** (§2 — smoke của vòng, định nghĩa xong, và kịch bản video demo quay ở pha R) · cỡ · phạm vi · AC chi tiết · luồng · màn · thay đổi theo target · contract · dữ liệu · luật nghiệp vụ · ca biên · quyền · phụ thuộc · test · dogfood · rủi ro · thứ tự triển khai · định nghĩa xong · legacy. Vòng gần điền thật; vòng xa được hẹn `— chi tiết hoá khi rà lại vòng N` ở §6–§22, nhưng §1–§5 và §23–§24 phải thật ngay. Mục không áp dụng ghi `—` + lý do, **không xoá tiêu đề** — `gate.py V` kiểm đủ tiêu đề của vòng hiện tại. Vòng 1 điền luôn `Rà lại vòng 1: <hôm nay>`; các vòng sau **để trống dòng đó** (meta ghi khi mở vòng — đó là hàng rào chống "gate mọi vòng xanh sẵn từ vòng 1").
6. **Điền cột `Vòng giao` của `CAPABILITIES-MAP.md`** cho mọi capability, và cột `AC vòng này` cho những capability thuộc vòng 1.

`gate.py V` đối chiếu số dòng ở `ROADMAP.md §1` với số `_PROPOSAL.md` thật — lệch là đỏ.

### I6 — Nhập lại luồng chung

Đi tiếp **Bước 5b → 6 → 7 → 7b → 8 → 9** như đường phỏng vấn (Bước 5b: phần A theo Phase của vòng 1 ở `ROADMAP.md §1`, thường là MVP), với ba lưu ý đa target:

- **Prototype nhiều file**: `prototype/<experience>/index.html` cho từng experience có UI ở `ARCHITECTURE.md §2–§3`; mã màn hình là `S<số>` **toàn cục** (S1, S2… — không đặt SW1/SM1, gate chỉ khớp `S\d+`). Backend-only toàn phần → marker `KHÔNG CÓ UI` như thường.
- **Chỉ dựng prototype cho experience thuộc phạm vi vòng này** (`_PROPOSAL.md` cột Target). Experience của vòng sau vẫn nằm trong bản đồ `PROTOTYPE.md §1`? Không — đưa nó vào bản đồ của vòng nó, không khai trước rồi bỏ trống, vì `gate.py` bắt màn khai mà chưa dựng.
- Authority vẫn phải **bấm thử và chốt** prototype; challenge Bước 8 trả lời từ tài liệu **đã dịch** (kể cả `CAPABILITIES-MAP.md` và kế hoạch vòng) — dịch mà không trả lời được là dịch hỏng, quay lại I2/I3.

## Vòng ≥ 2 · đường phỏng vấn — tài liệu vòng

Vào đây sau `/viper-repeat` khi `STATE.md` có `Vòng ≥ 2` và **không** có marker `NGUỒN: INTAKE`. **Không phỏng vấn nữa** — phỏng vấn là công cụ mở rộng tư duy lúc khởi đầu dự án; từ vòng 2 dự án đã hình thành, insight nằm ở số liệu. `INTERVIEW.md` đóng băng làm hiện vật vòng 1, không đụng. Nguồn của vòng N là **tài liệu vòng**: file `.md` Authority thả vào `intake/loops/l<N>/` mô tả **thêm mới / thay đổi / bỏ đi** (mẫu: `intake/loops/_TEMPLATE.md`) — tài liệu đó đồng thời là **chữ ký chốt của Authority**, không có nghi thức chốt riêng.

Trình tự:

1. **Chờ/nhận tài liệu vòng.** `intake/loops/l<N>/` trống → báo Authority thả file (`repeat.py` đã tạo sẵn thư mục). Authority muốn trả lời qua chat → vẫn được (đang pha V), meta **ghi hộ** vào `l<N>/` (ví dụ `tu-chat-<ISO>.md`): dòng đầu `Nguồn: chat với Authority, <ISO>`, nội dung **trích nguyên văn** — không diễn giải. `gate.py V` fail-closed tới khi thư mục có tài liệu thật (không rỗng, hết `{{…}}`, không tính `_*.md`).
2. **Đọc trọn tài liệu vòng** + insight sẵn có: sổ EXPERIMENTS vòng trước (vòng 1: `EXPERIMENTS.md`; vòng k: `EXPERIMENTS-v<k>.md` — file sống, không phải đào archive) · `ROADMAP.md §3` backlog · `DECISIONS.md`.
3. **Cập nhật context theo delta** — `context/` vẫn là nguồn sự thật: AC mới **thay** AC cũ trong `PRD.md §3` (bản vòng trước nằm ở `archive/`); PERSONAS / ARCHITECTURE / TECHSTACK chỉ sửa khi tài liệu vòng đụng tới. Mục "Bỏ đi" → cập nhật PRD + out-of-scope, và nói rõ dữ liệu người dùng ở phần bị cắt xử lý sao. `ROADMAP.md §1` thêm một dòng cho vòng này.
4. **Legacy**: mặc định giữ ([VIPER.md §1.2](../../VIPER.md)). Chỗ phá chỉ hợp lệ khi nằm trong tài liệu vòng (mục "Legacy được phép phá") hoặc được Authority chốt qua chat (ghi hộ vào `l<N>/`). Cập nhật sổ hợp đồng `BACKWARD-COMPATIBILITY-CHECKLIST.md §1` nếu delta đẻ surface mới — §3 sẽ rà ở pha P.
5. **Lỗ hổng thông tin**: tìm trong `l<N>/` + số liệu → hỏi Authority qua chat (vẫn pha V) → tự quyết + **1 dòng `DECISIONS.md` cho từng lỗ**. Gate đòi ≥2 quyết định **dưới mốc `(vòng N)`**.
6. **Prototype + design system**: tài liệu vòng đụng UI → thêm/sửa màn delta trên bản đồ hiện có (`DESIGN-SYSTEM.md` giữ nguyên trừ khi Authority đổi; đổi token → 1 dòng `DECISIONS.md`, và hook `guard_ds` vẫn canh). Ngày chốt cũ còn nguyên (`repeat.py` không xoá) — không cần nghi thức chốt lại; delta UI lớn thì mời Authority bấm thử là khuyến nghị, không phải điều kiện gate.
6a. **Bộ giải pháp** (Bước 5b): vòng đầu của Phase mới (`STATE.md` dòng `Phase … mở ở vòng N` = vòng này) → lập lại phần A + Authority chốt; mọi vòng → nâng phần còn hiệu lực của B cũ lên rồi viết B cho AC vòng này.
6b. **Kế hoạch dogfood vòng này** (Bước 7b): chọn lại vai theo tài liệu vòng — tính năng mới mang tín hiệu mới (thanh toán → `money`, webhook → `integrator`) thì bật vai đó; `smoke` §3 thêm AC vòng trước.
7. **Challenge V rồi khoá scope**: 3–5 câu khó nhất, trả lời **chỉ từ tài liệu vòng + context đã cập nhật** — không trả lời được là đọc chưa kỹ hoặc tài liệu vòng còn lỗ, quay lại bước 2/5. Ghi vào `STATE.md §Challenge log` với **ngày hôm nay** — gate chỉ tính dòng có ngày ≥ `Vòng mở`.
8. **Sau khoá scope**: `l<N>/` đóng băng — muốn đổi ý giữa vòng → `ROADMAP.md` chờ vòng sau. Thời lượng cả mục này thường 30–60 phút.

## Vòng ≥ 2 · đường intake — kế hoạch vòng

Vào đây khi `Vòng ≥ 2` **và** có marker `NGUỒN: INTAKE`. Khác nhánh trên ở một điểm gốc: **kế hoạch vòng đã có sẵn** từ I5 của vòng 1, Authority đã ký một lần cho cả kế hoạch nên không phải thả tài liệu mỗi vòng. Việc của meta là **rà lại kế hoạch đó trước thực tế**, không phải chờ đầu vào.

1. **Đọc `intake/loops/l<N>/_PROPOSAL.md`** — mục tiêu vòng, kịch bản demo, phạm vi capability, target, AC chi tiết, `Pha vòng này`, `UI vòng này`, legacy được phép phá. Không có file này → kế hoạch dừng trước vòng N; cập nhật `ROADMAP.md §1` + tạo proposal từ `_PROPOSAL-DETAIL-TEMPLATE.md` rồi mới đi tiếp.
2. **Đối chiếu với thực tế vòng trước**: vòng trước giao đủ chưa (`ROADMAP.md §1` cột Trạng thái, `CAPABILITIES-MAP.md`) · phụ thuộc đã sẵn chưa · có số liệu/phản hồi nào làm kế hoạch này sai không (sổ EXPERIMENTS, `STATE.md §Phát hiện từ dogfood chưa xử`) · `DECISIONS.md` của vòng trước có gì đổi hướng không.
3. **Áp tài liệu bổ sung của Authority** nếu có (`.md` không bắt đầu bằng `_` trong `l<N>/`) — đó là điều chỉnh, ưu tiên cao hơn kế hoạch cũ.
4. **Chỉnh kế hoạch nếu lệch** — sửa `_PROPOSAL.md` **và** `ROADMAP.md §1`, ghi lý do vào `## Điều chỉnh khi mở vòng` của proposal. Đổi lớn (thêm/bớt vòng, dời deploy sang vòng khác) → hỏi Authority, đang pha V.
4a. **Điền nốt mục còn hẹn.** Proposal lập từ vòng 1 cho vòng xa thường để `— chi tiết hoá khi rà lại vòng <N>` ở §6–§22 — giờ là lúc điền thật, nhất là **§2 Kịch bản demo cuối vòng** (pha R quay video theo đúng các bước này) và §6 AC chi tiết. Proposal theo mẫu cũ (thiếu mục) → bổ sung đủ tiêu đề theo `_PROPOSAL-DETAIL-TEMPLATE.md`; `gate.py V` đỏ tới khi đủ.
5. **Ghi dòng `Rà lại vòng <N>: <ngày hôm nay>`** vào `_PROPOSAL.md`. `gate.py V` đòi đúng dòng này với ngày ≥ `Vòng mở` — chưa rà thì chưa được khoá scope.
6. **Cập nhật context theo phạm vi vòng**: AC mới ở `PRD.md §3` (cột `Capability` bắt buộc) · `CAPABILITIES-MAP.md` cột `AC vòng này` + `Trạng thái` · PERSONAS/ARCHITECTURE/TECHSTACK chỉ sửa khi vòng này chạm tới · `PRD.md §6` metric (vòng không chạy E thì ghi rõ).
7. **Legacy**: như nhánh trên, cộng thêm nơi chốt hợp lệ thứ ba là mục "Legacy được phép phá" của `_PROPOSAL.md`.
8. **Prototype**: `UI vòng này: không có màn mới` → bỏ qua hoàn toàn, gate không hỏi. Có màn mới → thêm màn delta vào `PROTOTYPE.md §1` và dựng trong đúng file experience của nó; không chốt lại toàn bộ.
8a. **Bộ giải pháp** (Bước 5b): vòng có Phase khác vòng trước ở `ROADMAP.md §1` là vòng đầu của Phase mới (`repeat.py` đã ghi dòng `Phase` ở `STATE.md`) → lập lại phần A cho cả Phase + Authority chốt; mọi vòng → nâng phần còn hiệu lực của B cũ lên rồi viết B cho AC vòng này.
8b. **Kế hoạch dogfood vòng này** (Bước 7b): vai bật theo capability của vòng — vòng đưa thanh toán vào mới bật `money`, vòng chưa có màn mới thì `picky` có thể tắt; `smoke` §3 thêm AC vòng trước.
9. **Lỗ hổng → `DECISIONS.md`** (≥2 quyết định dưới mốc), **challenge V ngày hôm nay**, rồi khoá scope. Sau đó `l<N>/` đóng băng.

## Dấu hiệu hời hợt

Dính **≥2 dấu hiệu** → quay lại vá trước khi đi tiếp. Checklist khác nhau theo đường.

**Đường phỏng vấn** (quay lại Bước 2):

- Mỗi mục chỉ hỏi đúng một câu, không mục nào phải hỏi lần hai
- Không có con số nào trong toàn bộ PRD/INTERVIEW
- Không có câu chuyện thật nào — toàn mô tả trừu tượng ("người dùng hay gặp khó khăn khi…")
- Authority chỉ bấm chọn option, chưa từng phải gõ mô tả thực tế của họ
- Xong Bước 2 dưới 30 phút
- Dòng `Bằng chứng:` chỉ là diễn đạt lại câu trả lời, không phải câu chuyện / con số / hiện vật
- Câu hỏi đầy term kỹ thuật không giảng giải — Authority gật đại cho xong thay vì trả lời thật

**Đọc tài liệu — intake vòng 1, hoặc bất kỳ vòng ≥2** (quay lại I2/I3, hoặc bước 2 của mục vòng ≥2):

- Có file trong `intake/` chưa hề mở ra đọc, chỉ đọc mỗi `PRD.md`
- `context/` có mục chỉ là paraphrase mượt hơn của intake, không thêm quyết định nào — dịch ≠ chép lại
- Bảng `## Truy vết` có dòng ghi chung chung ("từ intake") thay vì trỏ đúng file + mục
- Không lỗ hổng nào được ghi ở `## Lỗ hổng & cách xử` — PRD MESH gần như không bao giờ nói đủ về auth, thu tiền, trạng thái rỗng/lỗi, ngưỡng go/pivot/kill
- AC không truy được về capability nào, hoặc capability quan trọng không vòng nào giao
- **(vòng ≥2)** Không dẫn được một số liệu / phản hồi / phát hiện dogfood nào của vòng trước
- **(vòng ≥2)** Không đối chiếu legacy: không nói được vòng này chạm gì của vòng trước
- **(vòng ≥2, intake)** `Rà lại vòng N` ghi mà kế hoạch không đổi dòng nào và cũng không nói được vì sao vẫn đúng

Điều này áp cho chính mình — giống hệt "dấu hiệu dogfood giả" ở `/viper-dogfood`.

## Ranh giới

- Không code sản phẩm ở pha này. File prototype là tài liệu chốt IA, không phải code nền — pha I không phát triển tiếp file đó (riêng **bảng token** thì pha I dùng lại nguyên vẹn, theo `DESIGN-SYSTEM.md §6`).
- **(phỏng vấn)** Không "để đó tính sau" cho 14 mục — thiếu mục nào là nợ, sẽ phải trả bằng một lần ngắt giữa lúc code.
- **(phỏng vấn)** Nhiều hơn 7 AC → cắt tại chỗ, đẩy phần dư sang `ROADMAP.md §3`. Design system gói trong 30–45 phút, một trang; kéo dài hơn là đang làm brand guideline, không phải MVP một tuần.
- **(intake)** Không tự "cải tiến" hợp đồng: không đổi lựa chọn của intake TECHSTACK cho hợp default của skill, không đẻ target ngoài danh sách ARCHITECTURE, không bịa/bỏ/đổi token của gói design system.
- **(intake)** Không cắt AC cho vừa một con số — cắt ở mức **vòng** (I5). Nhưng AC nào cũng phải điền cột `Capability`.
- Có UI mà Authority **chưa chốt prototype** → chưa được khoá scope, `gate.py V` sẽ chặn đúng chỗ này.
- Chưa qua challenge pha V → chưa được khoá scope.
