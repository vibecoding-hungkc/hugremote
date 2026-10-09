#!/usr/bin/env bash
# ==============================================================================
#  🐴 HugRemote — Mobile-First Web IDE & Terminal Installer (BETA / Main Branch)
#  One-line install: curl -fsSL https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/main/beta.sh | bash
# ==============================================================================

set -e

# Colors
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_GREEN='\033[32m'
C_BLUE='\033[34m'
C_YELLOW='\033[33m'
C_RED='\033[31m'
C_CORAL='\033[38;5;209m'

echo -e "${C_CORAL}${C_BOLD}"
echo "  _    _             _____                      _       "
echo " | |  | |           |  __ \                    | |      "
echo " | |__| |_   _  __  | |__) |___ _ __ ___   ___ | |_ ___ "
echo " |  __  | | | |/ _\` |  _  // _ \ '_ \` _ \ / _ \| __/ _ \\"
echo " | |  | | |_| | (_| | | \ \  __/ | | | | | (_) | ||  __/"
echo " |_|  |_|\__,_|\__, |_|  \_\___|_| |_| |_|\___/ \__\___|"
echo "                __/ |                                   "
echo "               |___/               Mobile-First Web IDE "
echo -e "${C_RESET}"
echo -e "${C_BLUE}========================================================${C_RESET}"
echo -e "${C_BOLD} Bắt đầu cài đặt HugRemote Web IDE & Terminal (BETA)...${C_RESET}"
echo -e "${C_BLUE}========================================================${C_RESET}"
echo ""

# 1. Kiểm tra hệ điều hành
OS="$(uname -s)"
case "$OS" in
  Linux*)  PLATFORM="linux" ;;
  Darwin*) PLATFORM="macos" ;;
  *)       PLATFORM="unknown" ;;
esac

if [ "$PLATFORM" = "unknown" ]; then
  echo -e "${C_RED}❌ Hệ điều hành $OS chưa được hỗ trợ tự động. Vui lòng cài đặt thủ công qua npm.${C_RESET}"
  exit 1
fi

echo -e "✓ Phát hiện hệ điều hành: ${C_GREEN}$PLATFORM ($(uname -m))${C_RESET}"

# 2. Kiểm tra Node.js & npm
check_node_version() {
  if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
      return 0
    fi
  fi
  return 1
}

if ! check_node_version; then
  echo -e "${C_YELLOW}⚠️  Yêu cầu Node.js >= 18.x để chạy HugRemote.${C_RESET}"
  if command -v node >/dev/null 2>&1; then
    echo -e "   Phiên bản hiện tại: $(node -v) (không đủ điều kiện)"
  else
    echo -e "   Node.js chưa được cài đặt."
  fi
  echo ""
  echo -e "${C_BOLD}Vui lòng cài đặt hoặc nâng cấp Node.js qua:${C_RESET}"
  echo "  - NVM:   nvm install 20 && nvm use 20"
  echo "  - Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  echo "  - macOS: brew install node"
  echo ""
  exit 1
fi

echo -e "✓ Node.js: ${C_GREEN}$(node -v)${C_RESET} (thỏa mãn >= 18)"
echo -e "✓ npm:     ${C_GREEN}$(npm -v)${C_RESET}"

# 3. Xác định thư mục cài đặt
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
if [ -f "$SCRIPT_DIR/package.json" ] && [ -d "$SCRIPT_DIR/client" ] && [ -d "$SCRIPT_DIR/server" ]; then
  # Chạy trực tiếp bên trong repo đã clone
  INSTALL_DIR="$SCRIPT_DIR"
  echo -e "✓ Cài đặt từ thư mục hiện tại: ${C_GREEN}$INSTALL_DIR${C_RESET}"
