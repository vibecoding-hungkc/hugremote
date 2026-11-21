# Kế hoạch vòng chi tiết — mẫu cho `intake/loops/l<N>/_PROPOSAL.md` (đường intake)

> **Đặc tả định dạng, không phải chỗ điền.** Bản thật nằm ở `l<N>/_PROPOSAL.md` của từng vòng, do
> meta soạn ở **vòng 1** khi lập kế hoạch chia vòng ([VIPER.md §1.4](../../VIPER.md), `/viper-validate`
> mục I5), rồi làm giàu khi mở vòng đó.
>
> Đường phỏng vấn KHÔNG dùng file này — ở đó mỗi vòng Authority thả tài liệu vòng
> ([`_TEMPLATE.md`](_TEMPLATE.md)), không có kế hoạch lập sẵn.

---

## Vì sao có file này

Đường intake nhận cả một **hệ thống đã phân tích kỹ**, không phải một MVP. Việc đầu tiên của pha V
vòng 1 là cắt hệ thống đó thành N vòng: vòng nào giao capability nào, chạm target nào, và **chạy tới
pha nào**. Cắt xong thì kế hoạch phải nằm trên đĩa — `context/ROADMAP.md §1` là bảng tổng (bản sống,
nguồn sự thật), mỗi `_PROPOSAL.md` là chi tiết của một vòng.

**Chi tiết tới mức nào.** Chỉ ghi "vòng nào giao capability nào" thì đủ để *lập kế hoạch*, không đủ để
*làm*: pha V của từng vòng còn phải sinh AC, bản đồ màn hình, giải pháp theo AC, kế hoạch dogfood; pha R
còn phải quay video demo. Proposal không chứa sẵn những thứ đó thì pha V phải tự suy ra và dễ lệch hướng.
Mẫu này gom đủ context để pha V **dịch** chứ không phải **đoán**, pha I có thứ tự làm rõ ràng, và pha R
có sẵn kịch bản để quay.

Authority ký **một lần cho cả kế hoạch** ở vòng 1, nên từ vòng 2 không phải ký lại từng vòng. Đổi lại,
mở vòng nào thì meta phải **rà lại** kế hoạch vòng đó — đối chiếu kết quả vòng trước, chỉnh nếu lệch,
điền nốt mục còn để ngỏ — rồi ghi dòng `Rà lại vòng N`. `gate.py V` đòi đúng dòng đó với ngày ≥
`Vòng mở`; không có nó thì kế hoạch lập từ vòng 1 sẽ làm gate mọi vòng xanh sẵn, và cơ chế vòng mất
hết tác dụng.

## Cách dùng

1. Copy khung từ dòng `NGUỒN:` trở xuống vào `l<N>/_PROPOSAL.md`, rồi điền.
2. Mỗi `{{…}}` phải được thay — kể cả trong comment. Còn sót thì `gate.py V` đỏ — đó là cố ý.
3. Mục không áp dụng thì ghi `—` kèm một câu lý do, **không xoá tiêu đề mục**: `gate.py V` đối chiếu
   đủ tiêu đề các mục bắt buộc (cột ✓ ở bảng dưới) trong proposal của vòng hiện tại, và đòi §2 có ít
   nhất một bước.
4. Mọi dòng phải truy được về `intake/PRD.md`, `intake/ARCHITECTURE.md`, `intake/TECHSTACK.md` hoặc
   `intake/ROADMAP.md` (ghi § khi không hiển nhiên). Không bịa yêu cầu mới. Phát sinh ngoài scope thì
   ghi `context/ROADMAP.md` backlog.
5. Dài vừa đủ: khoảng 3–6 trang mỗi vòng. AC nào cũng phải quan sát được bằng mắt hoặc bằng test.
6. **Vòng xa** (lập ở vòng 1 khi thông tin chưa đủ): §1–§5 và §23–§24 phải thật ngay từ vòng 1; mục
   chi tiết §6–§22 được ghi `— chi tiết hoá khi rà lại vòng N`. Mở vòng N thì điền đủ **trước** khi
   ghi dòng `Rà lại vòng N` — rà lại mà để nguyên dòng hẹn là chưa rà.

