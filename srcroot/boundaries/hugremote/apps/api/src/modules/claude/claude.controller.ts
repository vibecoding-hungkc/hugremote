import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Res, Sse, type MessageEvent } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { from, Observable, switchMap, throwError } from 'rxjs';
import { ErrorCode } from '@app/shared';
import { AppError } from '../../common/app-error';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/auth-user';
import { AuthService } from '../auth/auth.service';
import { ClaudeService } from './claude.service';
import {
  ClaudeLimitsDto,
  CliSessionDto,
  CreateClaudeSessionDto,
  ClaudeOptionsDto,
  AnswerDto,
  ClaudeSessionDto,
  PatchClaudeDto,
  QueueItemDto,
  SendMessageDto,
  SendResultDto,
} from './dto/claude.dto';

/** claude-api.v1 + claude-stream.v1. Mọi thao tác lọc chủ phiên khi người gọi là member (G-13). */
@ApiTags('claude')
@Controller()
export class ClaudeController {
  constructor(
    private readonly claude: ClaudeService,
    private readonly auth: AuthService,
  ) {}

  @Get('projects/:id/claude/sessions')
  list(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<ClaudeSessionDto[]> {
    return this.claude.list(u, id);
  }

  /** Model + effort + slash command lấy từ CLI trên đúng máy và thư mục dự án (AC-22, AC-24). */
  @Get('projects/:id/claude/options')
  options(@Param('id') id: string): Promise<ClaudeOptionsDto> {
    return this.claude.options(id);
  }

  /** Phiên Claude CLI có sẵn trong thư mục dự án, chưa gắn với phiên nào ở HugRemote (AC-23). */
  @Get('projects/:id/claude/cli-sessions')
  cliSessions(@Param('id') id: string): Promise<CliSessionDto[]> {
    return this.claude.cliSessions(id);
  }

  /** Hạn mức 5 giờ / tuần do CLI báo; CLI không báo → rỗng, web ẩn chip (AC-25). */
  @Get('projects/:id/claude/limits')
  limits(@Param('id') id: string): Promise<ClaudeLimitsDto> {
    return this.claude.limits(id);
  }

  @Get('claude/sessions')
  all(@CurrentUser() u: AuthUser): Promise<ClaudeSessionDto[]> {
    return this.claude.listAll(u);
  }

  @Post('projects/:id/claude/sessions')
  create(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CreateClaudeSessionDto): Promise<ClaudeSessionDto> {
    return this.claude.create(u, id, dto);
  }

  @Patch('claude/sessions/:id')
  patch(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: PatchClaudeDto): Promise<ClaudeSessionDto> {
    return this.claude.patch(u, id, dto);
  }

  @Delete('claude/sessions/:id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.claude.remove(u, id);
  }

  /** Phiên rảnh → 200 `{queued:false}`; đang chạy → 202 `{queued:true, queueId}` (AC-40). */
  @Post('claude/sessions/:id/messages')
  async send(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SendResultDto> {
    const r = await this.claude.send(u, id, dto.text, dto.attachments);
    res.status(r.queued ? 202 : 200);
    return r;
  }

  @Get('claude/sessions/:id/queue')
  queue(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<QueueItemDto[]> {
    return this.claude.queue(u, id);
  }

  @Delete('claude/sessions/:id/queue/:qid')
  @HttpCode(204)
  async unqueue(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('qid') qid: string) {
    await this.claude.unqueue(u, id, qid);
  }

  @Post('claude/sessions/:id/queue/resume')
  @HttpCode(204)
  async resume(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.claude.resumeQueue(u, id);
  }

  @Post('claude/sessions/:id/cancel')
  @HttpCode(204)
  async cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.claude.cancel(u, id);
  }

  @Post('claude/sessions/:id/interactions/:iid')
  @HttpCode(204)
  async answer(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('iid') iid: string, @Body() dto: AnswerDto) {
    await this.claude.answer(u, id, iid, dto.decision, dto.answers);
  }

  /** SSE — vé 30s (EventSource không gửi được header); `after` hoặc `Last-Event-ID` để phát lại phần thiếu. */
  @Public()
  @Sse('claude/sessions/:id/stream')
  stream(
    @Param('id') id: string,
    @Query('ticket') ticket?: string,
    @Query('after') after?: string,
    @Headers('last-event-id') lastId?: string,
  ): Observable<MessageEvent> {
    return from(this.auth.consumeTicket(ticket)).pipe(
      switchMap((u) => {
        if (!u) return throwError(() => AppError.unauthorized(ErrorCode.TICKET_INVALID));
        const a = lastId ?? after;
        return from(this.claude.stream(u, id, a !== undefined && a !== '' ? Number(a) : undefined)).pipe(switchMap((o) => o));
      }),
    );
  }
}
