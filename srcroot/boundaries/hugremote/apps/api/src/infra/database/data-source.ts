import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { loadConfig } from '../../config/app-config';
import { Init1763769600000 } from './migrations/0001-init';
import { Tmux1764028800000 } from './migrations/0002-tmux';
import { PortForwards1764032400000 } from './migrations/0003-port-forwards';
import { WebSessions1764036000000 } from './migrations/0004-web-sessions';
import { SessionNotes1764122400000 } from './migrations/0005-session-notes';

/** SQLite trong DATA_DIR, 0600, WAL (TECHSTACK §1). synchronize luôn tắt (G-8). */
export function dataSourceOptions(dataDir = loadConfig().dataDir): DataSourceOptions {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(dataDir, 'hugremote.db');
  return {
    type: 'better-sqlite3',
    database: file,
    synchronize: false,
    migrationsRun: false,
    migrations: [Init1763769600000, Tmux1764028800000, PortForwards1764032400000, WebSessions1764036000000, SessionNotes1764122400000],
    entities: [],
    prepareDatabase: (db: { pragma: (s: string) => unknown }) => {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000');
    },
  };
}

export default new DataSource(dataSourceOptions());
