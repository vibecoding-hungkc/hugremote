#!/bin/bash
# Chuẩn bị máy thử: khoá SSH riêng cho dev (không commit) + ssh config mẫu có Include. Chạy lại an toàn.
set -e
cd "$(dirname "$0")"
mkdir -p ssh/conf.d && chmod 700 ssh
[ -f ssh/dev_ed25519 ] || ssh-keygen -q -t ed25519 -N '' -C hugremote-dev -f ssh/dev_ed25519
KEY="$PWD/ssh/dev_ed25519"
cat > ssh/config <<CFG
# ssh config mẫu cho dev — trỏ SSH_CONFIG_PATH vào file này (deployment/local/.env)
Include $PWD/ssh/conf.d/*.conf

Host demo-sshd
  HostName 127.0.0.1
  Port 2222
  User dev
  IdentityFile $KEY
CFG
cat > ssh/conf.d/jump.conf <<CFG
Host demo-jump
  HostName 127.0.0.1
  Port 2223
  User dev
  IdentityFile $KEY

Host demo-behind-jump
  HostName demo-behind
  User dev
  IdentityFile $KEY
  ProxyJump demo-jump
CFG
chmod 600 ssh/config ssh/conf.d/*.conf
echo "ssh config mẫu: $PWD/ssh/config"
