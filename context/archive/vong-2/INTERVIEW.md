---
type: interview
tier: T1
status: ACTIVE
last_reviewed: "2026-11-21"
---

NGUỒN: INTAKE — render nhận ngày 2026-11-21

# INTERVIEW — hugremote (sổ dịch intake, vòng 1)

> Đường intake (`VIPER.md §1.3`): không phỏng vấn 14 mục. Nguồn hiểu sản phẩm là bộ tài liệu ở
> `intake/` (PRD, ARCHITECTURE, TECHSTACK, ROADMAP — không có gói design system). Sổ này ghi mục nào
> của `context/` lấy từ đâu, và lỗ hổng nào đã được vá ra sao. Từ vòng 2 file này đóng băng; marker
> ở dòng đầu giữ nguyên.

## Truy vết intake → context

| Mục context | Nguồn intake |
|---|---|
| `PRD.md §1` Pain point | `intake/PRD.md §1` (đoạn status quo + bảy điểm đau + nợ bảo mật) |
| `PRD.md §2` Đối tượng | `intake/PRD.md §2` (P-MOBILE, P-DESK, P-HOST, P-TEAM) |
| `PRD.md §3` AC vòng 1 | `intake/PRD.md §3` (30 capability) + `intake/ROADMAP.md §W1–§W6` (features_in_scope + exit_signal) |
| `PRD.md §4` Ưu tiên | `intake/PRD.md §4` + `intake/ROADMAP.md §2 Wave Inventory` |
| `PRD.md §5` Out-of-scope | `intake/PRD.md §5` + phần W2–W6 của `intake/ROADMAP.md` |
| `PRD.md §6` Metric | `intake/PRD.md §6` — H-1 (≤3 thao tác, AC-26), H-3, H-4, H-5 (pentest, AC-34) kiểm bằng test trong vòng 1; H-2 (dùng thay v1 ≥7 ngày) đọc ở pha R vòng 1 từ nhật ký dùng cục bộ; rủi ro R-1..R-3 → `EXPERIMENTS.md` |
| `PRD.md §7` Quyết định | `intake/TECHSTACK.md §1` (auth, lưu trữ) + `intake/ARCHITECTURE.md §6` + chốt của Authority ở pha V |
| `PERSONAS.md` | `intake/PRD.md §2` — giữ mã P-…; ma trận vai suy từ CAP-ACCESS-01..03, CAP-AI-07 |
| `CAPABILITIES-MAP.md` | `intake/PRD.md §3` — đủ 31 capability, giữ mã CAP-… |
| `TECHSTACK.md` | `intake/TECHSTACK.md §1–§2` — giữ nguyên Choice + Reason, khối "Sai khác so với skill" |
| `ARCHITECTURE.md §1–§3` | `intake/ARCHITECTURE.md §1–§3` (target `hugremote`, experience `hugremote`, không mobile native) |
| `ARCHITECTURE.md §4` | `intake/ARCHITECTURE.md §4` Topology |
| `ARCHITECTURE.md §5` | `intake/ARCHITECTURE.md §5` (11 contract api ↔ web) + bổ sung ở pha V (`files-watch.v1`, `events.v1`, tách terminal REST/WS, update, CLI) → 16 contract |
| `ARCHITECTURE.md §6` | `intake/ARCHITECTURE.md §1` (bảng SQLite) + §6 (ràng buộc kế thừa) |
| `ARCHITECTURE.md §7` | `intake/ARCHITECTURE.md §7` Luồng lõi |
| `ARCHITECTURE.md §8` | `intake/ARCHITECTURE.md §1` cây thư mục + `.claude/skills/stack-nestjs-react-fullstack §3` |
| `ROADMAP.md §1` + `intake/loops/l1/_PROPOSAL.md` | `intake/ROADMAP.md §2` (W1–W6 gộp làm vòng 1 theo Authority; thứ tự wave = thứ tự triển khai §21) |
| `SOLUTION.md` phần A | `intake/ARCHITECTURE.md §6` (giữ/sửa) + `intake/ROADMAP.md §Cadence` (rủi ro) + `intake/PRD.md §6` |
| `DESIGN-SYSTEM.md` | `intake/design-systems/hugremote/` (DESIGN-SYSTEM.md + tokens.json + components/ + screens/) — gói lập ở pha V từ chốt của Authority (Orca + màu HugRemote) và 7 lượt góp ý prototype, rồi thành hợp đồng; `context/DESIGN-SYSTEM.md` dịch trung thành (gate đối chiếu 53 token) |

## Lỗ hổng & cách xử

| Lỗ hổng | Cách xử |
|---|---|
| Chia mấy vòng | Hỏi Authority → "gộp vào thành 1 loop": một vòng giao toàn bộ 30 capability. DECISIONS 2026-11-21 (gộp 6 vòng) |
| Vòng nào deploy / đo / quyết (P/E/R) | Hỏi Authority → "chỉ chạy local nên chỉ chạy P1", P1 ở vòng 1. DECISIONS 2026-11-21 (kế hoạch 6 vòng) |
| `make deploy` khi không có PaaS | Tự quyết: cài user service trên máy local — DECISIONS 2026-11-21 (`make deploy` vòng 1) |
| Phong cách giao diện (không có gói design system) | Hỏi Authority → theo Orca, giữ phong cách HugRemote, mobile + desktop đều tốt. DECISIONS 2026-11-21 (Giao diện) |
| Tab Files mở ở đâu | Hỏi Authority → gốc dự án. DECISIONS 2026-11-21 (Tab Files) |
| 2FA vòng nào | Hỏi Authority → vòng 1. DECISIONS 2026-11-21 (2FA) |
| Tài khoản, mật khẩu khởi tạo, thời hạn phiên | Tự quyết — DECISIONS 2026-11-21 (Đăng nhập vòng 1) |
| Dogfood "mỗi vai một tài khoản" với sản phẩm một chủ | Tự quyết: mỗi vai một instance — DECISIONS 2026-11-21 (Dogfood) |
| Thu tiền | Không thu tiền — công cụ tự host miễn phí (`intake/PRD.md §1` không nhắc doanh thu) |
| Success metric + ngưỡng go/pivot/kill | Vòng 1 không chạy E → tiêu chí xong là AC; metric của Phase MVP ghi ở `PRD.md §6`, đo ở cuối vòng 1 (pha R) bằng nhật ký dùng của Authority (H-2) |
| Dữ liệu mẫu cho dogfood | Tự quyết: container SSH thử + jump host trong `deployment/local/`, thư mục dự án mẫu có repo git; `~/.ssh/config` mẫu có `Include` — ghi `PRD.md §7` |
| Phiên terminal khi restart service | Tự quyết — DECISIONS 2026-11-21 (Phiên terminal) |
| Mã hoá bí mật SSH | Tự quyết — DECISIONS 2026-11-21 (Bí mật SSH) |
| Chủ đề sáng | Có ngay vòng 1 sau khi gộp — DECISIONS 2026-11-21 (hai chủ đề) |
| IdP thử cho SSO, Claude CLI cho test | Tự quyết: Keycloak container + `fake-claude` phát fixture — `TECHSTACK.md §2` |
