# Cài / khởi động lại user service (AC-29). Dùng chung cho install.sh, isolated-update.sh, `hugremote restart`.
# SERVICE_MODE: systemd (Linux) · launchd (macOS) · pidfile (không cài service — thử nghiệm, container).
LABEL="vn.hugremote"

service_mode() {
  if [ -n "${SERVICE_MODE:-}" ]; then echo "$SERVICE_MODE"; return; fi
  case "$(uname -s)" in
    Darwin) echo launchd ;;
    Linux) if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then echo systemd; else echo pidfile; fi ;;
    *) echo pidfile ;;
  esac
}

service_install() {
  local mode; mode="$(service_mode)"
  case "$mode" in
    systemd)
      mkdir -p "$HOME/.config/systemd/user"
      cat > "$HOME/.config/systemd/user/hugremote.service" <<UNIT
[Unit]
Description=HugRemote
After=network-online.target

[Service]
Environment=DATA_DIR=$DATA_DIR
Environment=INSTALL_ROOT=$INSTALL_ROOT
ExecStart=/usr/bin/env bash $INSTALL_ROOT/current/bin/run.sh
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
UNIT
      systemctl --user daemon-reload
      systemctl --user enable --now hugremote.service
      command -v loginctl >/dev/null 2>&1 && loginctl enable-linger "$USER" 2>/dev/null || true
      ;;
    launchd)
      mkdir -p "$HOME/Library/LaunchAgents"
      local plist="$HOME/Library/LaunchAgents/$LABEL.plist"
      cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$INSTALL_ROOT/current/bin/run.sh</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>DATA_DIR</key><string>$DATA_DIR</string>
    <key>INSTALL_ROOT</key><string>$INSTALL_ROOT</string>
    <key>PATH</key><string>$PATH</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>$DATA_DIR/logs/service.log</string>
  <key>StandardErrorPath</key><string>$DATA_DIR/logs/service.log</string>
</dict></plist>
PLIST
      launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
      launchctl bootstrap "gui/$(id -u)" "$plist"
      ;;
    pidfile) service_start_pidfile ;;
  esac
}

service_start_pidfile() {
  mkdir -p "$DATA_DIR/logs"
  DATA_DIR="$DATA_DIR" INSTALL_ROOT="$INSTALL_ROOT" nohup bash "$INSTALL_ROOT/current/bin/run.sh" >> "$DATA_DIR/logs/service.log" 2>&1 &
  echo $! > "$DATA_DIR/hugremote.pid"
}

service_restart() {
  case "$(service_mode)" in
    systemd) systemctl --user restart hugremote.service ;;
    launchd) launchctl kickstart -k "gui/$(id -u)/$LABEL" ;;
    pidfile)
      if [ -f "$DATA_DIR/hugremote.pid" ]; then
        kill "$(cat "$DATA_DIR/hugremote.pid")" 2>/dev/null || true
        for _ in $(seq 1 50); do kill -0 "$(cat "$DATA_DIR/hugremote.pid")" 2>/dev/null || break; sleep 0.1; done
      fi
      service_start_pidfile
      ;;
  esac
}