else
  INSTALL_DIR="${HUGREMOTE_DIR:-$HOME/.hugremote}"
  echo -e "✓ Thư mục đích: ${C_GREEN}$INSTALL_DIR${C_RESET}"

  TARGET_REF="${HUGREMOTE_REF:-main}"
  if [ -d "$INSTALL_DIR/.git" ]; then
    echo "  Đã tồn tại repo, đang cập nhật mã nguồn mới nhất (nhánh: $TARGET_REF - Beta)..."
    cd "$INSTALL_DIR"
    git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*" 2>/dev/null || true
    git fetch origin "$TARGET_REF" || git fetch origin
    git checkout -B "$TARGET_REF" FETCH_HEAD 2>/dev/null || git checkout "$TARGET_REF" 2>/dev/null || git reset --hard FETCH_HEAD
    git reset --hard FETCH_HEAD 2>/dev/null || true
    git pull origin "$TARGET_REF" 2>/dev/null || true
  else
    echo "  Đang tải mã nguồn HugRemote mới nhất (nhánh: $TARGET_REF - Beta)..."
    mkdir -p "$INSTALL_DIR"
    REPO_URL="${HUGREMOTE_REPO_URL:-https://github.com/vibecoding-hungkc/hugremote.git}"
    if command -v git >/dev/null 2>&1; then
      git clone --branch "$TARGET_REF" --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>/dev/null || \
      git clone "$REPO_URL" "$INSTALL_DIR"
    else
      echo -e "${C_RED}❌ Vui lòng cài đặt git hoặc chạy từ npm: npm install -g hugremote${C_RESET}"
      exit 1
    fi
  fi
fi

cd "$INSTALL_DIR"

# 4. Cài đặt dependencies và build
echo ""
echo -e "${C_BOLD}📦 Đang cài đặt thư viện và build gói...${C_RESET}"

# Build client
echo "  [1/2] Cài đặt & Build Frontend Client..."
cd "$INSTALL_DIR/client"
npm install --silent
npm run build

# Build server
echo "  [2/2] Cài đặt & Build Backend Server..."
cd "$INSTALL_DIR/server"
npm install --silent
# Khắc phục lỗi node-pty trên macOS (spawn-helper thiếu quyền execute)
find "$INSTALL_DIR" -type f -name "spawn-helper" -exec chmod +x {} + 2>/dev/null || true
npm run build

# Root package dependencies
cd "$INSTALL_DIR"
npm install --silent
find "$INSTALL_DIR" -type f -name "spawn-helper" -exec chmod +x {} + 2>/dev/null || true

echo -e "${C_GREEN}✓ Hoàn tất build Frontend và Backend!${C_RESET}"

# 5. Tạo CLI Executable Link
echo ""
echo -e "${C_BOLD}🔗 Thiết lập lệnh CLI 'hugremote'...${C_RESET}"
BIN_SOURCE="$INSTALL_DIR/bin/hugremote.js"
chmod +x "$BIN_SOURCE"

TARGET_BIN_DIR="$HOME/.local/bin"
mkdir -p "$TARGET_BIN_DIR"
ln -sf "$BIN_SOURCE" "$TARGET_BIN_DIR/hugremote"
ln -sf "$BIN_SOURCE" "$TARGET_BIN_DIR/hugcode"
echo -e "✓ Đã liên kết lệnh: ${C_GREEN}$TARGET_BIN_DIR/hugremote${C_RESET} và ${C_GREEN}$TARGET_BIN_DIR/hugcode${C_RESET}"

