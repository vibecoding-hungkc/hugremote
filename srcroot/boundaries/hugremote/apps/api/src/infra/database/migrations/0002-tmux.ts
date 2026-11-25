import { MigrationInterface, QueryRunner } from 'typeorm';

/** Vòng 3 — AC-54/55: cột nullable, bản ghi cũ = shell thường (chỉ thêm, G-8). */
export class Tmux1764028800000 implements MigrationInterface {
  name = 'Tmux1764028800000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE terminal_sessions ADD COLUMN tmux_name TEXT`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE terminal_sessions DROP COLUMN tmux_name`);
  }
}
