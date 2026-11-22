import { Body, Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@app/shared';
import { Roles } from '../../common/decorators';
import { CheckDto, LogsDto, SystemInfoDto, UpdateStartDto, UpdateStateDto } from './system.dto';
import { UpdaterService } from './updater.service';
import { SystemService, type LogKind } from './system.service';

@ApiTags('system')
@Roles(UserRole.OWNER)
@Controller()
export class SystemController {
  constructor(
    private readonly system: SystemService,
    private readonly updater: UpdaterService,
  ) {}

  /** Bản đang chạy, bản mới của kênh, tiến độ lần cập nhật gần nhất, số phiên đang chạy sẽ dừng (AC-31). */
  @Get('system/update')
  update(): Promise<UpdateStateDto> {
    return this.updater.state();
  }

  @Post('system/update')
  @HttpCode(202)
  start(@Body() dto: UpdateStartDto): Promise<UpdateStateDto> {
    return this.updater.start(dto.when);
  }

  /** Huỷ hẹn "cập nhật khi rảnh". */
  @Delete('system/update')
  @HttpCode(204)
  cancel() {
    this.updater.cancelWaiting();
  }

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