# Kiểm tra PATH
if [[ ":$PATH:" != *":$TARGET_BIN_DIR:"* ]]; then
  echo -e "${C_YELLOW}⚠️  Thư mục $TARGET_BIN_DIR chưa có trong PATH của bạn.${C_RESET}"
  SHELL_RC="$HOME/.bashrc"
  [ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"
  echo "export PATH=\"$TARGET_BIN_DIR:\$PATH\"" >> "$SHELL_RC"
  echo -e "   Đã tự động thêm vào $SHELL_RC. Hãy chạy: ${C_BOLD}source $SHELL_RC${C_RESET}"
fi

# 6. Thiết lập Cấu hình tương tác (Interactive Configuration)
prompt_user_input() {
  local prompt_text="$1"
  local default_val="$2"
  local var_name="$3"
  local user_val=""

  if [ -t 0 ]; then
    read -r -p "$prompt_text" user_val
  elif ( : </dev/tty ) 2>/dev/null; then
    read -r -p "$prompt_text" user_val </dev/tty 2>/dev/null || user_val="$default_val"
  else
    user_val="$default_val"
  fi

  user_val="$(echo "$user_val" | tr -d '\r' | xargs 2>/dev/null || echo "$user_val")"
  if [ -z "$user_val" ]; then
    eval "$var_name=\"$default_val\""
  else
    eval "$var_name=\"$user_val\""
  fi
}

CONFIG_DIR="$HOME/.config/hugremote"
ENV_FILE="$CONFIG_DIR/.env"

RECONFIGURE=false
SELECTED_HOST="127.0.0.1"
SELECTED_PORT="8099"
SELECTED_AUTH_MODE="password"
SELECTED_APP_URL="http://localhost:8099"
SELECTED_GOOGLE_CLIENT_ID=""
SELECTED_GOOGLE_CLIENT_SECRET=""
SELECTED_GOOGLE_ALLOWED_EMAILS=""
SELECTED_SESSION_SECRET=""

if [ -f "$ENV_FILE" ]; then
  # Tải cấu hình đã khởi tạo từ trước
  EXISTING_HOST=$(grep -E '^HOST=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' || echo "")
  EXISTING_PORT=$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' || echo "")
  EXISTING_AUTH_MODE=$(grep -E '^AUTH_MODE=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' || echo "")
  EXISTING_SECRET=$(grep -E '^SESSION_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' || echo "")
  EXISTING_APP_URL=$(grep -E '^APP_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' || echo "")
  EXISTING_GOOGLE_CLIENT_ID=$(grep -E '^GOOGLE_CLIENT_ID=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' || echo "")
  EXISTING_GOOGLE_CLIENT_SECRET=$(grep -E '^GOOGLE_CLIENT_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' || echo "")
  EXISTING_GOOGLE_ALLOWED_EMAILS=$(grep -E '^GOOGLE_ALLOWED_EMAILS=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' || echo "")

  if [ -n "$EXISTING_PORT" ] || [ -n "$EXISTING_AUTH_MODE" ]; then
    echo ""
    echo -e "${C_BLUE}========================================================================${C_RESET}"
    echo -e "${C_BOLD} ⚙️  PHÁT HIỆN CẤU HÌNH ĐÃ KHỞI TẠO TỪ LẦN CÀI ĐẶT TRƯỚC${C_RESET}"
    echo -e "${C_BLUE}========================================================================${C_RESET}"
    echo -e "  • File cấu hình:       ${C_GREEN}$ENV_FILE${C_RESET}"
    echo -e "  • Host (Bind IP)       : ${C_GREEN}${EXISTING_HOST:-127.0.0.1}${C_RESET}"
    echo -e "  • Cổng kết nối (Port)  : ${C_GREEN}${EXISTING_PORT:-8099}${C_RESET}"
    echo -e "  • Chế độ xác thực      : ${C_GREEN}${EXISTING_AUTH_MODE:-password}${C_RESET}"
    echo -e "  • Thư mục Workspace    : ${C_GREEN}$HOME/projects${C_RESET}"
    echo -e "${C_BLUE}========================================================================${C_RESET}"
    echo ""

    KEEP_CHOICE=""
    prompt_user_input "👉 Giữ nguyên cấu hình trên để cập nhật nhanh? [Y/n] (Mặc định: Y): " "Y" KEEP_CHOICE
    if [[ "$KEEP_CHOICE" =~ ^[Yy]$ || -z "$KEEP_CHOICE" ]]; then
      SELECTED_HOST="${EXISTING_HOST:-127.0.0.1}"
      SELECTED_PORT="${EXISTING_PORT:-8099}"
      SELECTED_AUTH_MODE="${EXISTING_AUTH_MODE:-password}"
      SELECTED_SESSION_SECRET="${EXISTING_SECRET}"
      SELECTED_APP_URL="${EXISTING_APP_URL:-http://localhost:8099}"
      SELECTED_GOOGLE_CLIENT_ID="${EXISTING_GOOGLE_CLIENT_ID}"
      SELECTED_GOOGLE_CLIENT_SECRET="${EXISTING_GOOGLE_CLIENT_SECRET}"
      SELECTED_GOOGLE_ALLOWED_EMAILS="${EXISTING_GOOGLE_ALLOWED_EMAILS}"
      echo -e "✓ ${C_GREEN}Đã giữ nguyên cấu hình đã có. Bỏ qua các câu hỏi thiết lập.${C_RESET}"
    else
      RECONFIGURE=true
    fi
  fi
fi

if [ ! -f "$ENV_FILE" ] || [ "$RECONFIGURE" = true ]; then
  echo ""
  echo -e "${C_BLUE}========================================================================${C_RESET}"
  echo -e "${C_BOLD} ⚙️  THIẾT LẬP CẤU HÌNH CHO HUGREMOTE${C_RESET}"
  echo -e "${C_BLUE}========================================================================${C_RESET}"
  echo ""

  # [1] Chọn Host (Bind Address)
  echo -e "${C_BOLD}┌────────────────────────────────────────────────────────────────────────┐${C_RESET}"
  echo -e "${C_BOLD}│ 1. 🌐 ĐỊA CHỈ LẮNG NGHE (HOST / BIND ADDRESS)                         │${C_RESET}"
  echo -e "${C_BOLD}├────────────────────────────────────────────────────────────────────────┤${C_RESET}"
  echo -e "│  ${C_GREEN}[1] 127.0.0.1${C_RESET}  (Khuyên dùng)                                          │"
  echo -e "│      Chỉ cho phép truy cập cục bộ và qua Cloudflare Tunnel / Nginx.    │"
  echo -e "│      Đảm bảo an toàn Zero-Trust tuyệt đối, không lộ port ra ngoài.     │"
  echo -e "│                                                                        │"
  echo -e "│  ${C_YELLOW}[2] 0.0.0.0${C_RESET}                                                           │"
  echo -e "│      Lắng nghe trên mọi card mạng IPv4 (truy cập từ thiết bị cùng LAN).│"
  echo -e "│                                                                        │"
  echo -e "│  ${C_YELLOW}[3] ::${C_RESET}                                                                │"
  echo -e "│      Lắng nghe trên tất cả địa chỉ cả IPv4 và IPv6.                    │"
  echo -e "${C_BOLD}└────────────────────────────────────────────────────────────────────────┘${C_RESET}"

  HOST_CHOICE=""
  prompt_user_input "👉 Chọn Host [1-3] (Mặc định: 1 [127.0.0.1]): " "1" HOST_CHOICE

  case "$HOST_CHOICE" in
    2) SELECTED_HOST="0.0.0.0" ;;
    3) SELECTED_HOST="::" ;;
    *) SELECTED_HOST="127.0.0.1" ;;
  esac
  echo -e "✓ Đã chọn Host: ${C_GREEN}$SELECTED_HOST${C_RESET}"
  echo ""

  # [2] Chọn Auth Mode
  echo -e "${C_BOLD}┌────────────────────────────────────────────────────────────────────────┐${C_RESET}"
  echo -e "${C_BOLD}│ 2. 🔐 PHƯƠNG THỨC XÁC THỰC (AUTHENTICATION MODE)                      │${C_RESET}"
  echo -e "${C_BOLD}├────────────────────────────────────────────────────────────────────────┤${C_RESET}"
  echo -e "│  ${C_GREEN}[1] password${C_RESET}   (Khuyên dùng khi public ra Internet)                   │"
  echo -e "│      • Không lưu mật khẩu thô trong cấu hình.                          │"
  echo -e "│      • Mật khẩu khởi tạo ban đầu: 123456                               │"
  echo -e "│      • Bắt buộc đổi mật khẩu mới ngay lần đăng nhập đầu tiên.          │"
  echo -e "│      • Mật khẩu mới được băm PBKDF2-SHA512 lưu an toàn trên đĩa.       │"
  echo -e "│                                                                        │"
  echo -e "│  ${C_YELLOW}[2] none${C_RESET}       (Không mật khẩu)                                       │"
  echo -e "│      Chỉ phù hợp khi chạy thử nghiệm localhost hoặc đã có              │"
  echo -e "│      Cloudflare Access / Zero Trust bảo vệ ở tầng ngoài.               │"
  echo -e "│                                                                        │"
  echo -e "│  ${C_YELLOW}[3] google${C_RESET}     (Đăng nhập tài khoản Google OAuth 2.0)                 │"
  echo -e "│      Chỉ các email được cấp quyền mới có thể đăng nhập.                │"
  echo -e "${C_BOLD}└────────────────────────────────────────────────────────────────────────┘${C_RESET}"

  AUTH_CHOICE=""
  prompt_user_input "👉 Chọn chế độ Auth [1-3] (Mặc định: 1 [password]): " "1" AUTH_CHOICE

  case "$AUTH_CHOICE" in
    2)
      SELECTED_AUTH_MODE="none"
      echo -e "✓ Đã chọn: ${C_YELLOW}Không xác thực (none)${C_RESET}"
      ;;
    3)
      SELECTED_AUTH_MODE="google"
      echo -e "✓ Đã chọn: ${C_BLUE}Google OAuth (google)${C_RESET}"
      echo ""
      prompt_user_input "👉 Nhập Public App URL (ví dụ: https://hugremote.domain.com): " "http://localhost:8099" SELECTED_APP_URL
      prompt_user_input "👉 Nhập Google Client ID: " "" SELECTED_GOOGLE_CLIENT_ID
      prompt_user_input "👉 Nhập Google Client Secret: " "" SELECTED_GOOGLE_CLIENT_SECRET
      prompt_user_input "👉 Nhập Google Allowed Emails (cách nhau bởi dấu phẩy): " "" SELECTED_GOOGLE_ALLOWED_EMAILS
      ;;
    *)
      SELECTED_AUTH_MODE="password"
      echo -e "✓ Đã chọn: ${C_GREEN}Mật khẩu (Khởi tạo: 123456, bắt buộc đổi lần đầu)${C_RESET}"
      ;;
  esac
  echo ""

  # [3] Chọn Port
  echo -e "${C_BOLD}┌────────────────────────────────────────────────────────────────────────┐${C_RESET}"
  echo -e "${C_BOLD}│ 3. 🔌 CỔNG KẾT NỐI (HTTP & WEBSOCKET PORT)                            │${C_RESET}"
  echo -e "${C_BOLD}└────────────────────────────────────────────────────────────────────────┘${C_RESET}"
  PORT_CHOICE=""
  prompt_user_input "👉 Nhập cổng muốn sử dụng (Mặc định: 8099): " "8099" PORT_CHOICE
  SELECTED_PORT="${PORT_CHOICE:-8099}"
  SELECTED_HOST="${SELECTED_HOST:-127.0.0.1}"
  SELECTED_AUTH_MODE="${SELECTED_AUTH_MODE:-password}"
  echo -e "✓ Đã chọn Port: ${C_GREEN}$SELECTED_PORT${C_RESET}"
  echo ""
