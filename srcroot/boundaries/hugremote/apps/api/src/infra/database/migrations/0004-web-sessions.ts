import { MigrationInterface, QueryRunner } from 'typeorm';

/** Vòng 3 — AC-59: bảng mới, chỉ thêm (G-8). */
export class WebSessions1764036000000 implements MigrationInterface {
  name = 'WebSessions1764036000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE web_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_opened_at TEXT
    )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE web_sessions`);
  }
}
