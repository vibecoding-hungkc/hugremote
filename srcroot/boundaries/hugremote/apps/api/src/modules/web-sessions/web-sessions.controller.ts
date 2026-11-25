import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators';
import { WebSessionBody, WebSessionDto, WebSessionPatch } from './dto/web-session.dto';
import { WebSessionsService } from './web-sessions';

/** web-sessions-api.v1 (vòng 3). */
@ApiTags('web-sessions')
@Controller()
export class WebSessionsController {
  constructor(private readonly web: WebSessionsService) {}

  @Get('web-sessions')
  list(@CurrentUser() u: AuthUser): Promise<WebSessionDto[]> {
    return this.web.list(u);
  }

  @Post('projects/:id/web-sessions')
  create(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: WebSessionBody): Promise<WebSessionDto> {
    return this.web.create(u, id, b.url);
  }

  @Patch('web-sessions/:id')
  patch(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: WebSessionPatch): Promise<WebSessionDto> {
    return this.web.patch(u, id, b);
  }

  @Delete('web-sessions/:id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.web.remove(u, id);
  }
}