fi

# Tạo chuỗi bí mật session secret 32-byte ngẫu nhiên nếu chưa có
if [ -z "$SELECTED_SESSION_SECRET" ]; then
  SELECTED_SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32 2>/dev/null || echo "hugremote_secret_$(date +%s)")
fi

# Bảng xác nhận
echo -e "${C_BLUE}========================================================================${C_RESET}"
echo -e "${C_BOLD} 📋 XÁC NHẬN CẤU HÌNH ĐÃ THIẾT LẬP${C_RESET}"
echo -e "${C_BLUE}========================================================================${C_RESET}"
echo -e "  • Host (Bind IP)       : ${C_GREEN}$SELECTED_HOST${C_RESET}"
echo -e "  • Cổng kết nối (Port)  : ${C_GREEN}$SELECTED_PORT${C_RESET}"
echo -e "  • Chế độ xác thực      : ${C_GREEN}$SELECTED_AUTH_MODE${C_RESET}"
if [ "$SELECTED_AUTH_MODE" = "password" ]; then
  echo -e "  • Mật khẩu ban đầu     : ${C_YELLOW}123456${C_RESET} (Bắt buộc đổi ở lần đầu đăng nhập)"
fi
echo -e "  • Thư mục Workspace    : ${C_GREEN}$HOME/projects${C_RESET}"
echo -e "${C_BLUE}========================================================================${C_RESET}"
echo ""

