import { Body, Controller, Get, Injectable, Module, Param, Put } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { ErrorCode, UserRole } from '@app/shared';
import { AppError } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators';

export const NOTE_MAX = 500;

export class NoteBody {
  /** Rỗng = xoá ghi chú. */
  @IsString() @MaxLength(NOTE_MAX) text!: string;
}
export class SessionNoteDto {
  @ApiProperty() sessionId!: string;
  @ApiProperty() text!: string;
  @ApiProperty() updatedAt!: string;
}

/** Ba bảng phiên — ghi chú gắn với bất kỳ loại nào; phiên bị xoá thì ghi chú tự rơi khỏi kết quả (JOIN) và bị dọn ở lần ghi. */
const SESSIONS = `SELECT id, owner_user_id FROM terminal_sessions UNION ALL SELECT id, owner_user_id FROM claude_sessions UNION ALL SELECT id, owner_user_id FROM web_sessions`;

@Injectable()
export class SessionNotesService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** G-13: member chỉ thấy ghi chú phiên của mình, owner thấy tất cả. */
  async list(u: AuthUser): Promise<SessionNoteDto[]> {
    const all = u.role === UserRole.OWNER;
    const rows: { session_id: string; text: string; updated_at: string }[] = await this.db.query(
      `SELECT n.session_id, n.text, n.updated_at FROM session_notes n JOIN (${SESSIONS}) s ON s.id = n.session_id${all ? '' : ' WHERE s.owner_user_id = ?'}`,
      all ? [] : [u.id],
    );
    return rows.map((r) => ({ sessionId: r.session_id, text: r.text, updatedAt: r.updated_at }));
  }

  async put(u: AuthUser, sessionId: string, raw: string): Promise<SessionNoteDto> {
    const [s]: { owner_user_id: string }[] = await this.db.query(`SELECT owner_user_id FROM (${SESSIONS}) WHERE id = ?`, [sessionId]);
    if (!s) throw AppError.notFound();
    if (u.role !== UserRole.OWNER && s.owner_user_id !== u.id) throw AppError.forbidden(ErrorCode.NOT_SESSION_OWNER);
    const text = raw.trim().slice(0, NOTE_MAX);
    const updatedAt = new Date().toISOString();
    if (text)
      await this.db.query(
        `INSERT INTO session_notes (session_id, text, updated_at) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`,
        [sessionId, text, updatedAt],
      );
    else await this.db.query(`DELETE FROM session_notes WHERE session_id = ?`, [sessionId]);
    // ponytail: dọn ghi chú mồ côi (phiên đã xoá) mỗi lần ghi — bảng nhỏ, không cần trigger trên ba bảng phiên
    await this.db.query(`DELETE FROM session_notes WHERE session_id NOT IN (SELECT id FROM (${SESSIONS}))`);
    return { sessionId, text, updatedAt };
  }
}

/** session-notes-api.v1 — ghi chú từng phiên (Authority 2026-11-26). */
@ApiTags('session-notes')
@Controller()
export class SessionNotesController {
  constructor(private readonly notes: SessionNotesService) {}

  @Get('session-notes')
  list(@CurrentUser() u: AuthUser): Promise<SessionNoteDto[]> {
    return this.notes.list(u);
  }

  @Put('session-notes/:sessionId')
  put(@CurrentUser() u: AuthUser, @Param('sessionId') id: string, @Body() b: NoteBody): Promise<SessionNoteDto> {
    return this.notes.put(u, id, b.text);
  }
}

@Module({ controllers: [SessionNotesController], providers: [SessionNotesService] })
export class SessionNotesModule {}