## Năm dòng đầu — máy đọc

Năm dòng đầu nằm **ngoài** mọi khối `<!-- -->`.

| Dòng | Luật |
|---|---|
| `NGUỒN: KẾ HOẠCH VÒNG` | Ngày lập + tài liệu intake đã cắt ra kế hoạch |
| `Pha vòng này` | **Luôn có `V, I`** — hai pha này bắt buộc ở mọi vòng, gate tự thêm vào nếu khai thiếu. Thêm `P` (deploy) · `E` (đo) · `R` (quyết go/pivot/kill) ở vòng Authority chốt. Vòng không khai P thì `gate.py P1/P2` tự bỏ qua. Pha R *sổ sách* (đóng vòng, quay video demo, mở vòng kế) thì vòng nào cũng chạy |
| `Thời lượng dự kiến` | Đường intake không bị ép "1 tuần mỗi vòng" — lấy nhịp từ wave cadence của `intake/ROADMAP.md` |
| `UI vòng này` | `không có màn mới` → gate V bỏ qua prototype cho vòng đó (bản đồ màn + design system vòng trước còn hiệu lực) và không đòi mục §8 Màn hình |
| `Rà lại vòng N` | Ghi **khi mở vòng**, không ghi trước. Ngày phải ≥ `Vòng mở` trong `STATE.md` |

## Mục nào đi đâu ở pha V

| § | Mục | Bắt buộc | Pha V dịch sang |
|---|---|:--:|---|
| 1 | Mục tiêu vòng | ✓ | `context/PRD.md §1–§2` (bối cảnh vòng), `SOLUTION.md` phần B |
| 2 | Kịch bản demo cuối vòng | ✓ | `DOGFOOD-PLAN.md §3` (smoke), §22 Định nghĩa xong, **video demo pha R** (`context/DEMOS.md`) |
| 3 | Cỡ vòng | ✓ | `context/ROADMAP.md §1` |
| 4 | Phạm vi — capability | ✓ | `CAPABILITIES-MAP.md` (cột Vòng giao, AC vòng này) |
| 5 | Ngoài phạm vi vòng này | ✓ | `PRD.md §5` |
| 6 | AC chi tiết | ✓ | `PRD.md §3`, `PROTOTYPE.md §3`, `SOLUTION.md B1` |
| 7 | Luồng người dùng | ✓ | `ARCHITECTURE.md §7`, `PROTOTYPE.md §2` |
| 8 | Màn hình | ✓ nếu `UI vòng này: có màn mới` | `PROTOTYPE.md §1–§2`, `DESIGN-SYSTEM.md` (component mới) |
| 9 | Thay đổi theo target | ✓ | `SOLUTION.md B1–B2`, `ARCHITECTURE.md §8` |
| 10 | Contract delta | ✓ | `ARCHITECTURE.md §5`, `BACKWARD-COMPATIBILITY-CHECKLIST.md §1` |
| 11 | Dữ liệu & migration | ✓ | `ARCHITECTURE.md §6`, `SOLUTION.md B2` |
| 12 | Luật nghiệp vụ, mặc định & giới hạn | ✓ | `SOLUTION.md A3 / B1`, `PRD.md §7` |
| 13 | Ca biên & lỗi | ✓ | `ARCHITECTURE.md §6` (ca biên), `SOLUTION.md B1` |
| 14 | Quyền & bảo mật | ✓ | `PERSONAS.md §2`, `PRODUCTION-READY.md` nhóm 2 |
| 15 | Phi chức năng | khi có | `SOLUTION.md A4` |
| 16 | Phụ thuộc ngoài & việc của Authority | ✓ | `PRD.md §7`, `ARCHITECTURE.md §9`, câu "hỏi thật" ở pha V |
| 17 | Quyết định & câu hỏi mở | ✓ | `DECISIONS.md` (≥2 dòng của vòng), câu hỏi pha V |
| 18 | Kế hoạch test | ✓ | `SOLUTION.md B1` cột Kiểm chứng, `make test` |
| 19 | Gợi ý dogfood | ✓ | `DOGFOOD-PLAN.md §1–§3` |
| 20 | Rủi ro & thứ tự cắt | ✓ | `SOLUTION.md A5` |
| 21 | Thứ tự triển khai | ✓ | pha I (`/viper-implement`) |
| 22 | Định nghĩa xong | ✓ | gate I + kiểm cuối vòng |
| 23 | Phụ thuộc vòng trước | ✓ | `ROADMAP.md §1` cột Phụ thuộc |
| 24 | Legacy được phép phá | ✓ | `BACKWARD-COMPATIBILITY-CHECKLIST.md` — một trong ba nơi hợp lệ để Authority cho phá |
| 25 | Điều chỉnh khi mở vòng | ✓ | vết của lần rà lại — không sửa lén rồi im |

