#!/usr/bin/env bash
# Kênh phát hành giả cho thử cài/cập nhật (AC-29/31): bare repo từ subtree srcroot/boundaries/hugremote của HEAD,
# tag stable v0.1.0 · v0.2.0 (bản tốt) và beta v0.3.0-beta.1 (bản hỏng — api thoát ngay, để thử tự quay lại).
# Dùng: deployment/local/release-channel.sh  →  in UPDATE_REPO=file://…/releases.git
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"
out="$here/releases.git"; work="$(mktemp -d)"
rm -rf "$out"
cd "$repo"
sha="$(git subtree split --prefix=srcroot/boundaries/hugremote HEAD 2>/dev/null)"
git init -q --bare "$out"
git push -q "$out" "$sha:refs/heads/main"
git clone -q "$out" "$work/r"; cd "$work/r"
git -c user.email=dev@local -c user.name=dev tag v0.1.0
bump() { node -e "const f='package.json',p=JSON.parse(require('fs').readFileSync(f));p.version='$1';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"; }
bump 0.2.0; git -c user.email=dev@local -c user.name=dev commit -qam "0.2.0"; git tag v0.2.0
bump 0.3.0-beta.1
# bản hỏng: api thoát ngay khi khởi động → health check lỗi
node -e "const f='apps/api/src/main.ts',fs=require('fs');fs.writeFileSync(f,'process.exit(3);\\n'+fs.readFileSync(f,'utf8'))"
git -c user.email=dev@local -c user.name=dev commit -qam "0.3.0-beta.1 (hỏng)"; git tag v0.3.0-beta.1
git push -q --tags origin main
rm -rf "$work"
echo "UPDATE_REPO=file://$out"
