# Tải + dựng một bản phát hành vào $INSTALL_ROOT/releases/<tag> (dùng chung cho install.sh và isolated-update.sh).
# Kênh phát hành = tag git của $UPDATE_REPO: stable `vX.Y.Z`, beta thêm `vX.Y.Z-beta.N`.

latest_tag() { # $1 = stable|beta
  local pat='^v[0-9]+\.[0-9]+\.[0-9]+$'
  [ "$1" = "beta" ] && pat='^v[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?$'
  git ls-remote --tags --refs "$UPDATE_REPO" 2>/dev/null | sed 's#.*refs/tags/##' | grep -E "$pat" | sort -V | tail -1
}

build_release() { # $1 = tag ; in tiến độ dạng `STEP <tên>` để updater ghi trạng thái
  local tag="$1" dest="$INSTALL_ROOT/releases/$1" tmp="$INSTALL_ROOT/releases/.$1.tmp"
  if [ -f "$dest/.built" ]; then echo "STEP ok fetch install build (đã có sẵn $tag)"; return 0; fi
  rm -rf "$tmp"; mkdir -p "$INSTALL_ROOT/releases"
  echo "STEP fetch"
  git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$tag" "$UPDATE_REPO" "$tmp"
  echo "STEP install"
  (cd "$tmp" && corepack enable >/dev/null 2>&1 || true; cd "$tmp" && pnpm install --frozen-lockfile --reporter=silent)
  echo "STEP build"
  (cd "$tmp" && pnpm run build >/dev/null)
  touch "$tmp/.built"
  rm -rf "$dest"; mv "$tmp" "$dest"
}

switch_to() { # trỏ `current` sang bản $1 (đổi tên nguyên tử)
  ln -sfn "releases/$1" "$INSTALL_ROOT/current.new"
  mv -fT "$INSTALL_ROOT/current.new" "$INSTALL_ROOT/current" 2>/dev/null || { rm -f "$INSTALL_ROOT/current"; mv "$INSTALL_ROOT/current.new" "$INSTALL_ROOT/current"; }
}

health_ok() { # chờ tối đa 40s
  local url="http://${HC_HOST:-127.0.0.1}:${PORT:-8099}${BASE_PATH:-}/api/health"
  for _ in $(seq 1 40); do curl -sf "$url" >/dev/null 2>&1 && return 0; sleep 1; done
  return 1
}
