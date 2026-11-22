# STATE — hugremote

> Trạng thái sống. Người và agent cùng đọc/ghi. Cập nhật ngay khi đổi pha hoặc tick gate.

```
Pha hiện tại : I
Vòng          : 1
Phase         : MVP · mở ở vòng 1
Đường vào     : intake
Pha vòng này  : V, I, P (chỉ P1)
Ngày          : D1
Stack         : stack-nestjs-react-fullstack (lệch: SQLite, Vite) — monorepo srcroot/boundaries/hugremote
URL local     : (chưa có)
URL production: (chưa có)
```

> **Vòng** = một lượt V→I→(P)→(E)→(R). Vòng mới mở bằng `python3 scripts/repeat.py --go`
> (xem `/viper-repeat`) — không code tiếp trên vết vòng cũ. Từ vòng 2, script chèn thêm
> dòng `Vòng mở: <ngày>` — challenge của gate chỉ tính dòng có ngày từ đó trở đi (tài liệu
> không reset, hàng rào đếm theo vòng — `VIPER.md §1.2`).
>
> **Phase** = giai đoạn sản phẩm (MVP, Phase 2…) — gồm một hay nhiều vòng; KHÁC "pha" V/I/P/E/R
> của một vòng. Vòng đầu của mỗi Phase lập giải pháp tổng thể (`context/SOLUTION.md` phần A,
> Authority chốt); mọi vòng làm giàu giải pháp chi tiết (phần B). Mở Phase mới:
> `python3 scripts/repeat.py --go --phase "Phase 2"` (đường intake: tự đọc cột Phase ở `ROADMAP.md §1`).
>
> **Đường vào** quyết định ràng buộc nào áp (`VIPER.md §0`) — nguồn sự thật là marker
> `NGUỒN: INTAKE` trong `context/INTERVIEW.md`; dòng ở đây chỉ để người đọc thấy nhanh.
>
> **Pha vòng này**: đường phỏng vấn luôn đủ 5 pha. Đường intake lấy theo dòng `Pha vòng này`
> của `intake/loops/l<N>/_PROPOSAL.md` — V và I bắt buộc, P/E/R chỉ ở vòng Authority chốt
> (`VIPER.md §1.4`); `gate.py` bỏ qua gate của pha không khai.

---

## Gate

