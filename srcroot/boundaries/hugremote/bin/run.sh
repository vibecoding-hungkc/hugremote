#!/usr/bin/env bash
# Chạy api HugRemote của bản đang dùng (`current`) với cấu hình ở $DATA_DIR/.env — dùng cho systemd/launchd/pidfile.
set -euo pipefail
DATA_DIR="${DATA_DIR:-$HOME/.config/hugremote}"
INSTALL_ROOT="${INSTALL_ROOT:-$HOME/.local/share/hugremote}"
set -a
# shellcheck disable=SC1091
[ -f "$DATA_DIR/.env" ] && . "$DATA_DIR/.env"
set +a
export DATA_DIR INSTALL_ROOT
export WEB_DIST="${WEB_DIST:-$INSTALL_ROOT/current/apps/web/dist}"
cd "$INSTALL_ROOT/current/apps/api"
exec node dist/main.js
