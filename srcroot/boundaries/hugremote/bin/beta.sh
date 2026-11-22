#!/usr/bin/env bash
# Cài HugRemote kênh beta (AC-29): curl -fsSL <địa chỉ>/beta.sh | bash
here="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo .)"
if [ -f "$here/install.sh" ]; then exec bash "$here/install.sh" --beta "$@"; fi
curl -fsSL "${HUGREMOTE_INSTALL_URL:-https://raw.githubusercontent.com/hugremote/hugremote/main/bin/install.sh}" | bash -s -- --beta "$@"
