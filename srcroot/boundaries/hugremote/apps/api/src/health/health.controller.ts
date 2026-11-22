import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../common/decorators';

/** `/api/health` công khai — chỉ trả `{status}`, không lộ chi tiết (AC-15). */
@ApiTags('system')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  async check() {
    const r = await this.health.check([() => this.db.pingCheck('db')]);
    return { status: r.status };
  }
}