# Lưu file .env dự phòng
CONFIG_DIR="$HOME/.config/hugremote"
mkdir -p "$CONFIG_DIR"
ENV_FILE="$CONFIG_DIR/.env"
cat > "$ENV_FILE" <<EOF
HOST=$SELECTED_HOST
PORT=$SELECTED_PORT
AUTH_MODE=$SELECTED_AUTH_MODE
SESSION_SECRET=$SELECTED_SESSION_SECRET
APP_URL=$SELECTED_APP_URL
GOOGLE_CLIENT_ID=$SELECTED_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$SELECTED_GOOGLE_CLIENT_SECRET
GOOGLE_ALLOWED_EMAILS=$SELECTED_GOOGLE_ALLOWED_EMAILS
WORKSPACE_ROOT=$HOME/projects
ALLOWED_ROOT=$HOME
EOF
chmod 600 "$ENV_FILE" 2>/dev/null || true
echo -e "✓ Đã lưu file cấu hình: ${C_GREEN}$ENV_FILE${C_RESET}"

# 7. Thiết lập Systemd User Service (nếu trên Linux có systemd)
SETUP_SERVICE=false
if [ "$PLATFORM" = "linux" ] && command -v systemctl >/dev/null 2>&1; then
  SERVICE_DIR="$HOME/.config/systemd/user"
  mkdir -p "$SERVICE_DIR"
  SERVICE_FILE="$SERVICE_DIR/hugremote.service"

  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=HugRemote Mobile-First Web IDE (User Daemon)
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
Environment=PORT=$SELECTED_PORT
Environment=HOST=$SELECTED_HOST
Environment=BASE_PATH=
Environment=WORKSPACE_ROOT=$HOME/projects
Environment=ALLOWED_ROOT=$HOME
Environment=AUTH_MODE=$SELECTED_AUTH_MODE
Environment=SESSION_SECRET=$SELECTED_SESSION_SECRET
Environment=APP_URL=$SELECTED_APP_URL
Environment=GOOGLE_CLIENT_ID=$SELECTED_GOOGLE_CLIENT_ID
Environment=GOOGLE_CLIENT_SECRET=$SELECTED_GOOGLE_CLIENT_SECRET
Environment=GOOGLE_ALLOWED_EMAILS=$SELECTED_GOOGLE_ALLOWED_EMAILS
Environment=PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:\$PATH
ExecStart=$TARGET_BIN_DIR/hugremote
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload 2>/dev/null || true
  echo -e "✓ Đã tạo service nền: ${C_GREEN}$SERVICE_FILE${C_RESET}"
  SETUP_SERVICE=true

  START_CHOICE=""
  prompt_user_input "👉 Bạn có muốn khởi động service 'hugremote' chạy ngầm ngay bây giờ? [Y/n]: " "Y" START_CHOICE
  if [[ "$START_CHOICE" =~ ^[Yy]$ || -z "$START_CHOICE" ]]; then
    systemctl --user enable --now hugremote 2>/dev/null || systemctl --user start hugremote 2>/dev/null || true
    echo -e "✓ ${C_GREEN}Đã kích hoạt và khởi chạy service hugremote thành công!${C_RESET}"
  fi
