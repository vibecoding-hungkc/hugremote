import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/auth-user';
import { CreateTerminalDto, RenameTerminalDto, TerminalDto } from './dto/terminal.dto';
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
    return this.terminals.create(u, id, dto.name, dto.cwd);
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
