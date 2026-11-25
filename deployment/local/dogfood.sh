#!/usr/bin/env bash
# Instance dogfood riêng cho từng vai (DOGFOOD-PLAN §2, DECISIONS 2026-11-21): DATA_DIR + cổng + ssh config riêng,
# một bản sao dự án demo-api riêng trong container demo-sshd. Dùng bản build hiện tại của repo (make check trước).
#   deployment/local/dogfood.sh start <vai> <cổng> [--fresh] [--initial]   # --initial: giữ mật khẩu khởi tạo (newbie, smoke)
#   deployment/local/dogfood.sh stop <cổng> | stop-all | list
# Owner: mật khẩu khởi tạo `khoitao-<vai>-123`; sau seed đổi thành `dogfood-<vai>-123`.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$here/../../srcroot/boundaries/hugremote" && pwd)"
ROOT="$here/.dogfood"
cmd="${1:-list}"

stop_port() { for p in $(lsof -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null); do kill "$p"; done; }

case "$cmd" in
  list) for d in "$ROOT"/*/; do [ -d "$d" ] || continue; p="$(basename "$d")"; printf '%s %s %s\n' "$p" "$(cat "$d/role" 2>/dev/null)" "$(curl -sf "localhost:$p/api/health" >/dev/null && echo chạy || echo dừng)"; done; exit 0 ;;
  stop) stop_port "$2"; exit 0 ;;
  stop-all) for d in "$ROOT"/*/; do [ -d "$d" ] && stop_port "$(basename "$d")"; done; exit 0 ;;
  start) ;;
  *) echo "lệnh: start|stop|stop-all|list" >&2; exit 1 ;;
esac

role="$2"; port="$3"; shift 3
fresh=0; initial=0
for a in "$@"; do case "$a" in --fresh) fresh=1 ;; --initial) initial=1 ;; esac; done
dir="$ROOT/$port"
stop_port "$port"
[ $fresh = 1 ] && rm -rf "$dir"
mkdir -p "$dir/data" "$dir/ssh/conf.d" "$dir/work"
echo "$role" > "$dir/role"
# ssh config riêng: sửa máy ở vai này không đụng vai khác
sed "s#$here/ssh/conf.d#$dir/ssh/conf.d#" "$here/ssh/config" > "$dir/ssh/config"
cp -n "$here/ssh/conf.d/"*.conf "$dir/ssh/conf.d/" 2>/dev/null || true
chmod 700 "$dir/ssh"; chmod 600 "$dir/ssh/config"
# dự án demo riêng trong container (chung máy SSH, khác thư mục)
sshd="$(docker ps --format '{{.Names}} {{.Ports}}' | awk '/2222->22/{print $1; exit}')"  # container nào đang giữ cổng 2222
if [ -n "$sshd" ]; then
  docker exec -u dev "$sshd" sh -c "[ -d ~/projects/df-$role ] || cp -r ~/projects/demo-api ~/projects/df-$role" || true
fi

# DF_HOST/DF_PUBLIC: cho trình duyệt dogfood ở máy khác (vd. Playwright MCP trên Mac) — mặc định chỉ loopback
DATA_DIR="$dir/data" PORT="$port" HOST="${DF_HOST:-127.0.0.1}" APP_URL="http://${DF_PUBLIC:-localhost}:$port" APP_ENV=development \
AUTH_PASSWORD="khoitao-$role-123" SSH_CONFIG_PATH="$dir/ssh/config" ALLOWED_ROOT="$dir/work" WORKSPACE_ROOT="$dir/work" \
CLAUDE_BIN_PATH="$here/fake-claude/claude" WEB_DIST="$APP/apps/web/dist" \
UPDATE_REPO="file://$here/releases.git" \
  nohup node "$APP/apps/api/dist/main.js" > "$dir/api.log" 2>&1 &
for _ in $(seq 1 60); do curl -sf "localhost:$port/api/health" >/dev/null && break; sleep 0.3; done
curl -sf "localhost:$port/api/health" >/dev/null || { echo "instance $port không lên — xem $dir/api.log"; exit 1; }

[ $initial = 1 ] && { echo "$role@inst-$port → http://localhost:$port (mật khẩu khởi tạo khoitao-$role-123)"; exit 0; }
# seed: đổi mật khẩu, tin host key demo-sshd, tạo dự án df-<vai>, ghim máy
B="http://localhost:$port/api"
json() { python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('$1',''))"; }
T="$(curl -s -XPOST "$B/auth/login" -H 'content-type: application/json' -d "{\"password\":\"khoitao-$role-123\"}" | json accessToken)"
if [ -n "$T" ]; then
  T="$(curl -s -XPOST "$B/auth/password" -H "authorization: Bearer $T" -H 'content-type: application/json' -d "{\"currentPassword\":\"khoitao-$role-123\",\"newPassword\":\"dogfood-$role-123\"}" | json accessToken)"
else
  T="$(curl -s -XPOST "$B/auth/login" -H 'content-type: application/json' -d "{\"password\":\"dogfood-$role-123\"}" | json accessToken)"
fi
H="authorization: Bearer $T"
R="$(curl -s -XPOST "$B/hosts/demo-sshd/test" -H "$H" -H 'content-type: application/json' -d '{}')"
FP="$(echo "$R" | python3 -c "import json,sys;d=json.load(sys.stdin).get('details') or {};print(d.get('fingerprint',''))")"
KT="$(echo "$R" | python3 -c "import json,sys;d=json.load(sys.stdin).get('details') or {};print(d.get('keyType',''))")"
[ -n "$FP" ] && curl -s -o /dev/null -XPOST "$B/hosts/demo-sshd/trust-key" -H "$H" -H 'content-type: application/json' -d "{\"fingerprint\":\"$FP\",\"keyType\":\"$KT\"}"
curl -s -o /dev/null -XPUT "$B/workspace/pins" -H "$H" -H 'content-type: application/json' -d '{"hostIds":["local","demo-sshd"]}'
curl -s -o /dev/null -XPOST "$B/projects" -H "$H" -H 'content-type: application/json' -d "{\"hostId\":\"demo-sshd\",\"rootPath\":\"~/projects/df-$role\",\"name\":\"demo-api\"}"
echo "$role@inst-$port → http://localhost:$port (mật khẩu dogfood-$role-123, dự án demo-api ở demo-sshd:~/projects/df-$role)"
