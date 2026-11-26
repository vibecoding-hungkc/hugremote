import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@app/shared';
import { Roles } from '../../common/decorators';
import { CreateForwardDto, ForwardDto, ListeningPortDto, UpdateForwardDto } from './dto/forward.dto';
import { ForwardsService } from './forwards.service';

/** forwards-api.v1 — owner-only (G-17): mở cổng trên máy chủ là quyền chủ instance. */
@ApiTags('forwards')
@Controller()
@Roles(UserRole.OWNER)
export class ForwardsController {
  constructor(private readonly fw: ForwardsService) {}

  /** `?check=1`: kiểm thêm cổng đích của từng chuyển tiếp đang bật (S14 poll 5 giây — Authority 2026-11-26). */
  @Get('port-forwards')
  list(@Query('check') check?: string): Promise<ForwardDto[]> {
    return this.fw.list(check === '1');
  }

  @Post('port-forwards')
  create(@Body() dto: CreateForwardDto): Promise<ForwardDto> {
    return this.fw.create(dto);
  }

  @Patch('port-forwards/:id')
  update(@Param('id') id: string, @Body() dto: UpdateForwardDto): Promise<ForwardDto> {
    return this.fw.update(id, dto);
  }

  @Delete('port-forwards/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.fw.remove(id);
  }

  @Get('hosts/:id/listening-ports')
  listening(@Param('id') id: string): Promise<ListeningPortDto[]> {
    return this.fw.listening(id);
  }
}
