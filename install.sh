#!/usr/bin/env bash
# ==============================================================================
#  🐴 HugCode — Mobile-First Web IDE & Terminal Installer
#  One-line install: curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash
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
echo "  _    _             _____          _      "
echo " | |  | |           / ____|        | |     "
echo " | |__| |_   _  __ | |     ___   __| | ___ "
echo " |  __  | | | |/ _\`| |    / _ \ / _\` |/ _ \\"
echo " | |  | | |_| | (_| | |___| (_) | (_| |  __/"
echo " |_|  |_|\__,_|\__, |\_____\___/ \__,_|\___|"
echo "                __/ |                      "
echo "               |___/   Mobile-First Web IDE"
echo -e "${C_RESET}"
echo -e "${C_BLUE}======================================================${C_RESET}"
echo -e "${C_BOLD} Bắt đầu cài đặt HugCode Web IDE & Terminal...${C_RESET}"
echo -e "${C_BLUE}======================================================${C_RESET}"
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
  echo -e "${C_YELLOW}⚠️  Yêu cầu Node.js >= 18.x để chạy HugCode.${C_RESET}"
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
  INSTALL_DIR="${HUGCODE_DIR:-$HOME/.hugcode}"
  echo -e "✓ Thư mục đích: ${C_GREEN}$INSTALL_DIR${C_RESET}"

  if [ -d "$INSTALL_DIR/.git" ]; then
    echo "  Đã tồn tại repo, đang cập nhật mã nguồn mới nhất..."
    cd "$INSTALL_DIR"
    git fetch origin
    git checkout packaged || git checkout master
    git pull
  else
    echo "  Đang tải mã nguồn HugCode..."
    mkdir -p "$INSTALL_DIR"
    # Clone repo
    REPO_URL="${HUGCODE_REPO_URL:-https://github.com/vibecoding-hungkc/hugremote.git}"
    if command -v git >/dev/null 2>&1; then
      git clone -b packaged "$REPO_URL" "$INSTALL_DIR" 2>/dev/null || \
      git clone "$REPO_URL" "$INSTALL_DIR"
    else
      echo -e "${C_RED}❌ Vui lòng cài đặt git hoặc chạy từ npm: npm install -g hugcode${C_RESET}"
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
npm run build

# Root package dependencies
cd "$INSTALL_DIR"
npm install --silent

echo -e "${C_GREEN}✓ Hoàn tất build Frontend và Backend!${C_RESET}"

# 5. Tạo CLI Executable Link
echo ""
echo -e "${C_BOLD}🔗 Thiết lập lệnh CLI 'hugcode'...${C_RESET}"
BIN_SOURCE="$INSTALL_DIR/bin/hugcode.js"
chmod +x "$BIN_SOURCE"

TARGET_BIN_DIR="$HOME/.local/bin"
mkdir -p "$TARGET_BIN_DIR"
ln -sf "$BIN_SOURCE" "$TARGET_BIN_DIR/hugcode"
echo -e "✓ Đã liên kết: ${C_GREEN}$TARGET_BIN_DIR/hugcode${C_RESET}"

# Kiểm tra PATH
if [[ ":$PATH:" != *":$TARGET_BIN_DIR:"* ]]; then
  echo -e "${C_YELLOW}⚠️  Thư mục $TARGET_BIN_DIR chưa có trong PATH của bạn.${C_RESET}"
  SHELL_RC="$HOME/.bashrc"
  [ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"
  echo "export PATH=\"$TARGET_BIN_DIR:\$PATH\"" >> "$SHELL_RC"
  echo -e "   Đã tự động thêm vào $SHELL_RC. Hãy chạy: ${C_BOLD}source $SHELL_RC${C_RESET}"
fi

# 6. Thiết lập Systemd User Service (nếu trên Linux có systemd)
SETUP_SERVICE=false
if [ "$PLATFORM" = "linux" ] && command -v systemctl >/dev/null 2>&1; then
  SERVICE_DIR="$HOME/.config/systemd/user"
  mkdir -p "$SERVICE_DIR"
  SERVICE_FILE="$SERVICE_DIR/hugcode.service"

  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=HugCode Mobile-First Web IDE (User Daemon)
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
Environment=PORT=8099
Environment=HOST=::
Environment=BASE_PATH=
Environment=WORKSPACE_ROOT=$HOME/projects
Environment=ALLOWED_ROOT=$HOME
Environment=PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:\$PATH
ExecStart=$TARGET_BIN_DIR/hugcode
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload 2>/dev/null || true
  echo -e "✓ Đã tạo service nền: ${C_GREEN}$SERVICE_FILE${C_RESET}"
  SETUP_SERVICE=true
fi

# 7. Hoàn tất
echo ""
echo -e "${C_GREEN}${C_BOLD}======================================================${C_RESET}"
echo -e "${C_GREEN}${C_BOLD} 🎉 CÀI ĐẶT HUGCODE THÀNH CÔNG!${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}======================================================${C_RESET}"
echo ""
echo -e "${C_BOLD}Cách sử dụng:${C_RESET}"
echo -e "  1. Chạy thủ công:"
echo -e "     ${C_BLUE}hugcode${C_RESET}                 # Mở tại cổng 8099"
echo -e "     ${C_BLUE}hugcode -p 3000${C_RESET}         # Đổi cổng"
echo -e "     ${C_BLUE}hugcode -b /remote${C_RESET}      # Dùng với Cloudflare Tunnel / Reverse Proxy"
echo ""
if [ "$SETUP_SERVICE" = true ]; then
  echo -e "  2. Quản lý chạy ngầm (Systemd):"
  echo -e "     ${C_BLUE}systemctl --user start hugcode${C_RESET}    # Khởi động nền"
  echo -e "     ${C_BLUE}systemctl --user enable hugcode${C_RESET}   # Tự bật khi máy khởi động"
  echo -e "     ${C_BLUE}systemctl --user status hugcode${C_RESET}   # Xem trạng thái"
  echo ""
fi
echo -e "  3. Hoặc chạy trực tiếp không cần cài:"
echo -e "     ${C_BLUE}npx hugcode${C_RESET}"
echo ""
echo -e "${C_CORAL}Truy cập giao diện Web: ${C_BOLD}http://localhost:8099/${C_RESET}"
echo ""