---

## Khung (copy từ dòng dưới)

```markdown
NGUỒN: KẾ HOẠCH VÒNG — lập ở vòng 1 ngày {{ISO}}, từ intake/ROADMAP.md §2 + intake/PRD.md §3–§4
Pha vòng này: {{V, I | V, I, P | V, I, P, E, R | …}}
Thời lượng dự kiến: {{ví dụ: 1 tuần — theo cadence của wave tương ứng}}
UI vòng này: {{có màn mới | không có màn mới}}
Rà lại vòng {{N}}:

# Vòng {{N}} — {{tên vòng ngắn, theo góc nhìn người dùng}} (Phase {{MVP | Phase 2 | …}})

## 1. Mục tiêu vòng

{{Một đoạn: sau vòng này người dùng làm được gì mà trước đó chưa làm được. Viết theo góc người
dùng, không theo module.}}

**Giả thuyết chạm tới**: {{H-n trong intake/PRD.md §6, hoặc "—"}}

## 2. Kịch bản demo cuối vòng

Đi đúng các bước này trên sản phẩm của vòng — `make dev` với hồ sơ seed {{tên hồ sơ seed}}, hoặc
production nếu vòng khai `P` — là coi như vòng đạt. Kịch bản này dùng lại ở ba nơi: dòng smoke hồi quy
của vòng (`DOGFOOD-PLAN.md §3`), §22 Định nghĩa xong, và **video demo cuối vòng** quay ở pha R
(`context/DEMOS.md`, `/viper-repeat` Bước 2) — mỗi bước một chương video. Viết sao cho quay được: thao
tác cụ thể, thứ thấy trên màn hình, dữ liệu seed có sẵn. Mọi AC ở §6 có mặt ít nhất ở một bước; AC chỉ
test bắt được thì ghi bước `ngoài video` kèm tên test.

| Bước | Người dùng làm | Thấy gì (quan sát được) | AC |
|---|---|---|---|
| 1 | {{…}} | {{…}} | {{AC-n}} |

## 3. Cỡ vòng

**{{cỡ — điểm hoặc ngày công, theo đơn vị ước lượng chốt ở vòng 1}}** (trung bình kế hoạch {{…}} ·
biên cho phép {{±20%}} · lệch {{±n%}}) — nguồn ước lượng: {{DECISIONS ngày … · intake/ROADMAP.md §…}}.

| Phần | Cỡ |
|---|:--:|
| {{CAP-… (phần)}} | {{n}} |

## 4. Phạm vi — capability giao ở vòng này

Giữ nguyên mã `CAP-…` của intake để truy vết ngược. Cột "Target" trỏ thư mục code theo
`context/ARCHITECTURE.md §1–§3`.

| Capability | Persona | Target | AC (xem §6) |
|---|---|---|---|
| `{{CAP-…}}` — {{mô tả ngắn; ghi "(phần …)" nếu giao từng phần}} | {{P-…}} | `srcroot/{{nhóm}}/{{tên}}` | {{AC-1, AC-2}} |

## 5. Ngoài phạm vi vòng này

Thứ dễ bị hiểu là "tiện làm luôn" nhưng KHÔNG làm ở vòng này.

| Không làm | Vì sao | Để vòng |
|---|---|---|
| {{…}} | {{…}} | {{L-n | backlog}} |

## 6. AC chi tiết

Mỗi AC một dòng. "Thì" phải quan sát được: thấy trên màn, đọc được trong DB/log, hoặc test bắt được.
AC thật chốt ở `context/PRD.md §3` trong pha V của vòng này, và phải truy được về đúng capability qua
`context/CAPABILITIES-MAP.md`.

| AC | Capability | Cho trước | Khi | Thì | Kiểm bằng |
|---|---|---|---|---|---|
| AC-1 | `{{CAP-…}}` | {{trạng thái ban đầu}} | {{hành động}} | {{kết quả quan sát được}} | {{unit · integration · e2e · dogfood vai …}} |

<!-- Ví dụ: AC-4 | CAP-BOOK-02 | khung 9:00 thứ Hai đã kín | khách bấm Đặt vào đúng khung đó |
     báo "Khung giờ đã kín", không tạo lịch; bảng bookings không thêm dòng | integration + dogfood concurrent -->

## 7. Luồng người dùng

### 7.1 Luồng chính — {{persona}}: {{tên luồng}}

1. {{bước}}
2. {{bước}}

**Nhánh phụ / lỗi**: {{bước nào rẽ, rẽ đi đâu}}

<!-- Luồng nhiều bước, nhiều boundary: thêm một khối mermaid (flowchart hoặc sequenceDiagram).
     Nhãn có ký tự đặc biệt đặt trong ngoặc kép; render thử trước khi chốt. -->

## 8. Màn hình

| S# | Màn | Persona | Vào từ đâu | Thông tin bắt buộc (theo ưu tiên) | Hành động chính | Rỗng · đang tải · lỗi · không quyền | AC |
|---|---|---|---|---|---|---|---|
| S{{n}} | {{tên}} | {{P-…}} | {{menu / nút / link}} | {{…}} | {{…}} | {{4 trạng thái}} | {{AC-n}} |

- **Điều hướng vòng này**: {{mục menu / tab hiện thêm hoặc đổi, hoặc "—"}}
- **Component mới cần có trong design system**: {{… hoặc "—"}}
- **Chuỗi hiển thị / i18n**: {{namespace + ngôn ngữ phải đủ, hoặc "—"}}

## 9. Thay đổi theo target

### 9.1 `{{target}}`

| Module / thư mục | Việc | Không được làm |
|---|---|---|
| `{{src/…}}` | {{…}} | {{ranh giới — ví dụ: không đọc thẳng DB của target khác, không gọi vòng qua contract}} |

**Biến môi trường / cấu hình mới**: {{tên — ý nghĩa — mặc định, hoặc "—"}} (thêm TÊN vào `deployment/.env.example`)

## 10. Contract delta

| Contract | Endpoint · event · tool | Mới / sửa / bỏ | Vào (trường chính) | Ra (trường chính) | Lỗi trả về | Tương thích ngược |
|---|---|---|---|---|---|---|
| `{{contract}}` | {{METHOD /path · event.name · tool_name}} | {{…}} | {{…}} | {{…}} | {{mã — khi nào}} | {{giữ / phá (có trong §24)}} |

<!-- Ví dụ: booking-api.v1 | POST /bookings | mới | customerId, slotId | bookingId, status |
     409 khung đã kín · 403 không phải chủ gara | — (contract mới) -->

## 11. Dữ liệu & migration

| DB / schema | Bảng | Mới / sửa | Trường · index · ràng buộc | Migration & dữ liệu cũ |
|---|---|---|---|---|
| `{{DB / schema}}` | {{…}} | {{…}} | {{…}} | {{cách di trú, hoặc "bảng mới"}} |

**Seed cho dev, dogfood & demo**: {{dữ liệu mẫu cần có trong `deployment/local/` — tài khoản thử, bản
ghi mẫu…; kịch bản §2 và video demo chạy trên đúng hồ sơ này}}

## 12. Luật nghiệp vụ, mặc định & giới hạn

| Luật | Mặc định | Chỉnh ở đâu | Vi phạm thì | Thông điệp người dùng thấy |
|---|---|---|---|---|
| {{…}} | {{…}} | {{màn cài đặt · hồ sơ · cố định}} | {{chặn / cảnh báo / dừng}} | {{"…"}} |

## 13. Ca biên & lỗi

| Ca | Kích hoạt khi | Hệ thống làm gì | Người dùng thấy gì |
|---|---|---|---|
| {{…}} | {{…}} | {{…}} | {{…}} |

## 14. Quyền & bảo mật

- **Dòng ma trận `context/PERSONAS.md §2` vòng này chạm**: {{…}}
- **Ca ✗ mới phải kiểm (vai `breaker`)**: {{…}}
- **Bí mật mới**: {{loại — nơi cất — ai đọc, hoặc "—"}}
- **Đầu vào không tin cậy mới**: {{nguồn — cách bọc/chặn, hoặc "—"}}

## 15. Phi chức năng

| Hạng mục | Mức yêu cầu | Đo bằng |
|---|---|---|
| {{độ trễ · chi phí/lượt · bộ nhớ · dung lượng · log}} | {{số}} | {{…}} |

**Sự kiện đo mới** (`PRODUCTION-READY.md` nhóm 4): {{tên event — khi nào ghi, hoặc "—"}}

## 16. Phụ thuộc ngoài & việc của Authority

| Thứ cần | Ai chuẩn bị | Trước khi | Tốn tiền / đăng ký dịch vụ? | Không có thì |
|---|---|---|---|---|
| {{tài khoản thử · OAuth client · API key · chứng chỉ}} | {{Authority / meta}} | {{pha V / ngày n của pha I}} | {{có → hỏi thật ở pha V}} | {{…}} |

## 17. Quyết định & câu hỏi mở

| # | Loại | Nội dung | Phương án đề xuất | Ai chốt | Đảo ngược được? |
|---|---|---|---|---|---|
| D-1 | đã chốt | {{…}} | — | {{Authority ngày … / meta}} | {{có / không}} |
| Q-1 | câu hỏi mở | {{…}} | {{…}} | {{Authority ở pha V / meta tự quyết + DECISIONS}} | {{…}} |

## 18. Kế hoạch test

| Lớp | Phủ gì | Công cụ (theo `context/TECHSTACK.md`) |
|---|---|---|
| unit | {{luật §12, hàm thuần}} | {{…}} |
| integration | {{API + DB của từng boundary}} | {{…}} |
| contract | {{§10 — producer và consumer cùng schema}} | {{…}} |
| e2e | {{kịch bản §2}} | {{…}} |

<!-- Thêm lớp riêng của dự án nếu có — ví dụ sản phẩm gọi LLM: kịch bản trả lời cố định qua adapter
     LLM giả, để test không tốn tiền và không chập chờn. -->

## 19. Gợi ý dogfood

| Vai | Bật vì | Persona | Kịch bản vòng này | Hồ sơ dữ liệu |
|---|---|---|---|---|
| `smoke` | luôn bật | {{P-…}} | §2 + smoke hồi quy các vòng trước | {{…}} |
| `{{vai}}` | {{tín hiệu}} | {{P-…}} | {{…}} | {{…}} |

**Dòng smoke hồi quy thêm từ vòng này**: {{luồng / AC sẽ phải sống mãi về sau}}

## 20. Rủi ro & thứ tự cắt

| Rủi ro | Dấu hiệu sớm | Phòng | Nếu xảy ra |
|---|---|---|---|
| {{…}} | {{…}} | {{…}} | {{…}} |

**Thứ tự cắt nếu vượt biên hoặc trễ**: 1. {{…}} → 2. {{…}} (phần bị cắt ghi `context/ROADMAP.md` + §25)

## 21. Thứ tự triển khai

Lát cắt dọc — mỗi bước chạy được end-to-end, không làm hết backend rồi mới làm UI.

| Bước | Lát cắt | Target chạm | Cỡ | Xong khi |
|---|---|---|:--:|---|
| 1 | {{…}} | {{…}} | {{n}} | {{AC-n đạt / demo bước k của §2}} |

<!-- Ví dụ: 1 | scaffold target + make dev/check/migrate + health | api, web | 3 | make dev mở được trang trống có điều hướng
           2 | đặt lịch → xem lịch tuần | api, web | 7 | AC-1, AC-3 · demo bước 1–2 của §2 -->

## 22. Định nghĩa xong

- [ ] Mọi AC ở §6 đạt, kiểm bằng đúng cách ghi ở cột "Kiểm bằng"
- [ ] Kịch bản §2 chạy trọn trên hồ sơ seed mới tinh
- [ ] `make check` + `make test` xanh; migration chạy được trên DB của vòng trước
- [ ] Dogfood theo §19 (`smoke` đầu + cuối), phát hiện đã xử hoặc đã ghi
- [ ] Contract §10 đã cập nhật ở `context/ARCHITECTURE.md §5` và nơi producer khai contract
- [ ] Video demo kịch bản §2 đã quay, ghi `context/DEMOS.md` mục `## Vòng {{N}}` (pha R — `gate.py R`)
- [ ] {{điều kiện riêng của vòng}}

