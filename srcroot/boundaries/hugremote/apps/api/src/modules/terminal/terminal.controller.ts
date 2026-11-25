import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/auth-user';
import { CreateTerminalDto, RenameTerminalDto, TerminalDto, TmuxSessionDto } from './dto/terminal.dto';
import { TerminalService } from './terminal.service';

/** terminal-api.v1 — mọi thao tác lọc theo chủ phiên khi người gọi là member (G-13). */
@ApiTags('terminal')
@Controller()
export class TerminalController {
  constructor(private readonly terminals: TerminalService) {}

  @Get('projects/:id/terminals')
  list(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<TerminalDto[]> {
    return this.terminals.list(u, id);
  }

  @Get('terminals')
  all(@CurrentUser() u: AuthUser): Promise<TerminalDto[]> {
    return this.terminals.listAll(u);
  }

  @Post('projects/:id/terminals')
  create(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CreateTerminalDto): Promise<TerminalDto> {
    return this.terminals.create(u, id, dto.name, dto.cwd, dto.tmux);
  }

  /** Vòng 3 — AC-54: `tmux ls` của máy chứa dự án. */
  @Get('projects/:id/tmux-sessions')
  tmux(@Param('id') id: string): Promise<TmuxSessionDto[]> {
    return this.terminals.tmuxSessions(id);
  }

  /** Vòng 3 — AC-56: mở lại ngay tại tab cũ (giữ id). */
  @Post('terminals/:id/reopen')
  reopen(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<TerminalDto> {
    return this.terminals.reopen(u, id);
  }

  @Patch('terminals/:id')
  rename(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RenameTerminalDto): Promise<TerminalDto> {
    return this.terminals.rename(u, id, dto.name);
  }

  @Delete('terminals/:id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.terminals.remove(u, id);
  }
}
