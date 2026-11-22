# hugremote

_Một dòng: sản phẩm này giải quyết nỗi đau gì, cho ai. Điền sau pha V — nguồn: `context/PRD.md §1`._

Dựng theo quy trình **VIPER**: solo, một tuần, production-ready.
Luật và năm pha: [VIPER.md](VIPER.md) · Đang ở đâu: [STATE.md](STATE.md)

---

## Chạy

```bash
make dev      # chạy local (app + db)
make check    # lint + typecheck + build
make test     # smoke + luồng quan trọng
make migrate  # DB migration có version
make deploy   # đẩy lên PaaS
make doctor   # kiểm env + kết nối
```

Sáu lệnh này là hợp đồng chung. Phần thân điền ở pha I theo
`.claude/skills/stack-<tên>/SKILL.md §4`; stack đang dùng ghi ở `context/TECHSTACK.md`.

## Trạng thái

```bash
python3 scripts/gate.py     # gate của pha hiện tại còn thiếu gì
```

## Tài liệu

| File | Nội dung |
|---|---|
| [context/PRD.md](context/PRD.md) | Pain point · đối tượng · AC · out-of-scope · success metric |
| [context/INTERVIEW.md](context/INTERVIEW.md) | Sổ phỏng vấn pha V — 14 mục, mỗi mục có bằng chứng |
| [context/PERSONAS.md](context/PERSONAS.md) | Persona · năng lực được cấp · ma trận vai × hành động |
| [context/SOLUTION.md](context/SOLUTION.md) | Bộ giải pháp: tổng thể của Phase (Authority chốt) + chi tiết từng AC của vòng |
| [context/DOGFOOD-PLAN.md](context/DOGFOOD-PLAN.md) | Kế hoạch dogfood của vòng: vai nào bật, làm gì, smoke hồi quy, kết quả |
| [context/CAPABILITIES-MAP.md](context/CAPABILITIES-MAP.md) | Đường intake: bản đồ năng lực tách từ `intake/PRD.md §3` |
| [context/DESIGN-SYSTEM.md](context/DESIGN-SYSTEM.md) | Token · tương phản · kho component — nguồn sự thật cho hình thức |
| [context/PROTOTYPE.md](context/PROTOTYPE.md) | Bản đồ màn hình · map AC ↔ màn hình · vết Authority chốt prototype |
| [context/ARCHITECTURE.md](context/ARCHITECTURE.md) | Sơ đồ · mô hình dữ liệu · luồng lõi · ranh giới module |
| [context/TECHSTACK.md](context/TECHSTACK.md) | Stack + version đã chốt |
| [context/DECISIONS.md](context/DECISIONS.md) | Mọi quyết định, append-only |
| [context/ROADMAP.md](context/ROADMAP.md) | Tuần này + backlog Phase 2 |
| [context/shared/DEPLOY.md](context/shared/DEPLOY.md) | Nơi chạy · env · migration · **rollback** |

## Bắt đầu

```bash
claude
/viper-validate     # pha V — nơi DUY NHẤT được hỏi Authority
```

Có sẵn tài liệu MESH-render? Thả vào `intake/` (xem [intake/README.md](intake/README.md))
trước khi chạy `/viper-validate` — pha V sẽ đi **đường intake**: dịch tài liệu thay cho
phỏng vấn (`VIPER.md §1.3`).
# hugremote-context
