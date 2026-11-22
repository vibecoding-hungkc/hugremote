import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { UserRole } from '@app/shared';
import { Public, Roles } from '../../common/decorators';
import { APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';
import { setRefreshCookie } from '../auth/refresh-cookie';
import {
  AllowEmailDto,
  DenialDto,
  DiscoverResultDto,
  MemberDto,
  SsoConfigDto,
  SsoConfigInputDto,
  SsoDiscoverDto,
  SsoPublicDto,
} from './sso.dto';
import { SsoService } from './sso.service';

const provider = (p: string) => (p === 'google' ? 'google' : 'oidc');

@ApiTags('sso')
@Controller()
export class SsoController {
  constructor(
    private readonly sso: SsoService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  private app(hash: string) {
    return `${this.cfg.appUrl.replace(/\/+$/, '')}${this.cfg.basePath}/${hash}`;
  }

  @Public()
  @Get('auth/sso')
  publicInfo(): Promise<SsoPublicDto> {
    return this.sso.publicInfo();
  }

  /** Chuyển sang nhà cung cấp (PKCE S256 + state + nonce). `return` = hash đích sau khi đăng nhập (G-11). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('auth/sso/:provider')
  async start(@Param('provider') p: string, @Query('return') ret: string | undefined, @Res() res: Response) {
    try {
      res.redirect(302, await this.sso.start(provider(p), ret));
    } catch {
      res.redirect(302, this.app('#/login?sso_error=SSO_DISABLED'));
    }
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('auth/sso/:provider/callback')
  async callback(@Param('provider') p: string, @Query() q: Record<string, string | undefined>, @Req() req: Request, @Res() res: Response) {
    const r = await this.sso.callback(
      provider(p),
      { code: q.code, state: q.state, error: q.error },
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    if (r.error || !r.session?.refreshToken) {
      res.redirect(302, this.app(`#/login?sso_error=${r.error ?? 'SSO_FAILED'}`));
      return;
    }
    setRefreshCookie(res, r.session.refreshToken, this.cfg);
    // web đọc refresh cookie rồi về hash đích; access token không đi qua URL
    res.redirect(302, this.app(`#/login?sso=1&to=${encodeURIComponent(r.returnTo)}`));
  }

  @Roles(UserRole.OWNER)
  @Get('sso/config')
  config(): Promise<SsoConfigDto> {
    return this.sso.getConfig();
  }

  @Roles(UserRole.OWNER)
  @Put('sso/config')
  save(@Body() dto: SsoConfigInputDto): Promise<SsoConfigDto> {
    return this.sso.saveConfig(dto);
  }

  @Roles(UserRole.OWNER)
  @Post('sso/discover')
  @HttpCode(200)
  discover(@Body() dto: SsoDiscoverDto): Promise<DiscoverResultDto> {
    return this.sso.discover(dto.provider, dto.issuerUrl);
  }

  @Roles(UserRole.OWNER)
  @Post('sso/disable')
  @HttpCode(204)
  async disable() {
    await this.sso.disable();
  }

  @Roles(UserRole.OWNER)
  @Get('sso/members')
  members(): Promise<MemberDto[]> {
    return this.sso.members();
  }

  @Roles(UserRole.OWNER)
  @Delete('sso/members/:id')
  @HttpCode(204)
  async revoke(@Param('id') id: string) {
    await this.sso.revoke(id);
  }

  @Roles(UserRole.OWNER)
  @Post('sso/members/:id/restore')
  @HttpCode(204)
  async restore(@Param('id') id: string) {
    await this.sso.restore(id);
  }

  @Roles(UserRole.OWNER)
  @Get('sso/denials')
  denials(): Promise<DenialDto[]> {
    return this.sso.denials();
  }

  @Roles(UserRole.OWNER)
  @Post('sso/allow')
  @HttpCode(200)
  allow(@Body() dto: AllowEmailDto): Promise<SsoConfigDto> {
    return this.sso.allowEmail(dto.email);
  }
}
