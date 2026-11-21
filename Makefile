# hugremote — hợp đồng lệnh VIPER
#
# Sáu lệnh dưới đây là giao diện chung của MỌI stack. Quy trình VIPER và scripts/gate.py
# chỉ gọi các lệnh này, không cần biết bên dưới là Next.js hay Spring Boot.
#
# Pha I: mở .claude/skills/stack-<tên>/SKILL.md §4 và điền phần thân cho từng target.
# Giữ nguyên TÊN target — đổi tên là phá hợp đồng, gate.py sẽ không chạy được.
#
# Artifact để CHẠY nằm ở deployment/, không rải ra gốc repo (deployment/README.md):
#   make dev  → docker compose -f deployment/local/docker-compose.yml up -d db
#   biến env  → deployment/.env.example (danh sách) · deployment/local/.env (giá trị)
# Đa target (đường intake): thân lệnh điều phối xuống `make -C srcroot/<nhóm>/<tên> …`;
# deploy LUÔN đi qua `make deploy` ở gốc — đó là chỗ hook guard_bc đứng.

.PHONY: help dev check test migrate deploy doctor gate

STACK_SKILL ?= chưa-chốt
PYTHON ?= python3

help:
	@echo "hugremote — VIPER"
	@echo ""
	@echo "  make dev      chạy local (app + db)"
	@echo "  make check    lint + typecheck + build"
	@echo "  make test     smoke + luồng quan trọng"
	@echo "  make migrate  DB migration có version"
	@echo "  make deploy   đẩy lên PaaS"
	@echo "  make doctor   kiểm env + kết nối, in cái gì thiếu"
	@echo ""
	@echo "  make gate     kiểm gate của pha hiện tại (hoặc: make gate P=I)"
	@echo ""
	@echo "Stack skill: $(STACK_SKILL)"

define NOT_IMPLEMENTED
	@echo ""
	@echo "  ✗ 'make $@' chưa được hiện thực."
	@echo ""
	@echo "  Pha I chưa xong. Mở .claude/skills/stack-<tên>/SKILL.md §4"
	@echo "  rồi điền phần thân cho target '$@' trong Makefile này."
	@echo ""
	@echo "  Stack đã chốt ở context/TECHSTACK.md: $(STACK_SKILL)"
	@echo ""
	@exit 1
endef

dev:
	$(NOT_IMPLEMENTED)

check:
	$(NOT_IMPLEMENTED)

test:
	$(NOT_IMPLEMENTED)

migrate:
	$(NOT_IMPLEMENTED)

deploy:
	$(NOT_IMPLEMENTED)

doctor:
	$(NOT_IMPLEMENTED)

# --- không đổi ---

gate:
	@$(PYTHON) scripts/gate.py $(P)