## 23. Phụ thuộc vòng trước

Thứ vòng này cần mà vòng trước phải giao xong. Không có thì ghi `—`.

| Cần gì | Từ vòng | Hỏng thì sao |
|---|---|---|

## 24. Legacy được phép phá

Mặc định vòng mới **không được phá** thứ người dùng đang xài
(`context/BACKWARD-COMPATIBILITY-CHECKLIST.md`). Không ghi ở đây (hay ở hai nơi hợp lệ kia) thì meta
phải giữ tương thích.

| Phá gì | Ai/dữ liệu đang dùng | Đường di trú |
|---|---|---|

## 25. Điều chỉnh khi mở vòng

| Ngày | Đổi gì | Vì sao |
|---|---|---|
```

---

## Ba luật của `_PROPOSAL.md`

1. **Meta soạn, Authority sửa.** File này do meta sinh ở vòng 1 từ tài liệu intake. Authority sửa thẳng
   vào đây, hoặc thả một `.md` thường vào cùng thư mục — meta đọc cả hai, và ghi chỗ lệch vào
   `## 25. Điều chỉnh khi mở vòng`.
2. **Đổi kế hoạch thì đổi cả hai chỗ.** `context/ROADMAP.md §1` và `_PROPOSAL.md` phải khớp nhau —
   `gate.py V` vòng 1 đối chiếu số dòng kế hoạch với số `_PROPOSAL.md` có thật. Thêm vòng ngoài kế
   hoạch cũng đi đúng đường này.
3. **Đóng băng sau khoá scope của vòng đó.** Khoá scope vòng N xong thì `l<N>/` không sửa nữa; muốn đổi
   ý giữa vòng là ngoài scope → `context/ROADMAP.md` chờ vòng sau.

**Legacy được phép phá — ba nơi hợp lệ.** §24 của file này là một; hai nơi kia là file `.md` Authority
thả vào cùng thư mục, và chốt qua chat ở pha V (meta ghi hộ vào thư mục này). Ngoài ba nơi đó thì không
có chỗ nào chốt được chuyện phá legacy — `guard_bc` chặn deploy đúng chỗ.
