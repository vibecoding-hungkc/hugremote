#!/usr/bin/env bash
# Cài HugRemote bằng một lệnh (AC-29):
#   curl -fsSL <địa chỉ>/install.sh | bash            (kênh stable)
#   curl -fsSL <địa chỉ>/beta.sh | bash               (kênh beta)
# Không tương tác: HUGREMOTE_REPO=… HUGREMOTE_PORT=8099 HUGREMOTE_HOST=127.0.0.1 HUGREMOTE_BASE=/remote bash install.sh --yes
# Tuỳ chọn: --beta · --yes (không hỏi) · --no-service (chạy nền bằng pidfile, không cài systemd/launchd)
set -euo pipefail

CHANNEL=stable; YES=0
for a in "$@"; do
  case "$a" in
    --beta) CHANNEL=beta ;;
    --yes|-y) YES=1 ;;
    --no-service) export SERVICE_MODE=pidfile ;;
  esac
done
UPDATE_REPO="${HUGREMOTE_REPO:-https://github.com/hugremote/hugremote.git}"
INSTALL_ROOT="${INSTALL_ROOT:-$HOME/.local/share/hugremote}"
DATA_DIR="${DATA_DIR:-$HOME/.config/hugremote}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
export UPDATE_REPO INSTALL_ROOT DATA_DIR

say() { printf '\033[1m%s\033[0m\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }
ask() { # $1 câu hỏi, $2 mặc định → in giá trị
  local v=""
  if [ "$YES" = 0 ] && [ -r /dev/tty ]; then read -r -p "$1 [$2]: " v </dev/tty || true; fi
  echo "${v:-$2}"
}

# ---------- 1. kiểm môi trường ----------
case "$(uname -s)" in Linux|Darwin) ;; *) die "Chỉ hỗ trợ Linux và macOS" ;; esac
command -v node >/dev/null || die "Cần Node.js 22 trở lên — cài từ https://nodejs.org hoặc nvm rồi chạy lại"
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || die "Node $(node -v) quá cũ — cần 22 trở lên"
command -v git >/dev/null || die "Cần git"
command -v curl >/dev/null || die "Cần curl"
if ! command -v make >/dev/null || ! { command -v cc >/dev/null || command -v gcc >/dev/null || command -v clang >/dev/null; } || ! command -v python3 >/dev/null; then
  if [ "$(uname -s)" = Darwin ]; then die "Thiếu công cụ build (node-pty, better-sqlite3) — chạy: xcode-select --install"
  else die "Thiếu công cụ build — Debian/Ubuntu: sudo apt install -y build-essential python3"; fi
fi
command -v pnpm >/dev/null || { corepack enable >/dev/null 2>&1 || true; }
command -v pnpm >/dev/null || die "Không bật được pnpm qua corepack — chạy: npm i -g pnpm"

# shellcheck source=lib/release.sh
here="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo /tmp)"
if [ -f "$here/lib/release.sh" ]; then . "$here/lib/release.sh"; . "$here/lib/service.sh"
else # chạy qua `curl | bash`: lấy thư viện từ chính kho phát hành
  tmpd="$(mktemp -d)"; git clone --quiet --depth 1 "$UPDATE_REPO" "$tmpd/src"; . "$tmpd/src/bin/lib/release.sh"; . "$tmpd/src/bin/lib/service.sh"
fi

TAG="$(latest_tag "$CHANNEL")"
[ -n "$TAG" ] || die "Không thấy bản phát hành ($CHANNEL) ở $UPDATE_REPO"
UPGRADE=0; [ -L "$INSTALL_ROOT/current" ] && UPGRADE=1
say "HugRemote $TAG ($CHANNEL)$([ $UPGRADE = 1 ] && echo ' — đã có bản cài, sẽ nâng cấp')"

