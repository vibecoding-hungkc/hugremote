#!/usr/bin/env bash
# `make deploy` (ARCHITECTURE §5, DECISIONS 2026-11-22): cắt bản phát hành mới — tăng patch
# version, tag git, đẩy subtree srcroot/boundaries/hugremote lên $UPDATE_REPO (kênh phát hành
# mà máy đích đọc qua `hugremote update`). Không có máy chủ riêng để "deploy" vào — kiến trúc
# tự host, mỗi máy tự kéo bản mới về (release.sh). Yêu cầu UPDATE_REPO đã chốt (context/shared/DEPLOY.md §1).
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
PREFIX="srcroot/boundaries/hugremote"
PKG="$PREFIX/package.json"

[ -n "${UPDATE_REPO:-}" ] || {
  echo "✗ UPDATE_REPO chưa đặt." >&2
  echo "  Đây là nơi máy đích kéo bản cập nhật về (context/shared/DEPLOY.md §1) — Authority chốt rồi đặt trong deployment/local/.env hoặc biến môi trường." >&2
  echo "  Thử kênh giả để kiểm luồng: \$(deployment/local/release-channel.sh)" >&2
  exit 1
}

git diff --quiet -- "$PREFIX" || { echo "✗ còn thay đổi chưa commit trong $PREFIX — commit trước khi deploy" >&2; exit 1; }
git diff --cached --quiet -- "$PREFIX" || { echo "✗ còn thay đổi đã stage chưa commit trong $PREFIX — commit trước khi deploy" >&2; exit 1; }

cur="$(node -p "require('./$PKG').version")"
IFS=. read -r maj min patch <<<"$cur"
next="$maj.$min.$((patch + 1))"
tag="v$next"

node -e "const f='$PKG',fs=require('fs'),p=JSON.parse(fs.readFileSync(f));p.version='$next';fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
git add "$PKG"
git commit -q -m "release: $tag"

sha="$(git subtree split --prefix="$PREFIX" HEAD)"
git push -q "$UPDATE_REPO" "$sha:refs/heads/main"
git tag -a "$tag" "$sha" -m "$tag"
git push -q "$UPDATE_REPO" "$tag"

echo "✓ Đã đẩy $tag lên $UPDATE_REPO"
echo "  Máy đích: hugremote update   (hoặc chờ kiểm tự động nếu đã bật)"
