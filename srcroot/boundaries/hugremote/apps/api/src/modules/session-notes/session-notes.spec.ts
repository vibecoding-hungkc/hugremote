import { DataSource } from 'typeorm';
import { UserRole } from '@app/shared';
import type { AuthUser } from '../../common/auth-user';
import { SessionNotes1764122400000 } from '../../infra/database/migrations/0005-session-notes';
import { SessionNotesService } from './session-notes';

describe('Ghi chú phiên (Authority 2026-11-26)', () => {
  let db: DataSource;
  let svc: SessionNotesService;
  const owner = { id: 'o', role: UserRole.OWNER } as AuthUser;
  const a = { id: 'a', role: UserRole.MEMBER } as AuthUser;
  const b = { id: 'b', role: UserRole.MEMBER } as AuthUser;

  beforeAll(async () => {
    db = await new DataSource({ type: 'better-sqlite3', database: ':memory:' }).initialize();
    for (const t of ['terminal_sessions', 'claude_sessions', 'web_sessions'])
      await db.query(`CREATE TABLE ${t} (id TEXT PRIMARY KEY, owner_user_id TEXT)`);
    await db.query(`INSERT INTO terminal_sessions VALUES ('t1','a')`);
    await db.query(`INSERT INTO claude_sessions VALUES ('c1','b')`);
    await new SessionNotes1764122400000().up(db.createQueryRunner());
    svc = new SessionNotesService(db);
  });
  afterAll(() => db.destroy());

  it('chủ phiên ghi/sửa; member khác 403; phiên không có 404; owner thấy hết, member chỉ thấy của mình', async () => {
    await svc.put(a, 't1', '  chờ test staging  ');
    await svc.put(a, 't1', 'đã đổi');
    await expect(svc.put(b, 't1', 'phá')).rejects.toMatchObject({ status: 403 });
    await expect(svc.put(a, 'nope', 'x')).rejects.toMatchObject({ status: 404 });
    await svc.put(owner, 'c1', 'owner ghi hộ');
    expect((await svc.list(a)).map((n) => [n.sessionId, n.text])).toEqual([['t1', 'đã đổi']]);
    expect((await svc.list(owner)).length).toBe(2);
  });

  it('chữ rỗng = xoá; phiên bị xoá thì ghi chú biến mất', async () => {
    await svc.put(a, 't1', '   ');
    expect(await svc.list(a)).toEqual([]);
    await db.query(`DELETE FROM claude_sessions WHERE id = 'c1'`);
    expect(await svc.list(owner)).toEqual([]);
  });
});