# ---------- 2. cấu hình ----------
mkdir -p "$DATA_DIR/logs" && chmod 700 "$DATA_DIR" "$DATA_DIR/logs"
if [ ! -f "$DATA_DIR/.env" ]; then
  HOST_V="${HUGREMOTE_HOST:-$(ask 'Địa chỉ nghe (127.0.0.1 = chỉ máy này, sau reverse proxy/tunnel)' 127.0.0.1)}"
  PORT_V="${HUGREMOTE_PORT:-$(ask 'Cổng' 8099)}"
  BASE_V="${HUGREMOTE_BASE:-$(ask 'BASE_PATH (để trống nếu chạy ở gốc tên miền, vd /remote)' '')}"
  URL_V="${HUGREMOTE_URL:-$(ask 'Địa chỉ người dùng mở (APP_URL)' "http://localhost:$PORT_V")}"
  AUTH_V="${HUGREMOTE_AUTH:-$(ask 'Chế độ đăng nhập (password · none chỉ khi nghe 127.0.0.1)' password)}"
  if [ "$AUTH_V" = none ] && [ "$HOST_V" != 127.0.0.1 ] && [ "$HOST_V" != localhost ]; then die "AUTH_MODE=none chỉ cho phép khi nghe 127.0.0.1"; fi
  umask 077
  cat > "$DATA_DIR/.env" <<ENV
# Cấu hình HugRemote — sửa xong chạy: hugremote restart
APP_ENV=production
HOST=$HOST_V
PORT=$PORT_V
BASE_PATH=$BASE_V
APP_URL=$URL_V
AUTH_MODE=$AUTH_V
UPDATE_CHANNEL=$CHANNEL
UPDATE_REPO=$UPDATE_REPO
ENV
fi
set -a; . "$DATA_DIR/.env"; set +a

# ---------- 3. tải + dựng + chuyển bản ----------
build_release "$TAG" | sed 's/^STEP /· /'
PREV="$(readlink "$INSTALL_ROOT/current" 2>/dev/null || true)"
switch_to "$TAG"
mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/hugremote" <<SH
#!/usr/bin/env bash
export DATA_DIR="$DATA_DIR" INSTALL_ROOT="$INSTALL_ROOT"
set -a; [ -f "$DATA_DIR/.env" ] && . "$DATA_DIR/.env"; set +a
exec node "$INSTALL_ROOT/current/bin/hugremote.cjs" "\$@"
SH
chmod +x "$BIN_DIR/hugremote"

# ---------- 4. dịch vụ ----------
if [ $UPGRADE = 1 ]; then service_restart; else service_install; fi
HC_HOST="$HOST"; [ "$HC_HOST" = 0.0.0.0 ] && HC_HOST=127.0.0.1
if ! HC_HOST="$HC_HOST" health_ok; then
  [ -n "$PREV" ] && { switch_to "$(basename "$PREV")"; service_restart; die "Bản $TAG không khởi động được — đã quay về $(basename "$PREV"). Xem $DATA_DIR/logs/"; }
  die "HugRemote không khởi động được — xem $DATA_DIR/logs/service.log và chạy: hugremote doctor"
fi

# ---------- 5. dữ liệu v1 ----------
if [ $UPGRADE = 0 ] && node "$INSTALL_ROOT/current/bin/hugremote.cjs" import-v1 --dry-run >/dev/null 2>&1; then
  if [ "$(ask 'Thấy dữ liệu HugRemote v1 — nhập vào bản mới? (y/n)' y)" = y ]; then
    node "$INSTALL_ROOT/current/bin/hugremote.cjs" import-v1 || true
  fi
fi

# ---------- 6. xong ----------
say "✓ HugRemote $TAG đang chạy ở $APP_URL${BASE_PATH:-}/"
if [ $UPGRADE = 0 ] && [ "${AUTH_MODE:-password}" = password ]; then
  PW="$(grep -h 'Mật khẩu khởi tạo' "$DATA_DIR/logs/app.log" 2>/dev/null | tail -1 | sed -E 's/.*Mật khẩu khởi tạo: ([^ ]+).*/\1/' || true)"
  [ -n "$PW" ] && say "Mật khẩu khởi tạo: $PW  (đăng nhập rồi đổi ngay)"
fi
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) echo "Thêm $BIN_DIR vào PATH để dùng lệnh: hugremote doctor · hugremote update · hugremote restart" ;; esac
