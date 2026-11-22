#!/bin/sh
# Khoá công khai của dev được mount ở /seed/authorized_keys; mật khẩu thử lấy từ biến DEV_PASSWORD
set -e
chown dev:dev /home/dev/.ssh && chmod 700 /home/dev/.ssh
[ -f /seed/authorized_keys ] && install -o dev -g dev -m 600 /seed/authorized_keys /home/dev/.ssh/authorized_keys
[ -n "$DEV_PASSWORD" ] && echo "dev:$DEV_PASSWORD" | chpasswd
# Đổi host key giả lập "khoá đổi" (AC-6): đặt ROTATE_HOST_KEY=1
if [ "$ROTATE_HOST_KEY" = "1" ] || [ ! -f /etc/ssh/ssh_host_ed25519_key ]; then rm -f /etc/ssh/ssh_host_*; ssh-keygen -A >/dev/null; fi
exec /usr/sbin/sshd -D -e