> Bản thao tác. Định nghĩa chuẩn ở `VIPER.md §1.1` — lệch nhau thì sửa chỗ này cho khớp (luật #4).

**V — Validate**
- [x] `context/PRD.md`: pain point + đối tượng cụ thể
- [x] `context/PRD.md`: AC — phỏng vấn 3–7 · intake ≥3 không trần, mọi AC có mặt ở `CAPABILITIES-MAP.md`
- [x] `context/PRD.md`: out-of-scope tường minh
- [x] `context/PRD.md`: 1 success metric có số
- [ ] (vòng 1 — phỏng vấn) `context/INTERVIEW.md`: 14 mục, mỗi mục có dòng `Bằng chứng:` — *không áp: đường intake vòng 1*
- [x] (vòng 1 — intake, thay dòng trên, `VIPER.md §1.3`) `intake/PRD.md` render thật · `INTERVIEW.md` mang `NGUỒN: INTAKE` + bảng truy vết · `context/CAPABILITIES-MAP.md` đã tách
- [x] (vòng 1 — intake) **kế hoạch vòng** (`VIPER.md §1.4`): `ROADMAP.md §1` có bảng chia vòng, mỗi dòng có `intake/loops/l<N>/_PROPOSAL.md` tương ứng
- [ ] (vòng ≥2 — phỏng vấn; thay hai dòng INTERVIEW; INTERVIEW đóng băng) `intake/loops/l<N>/` có ≥1 tài liệu vòng thật từ Authority — đồng thời là chữ ký chốt — *không áp: đường intake vòng 1*
- [ ] (vòng ≥2 — intake; thay dòng trên) `l<N>/_PROPOSAL.md` thật (có `Pha vòng này`) + dòng `Rà lại vòng N: <ISO>` ngày ≥ `Vòng mở` — *không áp: đường intake vòng 1*
- [x] `context/PERSONAS.md`: persona + năng lực được cấp + ma trận vai × hành động
- [x] `context/TECHSTACK.md` chốt + 1 dòng lý do trong `DECISIONS.md`
- [x] `context/DECISIONS.md`: ≥2 quyết định của vòng này (vòng ≥2: dưới mốc `(vòng N)`, ngày ≥ `Vòng mở`)
- [x] `context/ARCHITECTURE.md` (sơ đồ + mô hình dữ liệu + luồng lõi; intake: thêm boundary/experience + contract)
- [x] Design system: có UI → `context/DESIGN-SYSTEM.md` chốt **trước** prototype (token dùng thật · không dùng token ngoài bảng · tương phản AA · component có màn dùng · khớp gói `intake/design-systems/` nếu có) · backend-only → marker `KHÔNG CÓ UI`
- [x] Prototype: có UI → file tương tác **từ token/component đã chốt** (`prototype/index.html`, hoặc `prototype/<experience>/index.html` ở đường intake) + mọi màn khai ở `PROTOTYPE.md §1` đã dựng + **Authority đã chốt** (`PROTOTYPE.md §5`) · backend-only → marker `KHÔNG CÓ UI` · intake vòng ≥2 khai `UI vòng này: không có màn mới` → bỏ qua
- [x] **Bộ giải pháp** (`context/SOLUTION.md`): Phase khớp dòng `Phase` ở trên · phần A đủ A1–A5 + `Authority chốt Phase` (vòng đầu Phase: Authority vừa chốt) · phần B đúng vòng này, mỗi AC một dòng giải pháp
- [x] `context/DOGFOOD-PLAN.md` của vòng này: mọi vai danh mục có bật/tắt + căn cứ · `smoke` luôn bật, đợt 0 · đợt ≤3 vai · mỗi vai một tài khoản · §3 smoke hồi quy
- [x] Challenge pha V **PASS** (§Challenge log) — tài liệu trả lời được 3–5 câu khó nhất
- [x] **Scope khoá** — từ đây không hỏi Authority nữa

**I — Implement**
- [x] Challenge PASS (ghi ở §Challenge log dưới)
- [ ] `make dev` · `make check` · `make migrate` đã hiện thực
- [ ] Đã có commit code ngoài commit khởi tạo
- [ ] Luồng lõi end-to-end bấm được ở local
- [ ] `make check` xanh
- [ ] `/viper-dogfood` xong theo `context/DOGFOOD-PLAN.md` — meta tự dùng + mọi vai bật (`smoke` đầu + cuối), kết quả ghi §4, phát hiện đã xử hoặc đã ghi

**P1 — sẵn sàng deploy lần đầu** (`gate.py P1`)
- [ ] (intake) Vòng này có khai `P` trong `_PROPOSAL.md`? Không → bỏ qua cả nhóm P1/P2, đi thẳng `/viper-repeat`
- [ ] `context/PRODUCTION-READY.md` 4 nhóm xanh, **trừ** mục gắn `(sau deploy)`
- [ ] Vòng ≥2: `BACKWARD-COMPATIBILITY-CHECKLIST.md §3` xanh — hook `guard_bc` chặn deploy tới khi xanh
- [ ] `make test` · `make deploy` · `make doctor` đã hiện thực
- [ ] `make check && make test` xanh
- [ ] Phép thử phân quyền A↛B đã chạy ở local

**P2 — production đã sống** (`gate.py P2`)
- [ ] 4 nhóm xanh **toàn bộ**, kể cả mục `(sau deploy)`
- [ ] `context/shared/DEPLOY.md` đủ §1–§5, có rollback (điền TRƯỚC lần deploy đầu)
- [ ] Production sống, health check 200, smoke test pass
- [ ] Đã **thử** rollback một lần
- [ ] `/viper-dogfood` lần 2 trên production — tối thiểu `smoke` đi hết `DOGFOOD-PLAN.md §3` (ghi §4, Nơi = `production`)

**E — Evaluate**
- [ ] (intake) Vòng này có khai `E` trong `_PROPOSAL.md`? Không → bỏ qua cả nhóm
- [ ] Tracking đang đếm
- [ ] Sổ EXPERIMENTS của vòng có số liệu thật (vòng 1: `EXPERIMENTS.md`; vòng N ≥2: `EXPERIMENTS-v<N>.md`)

**R — Repeat**
- [ ] Quyết định go / pivot / kill ghi ở `DECISIONS.md` (vòng không chạy E: bỏ qua — không có số liệu để quyết)
- [ ] **Video demo cuối vòng** (`VIPER.md §1.5`, mọi vòng kể cả vòng chỉ V+I): quay trọn kịch bản demo trên sản phẩm thật · `context/DEMOS.md` có mục `## Vòng N` · tệp ở `demos/vong-<N>/` · mọi AC có mặt · không bước `✗` — `gate.py R`
- [ ] `ROADMAP.md` cập nhật — backlog §3, và (intake) trạng thái vòng ở §1
- [ ] `python3 scripts/repeat.py --go` mở vòng mới (chạy `gate.py R` trước — đỏ thì từ chối) (xem `/viper-repeat` — không reset, chỉ sổ sách theo vòng)

---

## Challenge log

Meta ra câu hỏi khó dựa trên context, chấm PASS/FAIL. **Pha V**: 3–5 câu tài liệu chưa trả lời được, trước khi khoá scope — không trả lời được thì vá theo đúng chế độ đang đi (vòng 1 phỏng vấn: hỏi Authority tiếp · vòng 1 intake: dịch lại + vá lỗ hổng · vòng ≥2: đọc lại `intake/loops/l<N>/` + kết quả vòng trước). **Pha I trở đi**: trước mỗi mảng việc lớn, trước khi code. FAIL → đọc lại context, trả lời lại.

| Ngày | Pha | Câu hỏi | Phán quyết | Ghi chú |
|---|---|---|---|---|
| 2026-11-21 | V | Restart service giữa chừng thì phiên terminal đang chạy hiện ra sao, và người dùng có phải đăng nhập lại không? | PASS | ARCHITECTURE §6 `terminal_sessions` → `exited`; PRD AC-2 + DECISIONS (phiên terminal, refresh 14 ngày); l1 §2 bước 13 |
| 2026-11-21 | V | Người đã nhập đúng mật khẩu nhưng chưa qua 2FA gọi thẳng `GET /api/hosts` thì sao? | PASS | PERSONAS §2 cột "chưa qua 2FA" ✗; SOLUTION G-1; contract 403 `TWO_FACTOR_REQUIRED` (l1 §10) |
| 2026-11-21 | V | Sửa một máy khai trong file `Include` trong lúc file đó vừa bị sửa tay bên ngoài — ghi vào đâu, xử lý đụng độ thế nào? | PASS | ARCHITECTURE §6 (ghi đúng file chứa block; mtime đổi → 409 `SSH_CONFIG_CHANGED`); SOLUTION G-7; l1 §13 |
| 2026-11-21 | V | Nút "Thử kết nối" ở S3 khi đang gửi trông thế nào, bấm hai lần thì sao? | PASS | DESIGN-SYSTEM §4 C1 trạng thái "đang gửi (khoá, chữ Đang …)"; prototype S3; ARCHITECTURE §6 gửi hai lần |
| 2026-11-21 | V | Dogfood đòi mỗi vai một tài khoản trong khi vòng 1 chỉ có một tài khoản chủ — chạy song song 12 vai thế nào? | PASS | DECISIONS 2026-11-21 (mỗi vai một instance); DOGFOOD-PLAN §2 cổng 8101–8112; l1 §11 script instance |
| 2026-11-21 | V | Member mở WebSocket terminal của phiên owner bằng vé hợp lệ của chính mình thì sao? | PASS | PERSONAS §2 (✓ chỉ phiên của mình); SOLUTION G-13 (kiểm chủ phiên lúc đổi vé); ARCHITECTURE §5 terminal-ws.v1 |
| 2026-11-21 | V | Duyệt quyền Claude trên điện thoại trong khi desktop cũng bấm Từ chối cùng lúc — ai thắng, desktop thấy gì? | PASS | ARCHITECTURE §6 (trả lời đầu tiên thắng, 409 `INTERACTION_ALREADY_ANSWERED`); DESIGN-SYSTEM §4 C21 trạng thái "đã trả lời trên thiết bị khác" |
| 2026-11-21 | V | Claude sửa file trong lúc người dùng đang sửa cùng file ở tab Files rồi bấm Lưu? | PASS | ARCHITECTURE §6 sửa file đồng thời (`baseMtime` → 409 `FILE_CHANGED`); SOLUTION G-15; prototype S8 trạng thái lỗi |
| 2026-11-21 | V | Vòng ~30 ngày công trễ ở giữa thì cắt gì trước, cắt rồi đi đâu? | PASS | `l1/_PROPOSAL.md §20` thứ tự cắt (cập nhật → mic/hạn mức → lịch sử Git → SSO → sáng/en) → `ROADMAP.md §3` thành vòng 2 |
| 2026-11-22 | I | Lát 1–2 trước khi code: owner đang chạy phiên Claude A, member B (SSO) mở đúng URL phiên A rồi gửi tin trong lúc A đang `running` và lượt đó kết thúc bằng lỗi — server làm gì với tin của B, với hàng chờ của A, và B thấy gì? | PASS | B: G-13 → `POST /:id/messages` trả 403 `NOT_SESSION_OWNER` trước cả kiểm `running`; route web chặn về S2 (AC-33, AC-48). Hàng chờ của A: lượt lỗi → **không** tự gửi tin kế, hiện C5 + "Gửi tiếp" (SOLUTION B1 AC-40), tin vẫn nằm trong `claude_queue`. Hệ quả code: guard chủ phiên đặt ở service trước mọi nhánh, runner chỉ rút hàng chờ khi `finish` thành công |

---

## Blocker

Chặn cứng sau khi đã tự thử hết cách. Không hỏi giữa chừng — dồn vào đây, báo gộp cuối buổi.

| Ngày | Blocker | Đã thử gì | Trạng thái |
|---|---|---|---|
| | | | |

---

## Phát hiện từ dogfood chưa xử

Thứ tìm được khi dùng thử nhưng chưa sửa (nhỏ thì sửa ngay, ngoài scope thì đẩy `ROADMAP.md`).

| Ngày | Vai phát hiện | Vấn đề | Xử lý |
|---|---|---|---|
| | | | |
