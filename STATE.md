# STATE — hugremote

> Trạng thái sống. Người và agent cùng đọc/ghi. Cập nhật ngay khi đổi pha hoặc tick gate.

```
Pha hiện tại : I
Vòng          : 3
Vòng mở       : 2026-11-24
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
- [ ] (vòng 1 — intake, thay dòng trên, `VIPER.md §1.3`) `intake/PRD.md` render thật · `INTERVIEW.md` mang `NGUỒN: INTAKE` + bảng truy vết · `context/CAPABILITIES-MAP.md` đã tách
- [ ] (vòng 1 — intake) **kế hoạch vòng** (`VIPER.md §1.4`): `ROADMAP.md §1` có bảng chia vòng, mỗi dòng có `intake/loops/l<N>/_PROPOSAL.md` tương ứng
- [ ] (vòng ≥2 — phỏng vấn; thay hai dòng INTERVIEW; INTERVIEW đóng băng) `intake/loops/l<N>/` có ≥1 tài liệu vòng thật từ Authority — đồng thời là chữ ký chốt — *không áp: đường intake vòng 1*
- [x] (vòng ≥2 — intake; thay dòng trên) `l<N>/_PROPOSAL.md` thật (có `Pha vòng này`) + dòng `Rà lại vòng N: <ISO>` ngày ≥ `Vòng mở`
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
- [ ] Challenge PASS (ghi ở §Challenge log dưới)
- [ ] `make dev` · `make check` · `make migrate` đã hiện thực
- [ ] Đã có commit code ngoài commit khởi tạo
- [ ] Luồng lõi end-to-end bấm được ở local
- [ ] `make check` xanh
- [ ] `/viper-dogfood` xong theo `context/DOGFOOD-PLAN.md` — meta tự dùng + mọi vai bật (`smoke` đầu + cuối), kết quả ghi §4, phát hiện đã xử hoặc đã ghi

**P1 — sẵn sàng deploy lần đầu** (`gate.py P1`)
- [ ] (intake) Vòng này có khai `P` trong `_PROPOSAL.md`? **Có** — vòng 3: `V, I, P (chỉ P1)` → chạy P1
- [ ] `context/PRODUCTION-READY.md` 4 nhóm xanh, **trừ** mục gắn `(sau deploy)`
- [ ] Vòng ≥2: `BACKWARD-COMPATIBILITY-CHECKLIST.md §3` xanh
- [ ] `make test` · `make deploy` · `make doctor` đã hiện thực
- [ ] `make check && make test` xanh
- [ ] Phép thử phân quyền A↛B đã chạy ở local — dogfood `breaker` 28/28 route (1 lỗ hổng 2FA vá) + review pha P1 tìm thêm 1 lỗ hổng WS terminal (vá + test hồi quy) + `core-flow.e2e.mjs` (member↛owner)

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
| 2026-11-22 | I | Trước khi hoàn thiện AC-20/21/13: agent con (`parent_tool_use_id`) phát stream song song + gọi `AskUserQuestion`, người dùng bấm `⌥Y` hoặc hai thiết bị trả lời cùng lúc thì xử lý thế nào? | PASS | Normalizer tách `blocks`/`assistantId` theo `parentId` để không trộn stream chính và gắn `parentId` để ChatView lồng trong thẻ cha (chế độ gọn gộp chung). `AskUserQuestion` bắt chọn phương án (C21 không chọn hộ): `⌥Y` và ✓ nhanh ở chuông/askbar không gửi allow rỗng; API chặn `allow` thiếu `answers` (400). Hai thiết bị trả lời cùng lúc → `pending.delete` đầu tiên thắng, người sau 409 `INTERACTION_ALREADY_ANSWERED` |
| 2026-11-23 | P1 | Trước checklist production-ready: member biết `sessionId` terminal hoặc `hostId` của owner (đoán hoặc nhìn thấy trong URL/log mạng) — có bao nhiêu đường chạm được vào đó mà KHÔNG qua kiểm chủ sở hữu, tính cả đường không lộ ở UI (WS mở trực tiếp, route browse dùng cho tạo dự án)? | FAIL lúc đầu → PASS sau vá | Soi ra 2 đường thủng thật: (1) `terminal.gateway.ts` ghi phím vào PTY TRƯỚC khi `attach()` xác nhận chủ phiên — đã vá (đệm hàng đợi, xả sau khi attach OK) + `terminal.gateway.spec.ts`; (2) `GET /hosts/:id/browse` không có `@Roles(OWNER)` — member duyệt được toàn bộ cây thư mục mọi máy, đã vá + test ở `core-flow.e2e.mjs`. Cả hai không bị `breaker` dogfood (click tay) bắt được — chỉ lộ qua review tĩnh đọc code |
| 2026-11-23 | V | Electron desktop app khởi động khi cổng 8099 bị ứng dụng khác chiếm thì xử lý thế nào, và làm sao ngăn trình duyệt khác trên máy đánh cắp secret cookie loopback? | PASS | Electron dò tìm port trống tiếp theo và truyền cổng vào child process qua env; loopback cookie sinh ngẫu nhiên 32-byte per-launch, chỉ gán cho session của BrowserWindow trong Electron và backend chỉ chấp nhận kết nối từ 127.0.0.1 khớp secret |
| 2026-11-23 | I | Electron main process spawn child process API trên macOS như thế nào để nạp đủ PATH người dùng khi mở từ Finder/Spotlight, và chống orphan process khi app thoát đột ngột? | PASS | Nạp environment PATH từ shell người dùng qua shellEnv trước khi spawn API; gắn listener exit/SIGINT và pipe stdin giám sát, child process tự thoát sau 2s nếu mất kết nối IPC hoặc mất pipe cha |
| 2026-11-24 | V | Sau khi mở lại app, tab tmux trỏ tới session đã bị kill bên ngoài, trong lúc tab khác cũng muốn gắn cùng session — server làm gì, người dùng thấy gì? | PASS | ARCHITECTURE §6 (vòng 3): `tmux new-session -A` tạo lại rỗng cùng tên + dải "đã bị đóng bên ngoài"; menu + bấm session đang mở → chuyển tới tab đó, không mở tab thứ hai; SOLUTION B1 AC-55 |
| 2026-11-24 | V | Sửa cổng đích của một chuyển tiếp đang có `curl` chạy qua, cổng mới lại bị app khác chiếm — mất chuyển tiếp cũ không? | FAIL lúc đầu → PASS sau vá | SOLUTION B1 AC-57 ghi "dừng cũ rồi mở mới, lỗi thì giữ cũ" — tự mâu thuẫn. Vá: mở listener mới trước, thành công mới đóng cũ; lỗi → 409, giữ nguyên (SOLUTION B1 + ARCHITECTURE §6) |
| 2026-11-24 | V | Mở link sâu `#/s/…/web/w1` của phiên trình duyệt từ điện thoại (web thường) thì thấy gì? | FAIL lúc đầu → PASS sau vá | Tài liệu chỉ nói ẩn mục *Trình duyệt mới*, không nói phiên `web` đã có hiện ra sao ngoài desktop. Vá: không hiện ở thanh Phiên/cây/chuyển nhanh; link sâu → errorBox + nút về tab Phiên (ARCHITECTURE §6, SOLUTION B1 AC-59; theo Q-8) |
| 2026-11-24 | V | Đang gõ tiếng Việt bằng bộ gõ (IME) trong Claude CLI, bấm ⌘C không có vùng chọn — có lỡ dừng Claude không? | PASS | `_PROPOSAL.md §13`: `isComposing` → handler không chặn; ngoài IME, ⌘C không vùng chọn gửi Ctrl+C là hành vi Authority chốt (Q-3); DECISIONS 2026-11-24 (bảng phím chỉ áp trên Mac) |
| 2026-11-24 | V | Member (SSO) có tạo được chuyển tiếp cổng hay phiên tmux, và nếu gọi thẳng API thì sao? | PASS | `_PROPOSAL.md §14` + G-17: chuyển tiếp/listening-ports owner-only → 403; member dùng tmux/terminal chỉ trong phiên của mình (G-13); breaker kiểm ở DOGFOOD-PLAN §2 đợt 3 |
| 2026-11-25 | I | Lát 1 (AC-53) trước khi code: trong app desktop, ⌘C có tới được `attachCustomKeyEventHandler` của xterm không, và vì sao hiện tại bôi đen nội dung Claude CLI rồi ⌘C không chép được? | PASS | Menu Electron (`apps/desktop/src/main.ts:88`) gán `role:'copy'` cho ⌘C → phím bị menu nuốt trước trang, chỉ phát sự kiện `copy` tới phần tử đang focus. xterm vốn tự chép vùng chọn khi có `copy`; lỗi thật là Claude CLI bật bắt chuột nên kéo không tạo được vùng chọn và Mac chỉ ép chọn được bằng ⌥ khi bật `macOptionClickForcesSelection`. Hệ quả code: bật cờ đó; bắt `copy` ở capture — không có vùng chọn thì gửi `\x03`; không bật `macOptionIsMeta` (hỏng ký tự gõ bằng Option); phím ⇧↵/⌥/⌘ còn lại qua custom key handler |
| 2026-11-25 | I | Lát 2–3 (AC-54/55/56) trước khi code: `PtyManager` tự kill PTY không người xem (`reap`) và `onExit` → `markExited` đánh `exited`; phiên tmux để lâu không mở có bị đánh "đã kết thúc" dù session còn sống không? | PASS | Có, nếu giữ logic cũ. Hệ quả code: `markExited` của phiên có `tmux_name` chạy `tmux has-session -t =<tên>` — còn thì giữ `running` (chỉ tách); `markAllExited` lúc khởi động bỏ qua phiên tmux; `attach` mở PTY lười (`tmux new-session -A`). E2E `round3.e2e.mjs` kiểm qua restart API, cùng shell |

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
