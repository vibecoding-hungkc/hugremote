import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@app/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import type { AuthUser } from '../../common/auth-user';
import { HostsService } from './hosts.service';
import {
  HostDto,
  HostInputDto,
  HostListDto,
  HostPatchDto,
  HostTestDto,
  PinsDto,
  SshKeyDto,
  TestResultDto,
  TrustKeyDto,
} from './dto/hosts.dto';

/** hosts-api.v1 + ghim (workspace-api.v1). Ghi máy chỉ owner; member xem + ghim của mình (PERSONAS §2). */
@ApiTags('hosts')
@Controller()
export class HostsController {
  constructor(private readonly hosts: HostsService) {}

  @Get('hosts')
  list(@CurrentUser() u: AuthUser): Promise<HostListDto> {
    return this.hosts.list(u);
  }

  @Roles(UserRole.OWNER)
  @Post('hosts')
  create(@Body() dto: HostInputDto): Promise<HostDto> {
    return this.hosts.create(dto);
  }

  @Roles(UserRole.OWNER)
  @Patch('hosts/:id')
  update(@Param('id') id: string, @Body() dto: HostPatchDto): Promise<HostDto> {
    return this.hosts.update(id, dto);
  }

  @Roles(UserRole.OWNER)
  @Delete('hosts/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.hosts.remove(id);
  }

  /** Thử kết nối máy đã lưu (body đè giá trị đang sửa). */
  @Roles(UserRole.OWNER)
  @Post('hosts/:id/test')
  @HttpCode(200)
  test(@Param('id') id: string, @Body() dto: HostTestDto): Promise<TestResultDto> {
    return this.hosts.test(id === '_new' ? undefined : id, dto);
  }

  @Roles(UserRole.OWNER)
  @Post('hosts/:id/trust-key')
  @HttpCode(204)
  async trust(@Param('id') id: string, @Body() dto: TrustKeyDto) {
    await this.hosts.trustKey(id, dto.fingerprint, dto.keyType, dto.host, dto.port);
  }

  @Roles(UserRole.OWNER)
  @Post('hosts/:id/disconnect')
  @HttpCode(204)
  disconnect(@Param('id') id: string) {
    this.hosts.disconnect(id);
  }

  @Roles(UserRole.OWNER)
  @Get('ssh-keys')
  keys(): SshKeyDto[] {
    return this.hosts.sshKeys();
  }

  @Get('workspace/pins')
  pins(@CurrentUser() u: AuthUser): Promise<string[]> {
    return this.hosts.pins(u);
  }

  @Put('workspace/pins')
  setPins(@CurrentUser() u: AuthUser, @Body() dto: PinsDto): Promise<string[]> {
    return this.hosts.setPins(u, dto.hostIds);
  }
}
