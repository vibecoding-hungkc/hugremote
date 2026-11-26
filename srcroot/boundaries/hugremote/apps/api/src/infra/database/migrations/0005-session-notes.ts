import { MigrationInterface, QueryRunner } from 'typeorm';

/** Vòng 3 — ghi chú phiên (Authority 2026-11-26): bảng mới, chỉ thêm (G-8). Khoá theo id phiên (terminal · Claude · web đều UUID). */
export class SessionNotes1764122400000 implements MigrationInterface {
  name = 'SessionNotes1764122400000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE session_notes (
      session_id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE session_notes`);
  }
}
