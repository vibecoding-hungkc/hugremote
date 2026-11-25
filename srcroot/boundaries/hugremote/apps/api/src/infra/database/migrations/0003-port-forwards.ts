import { MigrationInterface, QueryRunner } from 'typeorm';

/** Vòng 3 — AC-57: bảng mới, chỉ thêm (G-8). */
export class PortForwards1764032400000 implements MigrationInterface {
  name = 'PortForwards1764032400000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE port_forwards (
      id TEXT PRIMARY KEY,
      direction TEXT NOT NULL CHECK (direction IN ('L','R')),
      host_id TEXT NOT NULL,
      remote_host TEXT NOT NULL,
      remote_port INTEGER NOT NULL CHECK (remote_port BETWEEN 1 AND 65535),
      local_port INTEGER NOT NULL CHECK (local_port BETWEEN 1 AND 65535),
      label TEXT,
      auto_start INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`);
    await q.query(`CREATE UNIQUE INDEX port_forwards_local_l ON port_forwards(local_port) WHERE direction = 'L'`);
    await q.query(`CREATE UNIQUE INDEX port_forwards_remote_r ON port_forwards(host_id, remote_port) WHERE direction = 'R'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE port_forwards`);
  }
}
