#!/usr/bin/env bash
# Cập nhật cô lập (AC-31): tải + dựng bản mới ở thư mục riêng → trỏ `current` → khởi động lại → health check
# → lỗi thì quay về bản trước. Chạy tách hẳn khỏi api (setsid/nohup) vì sẽ khởi động lại chính api.
# Ghi tiến độ vào $DATA_DIR/update-status.json (api đọc để hiện ở S7) và $DATA_DIR/logs/update.log.
#   isolated-update.sh <tag> <run-id>
set -uo pipefail
TAG="$1"; RUN="${2:-manual}"
DATA_DIR="${DATA_DIR:-$HOME/.config/hugremote}"
INSTALL_ROOT="${INSTALL_ROOT:-$HOME/.local/share/hugremote}"
set -a; [ -f "$DATA_DIR/.env" ] && . "$DATA_DIR/.env"; set +a
export DATA_DIR INSTALL_ROOT
here="$(cd "$(dirname "$0")" && pwd)"
# thư viện lấy từ bản ĐANG chạy được sao chép ra trước (bản cũ có thể bị đổi giữa chừng)
. "$here/lib/release.sh"; . "$here/lib/service.sh"

STATUS="$DATA_DIR/update-status.json"; LOG="$DATA_DIR/logs/update.log"
FROM="$(basename "$(readlink "$INSTALL_ROOT/current" 2>/dev/null)" 2>/dev/null || echo '?')"
# bash 3.2 (macOS) không có mảng kết hợp → hai mảng song song
steps=(fetch install build switch health)
stv=(pending pending pending pending pending)
set_st() { local i; for i in 0 1 2 3 4; do [ "${steps[$i]}" = "$1" ] && stv[$i]="$2"; done; }
log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" >> "$LOG"; }
write() { # $1 trạng thái chung
  local s='' i
  for i in 0 1 2 3 4; do s="$s{\"name\":\"${steps[$i]}\",\"status\":\"${stv[$i]}\"},"; done
  printf '{"runId":"%s","from":"%s","to":"%s","status":"%s","steps":[%s],"at":"%s"}\n' "$RUN" "$FROM" "$TAG" "$1" "${s%,}" "$(date -u +%FT%TZ)" > "$STATUS.tmp" && mv "$STATUS.tmp" "$STATUS"
}
fail() { log "ERROR $*"; write failed; exit 1; }

mkdir -p "$DATA_DIR/logs"
log "INFO  Bắt đầu cập nhật $FROM → $TAG (run $RUN)"
set_st fetch running; write running
while IFS= read -r line; do
  case "$line" in
    "STEP fetch") set_st fetch running ;;
    "STEP install") set_st fetch ok; set_st install running ;;
    "STEP build") set_st install ok; set_st build running ;;
    "STEP ok"*) set_st fetch ok; set_st install ok; set_st build ok ;;
    *) log "      $line"; continue ;;
  esac
  write running; log "INFO  ${line#STEP }"
done < <(build_release "$TAG" 2>&1; echo "RC $?")
[ -f "$INSTALL_ROOT/releases/$TAG/.built" ] || fail "Dựng bản $TAG thất bại — giữ nguyên $FROM"
set_st fetch ok; set_st install ok; set_st build ok; set_st switch running; write running

PREV="$FROM"
switch_to "$TAG"; log "INFO  Chuyển current → $TAG, khởi động lại"
service_restart
set_st switch ok; set_st health running; write running
HC_HOST="${HOST:-127.0.0.1}"; [ "$HC_HOST" = 0.0.0.0 ] && HC_HOST=127.0.0.1
if HC_HOST="$HC_HOST" health_ok; then
  set_st health ok; write done; log "INFO  Đã cập nhật lên $TAG"
  # giữ 3 bản gần nhất
  ls -1t "$INSTALL_ROOT/releases" | grep -v '^\.' | tail -n +4 | while read -r old; do [ "$old" != "$TAG" ] && rm -rf "$INSTALL_ROOT/releases/$old"; done
else
  set_st health failed
  log "ERROR Health check bản $TAG thất bại — quay về $PREV"
  switch_to "$PREV"; service_restart
  HC_HOST="$HC_HOST" health_ok && log "INFO  Đã quay về $PREV" || log "ERROR Bản $PREV cũng không lên — chạy hugremote doctor"
  write rolled_back
fi
