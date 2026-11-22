import * as fs from 'node:fs';
import * as path from 'node:path';

/** Quyền file dữ liệu (G-6): thư mục 0700, DB/WAL/khoá/known_hosts/log 0600. Gọi khi khởi động và từ `doctor --fix`. */
export function secureDataDir(dataDir: string): string[] {
  const fixed: string[] = [];
  const fix = (p: string, mode: number) => {
    if (!fs.existsSync(p)) return;
    if ((fs.statSync(p).mode & 0o777) !== mode) {
      fs.chmodSync(p, mode);
      fixed.push(p);
    }
  };
  fix(dataDir, 0o700);
  fix(path.join(dataDir, 'logs'), 0o700);
  for (const f of ['hugremote.db', 'hugremote.db-wal', 'hugremote.db-shm', 'secret.key', 'known_hosts']) fix(path.join(dataDir, f), 0o600);
  const logs = path.join(dataDir, 'logs');
  if (fs.existsSync(logs)) for (const f of fs.readdirSync(logs)) fix(path.join(logs, f), 0o600);
  return fixed;
}
