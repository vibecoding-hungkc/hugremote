import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadConfig } from '../../config/app-config';
import { secureDataDir } from '../../common/data-dir';
import { dataSourceOptions } from './data-source';

/** `make migrate`: chạy migration có version trên SQLite của DATA_DIR (G-8). App cũng tự chạy khi khởi động. */
async function main() {
  const cfg = loadConfig();
  const ds = new DataSource(dataSourceOptions(cfg.dataDir));
  await ds.initialize();
  const ran = await ds.runMigrations();
  await ds.destroy();
  secureDataDir(cfg.dataDir);
  console.log(ran.length ? `Đã chạy ${ran.length} migration: ${ran.map((m) => m.name).join(', ')}` : 'DB đã ở bản mới nhất');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