fi

# 8. Hoàn tất
echo ""
echo -e "${C_GREEN}${C_BOLD}========================================================${C_RESET}"
echo -e "${C_GREEN}${C_BOLD} 🎉 CÀI ĐẶT HUGREMOTE THÀNH CÔNG!${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}========================================================${C_RESET}"
echo ""
echo -e "${C_BOLD}Cách sử dụng:${C_RESET}"
echo -e "  1. Chạy thủ công:"
echo -e "     ${C_BLUE}hugremote${C_RESET}                 # Mở tại cổng 8099"
echo -e "     ${C_BLUE}hugremote -p 3000${C_RESET}         # Đổi cổng"
echo -e "     ${C_BLUE}hugremote -b /remote${C_RESET}      # Dùng với Cloudflare Tunnel / Reverse Proxy"
echo ""
if [ "$SETUP_SERVICE" = true ]; then
  echo -e "  2. Quản lý chạy ngầm (Systemd):"
  echo -e "     ${C_BLUE}systemctl --user start hugremote${C_RESET}    # Khởi động nền"
  echo -e "     ${C_BLUE}systemctl --user enable hugremote${C_RESET}   # Tự bật khi máy khởi động"
  echo -e "     ${C_BLUE}systemctl --user status hugremote${C_RESET}   # Xem trạng thái"
  echo ""
fi
echo -e "  3. Hoặc chạy trực tiếp không cần cài:"
echo -e "     ${C_BLUE}npx hugremote${C_RESET}"
echo ""
echo -e "${C_CORAL}Truy cập giao diện Web: ${C_BOLD}http://localhost:8099/${C_RESET}"
echo ""
