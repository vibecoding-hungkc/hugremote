// node-pty 1.1.x đóng gói spawn-helper (macOS) thiếu quyền thực thi → posix_spawnp failed.
// Chạy sau mỗi lần `pnpm install` để cấp lại quyền; không làm gì trên nền tảng khác.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'node_modules', '.pnpm');
if (!fs.existsSync(root)) process.exit(0);
for (const dir of fs.readdirSync(root).filter((d) => d.startsWith('node-pty@'))) {
  const pre = path.join(root, dir, 'node_modules', 'node-pty', 'prebuilds');
  if (!fs.existsSync(pre)) continue;
  for (const plat of fs.readdirSync(pre)) {
    const helper = path.join(pre, plat, 'spawn-helper');
    if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
  }
}
