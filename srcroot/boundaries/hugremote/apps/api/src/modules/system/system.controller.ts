import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@app/shared';
import { Roles } from '../../common/decorators';
import { CheckDto, LogsDto, SystemInfoDto } from './system.dto';
import { SystemService, type LogKind } from './system.service';

@ApiTags('system')
@Roles(UserRole.OWNER)
@Controller()
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('system/info')
  info(): Promise<SystemInfoDto> {
    return this.system.info();
  }

  @Get('system/checks')
  checks(): Promise<CheckDto[]> {
    return this.system.checks();
  }

  /** Nhật ký trong app: `app` · `ssh` (lọc từ app.log) · `update` (AC-46). */
  @Get('system/logs')
  logs(@Query('kind') kind?: string): LogsDto {
    const k: LogKind = kind === 'ssh' || kind === 'update' ? kind : 'app';
    return { kind: k, lines: this.system.logs(k) };
  }
}
