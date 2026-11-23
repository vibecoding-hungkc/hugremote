import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Inject } from '@nestjs/common';
import { APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';
import { ErrorCode, UserRole } from '@app/shared';
import { AppError } from '../../common/app-error';
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from './refresh-cookie';
import { AllowPending, CurrentUser, Public, Roles } from '../../common/decorators';
import type { AuthUser } from '../../common/auth-user';
import { AuthService, ClientCtx, IssuedSession } from './auth.service';
import {
  ChangePasswordDto,
  DeviceDto,
  LoginDto,
  MeResponseDto,
  PreferencesDto,
  PreferencesPatchDto,
  RecoveryCodesResponseDto,
  SessionResponseDto,
  TicketResponseDto,
  TwoFactorCodeDto,
  TwoFactorSetupResponseDto,
  VerifyTwoFactorDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  private ctx(req: Request): ClientCtx {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  /** Refresh token: cookie httpOnly, SameSite=Strict, chỉ gửi tới /api/auth (TECHSTACK §1). */
  private send(res: Response, s: IssuedSession): SessionResponseDto {
    if (s.refreshToken) {
      setRefreshCookie(res, s.refreshToken, this.cfg);
    }
    return s.body;
  }

  private clear(res: Response) {
    clearRefreshCookie(res, this.cfg);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionResponseDto> {
    return this.send(res, await this.auth.login(dto.password, this.ctx(req)));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('auth/2fa/verify')
  @HttpCode(200)
  async verify(
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    return this.send(res, await this.auth.verifyTwoFactor(dto.pendingToken, dto.code, this.ctx(req)));
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionResponseDto> {
    try {
      return this.send(
        res,
        await this.auth.refresh((req.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE], this.ctx(req)),
      );
    } catch (e) {
      // chỉ xoá cookie khi token thật sự hỏng; lỗi hạ tầng (DB đang đóng lúc tắt dịch vụ…) giữ cookie để thử lại (AC-2)
      if (e instanceof AppError && e.code === ErrorCode.REFRESH_INVALID) this.clear(res);
      throw e;
    }
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(
      (req.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE],
      (req as Request & { user?: AuthUser }).user,
    );
    this.clear(res);
  }

  @AllowPending()
  @Get('auth/me')
  me(@CurrentUser() u: AuthUser): Promise<MeResponseDto> {
    return this.auth.me(u);
  }

  @AllowPending()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('auth/password')
  @HttpCode(200)
  async password(
    @CurrentUser() u: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    return this.send(res, await this.auth.changePassword(u, dto.currentPassword, dto.newPassword));
  }

  @Post('auth/stream-ticket')
  @HttpCode(200)
  ticket(@CurrentUser() u: AuthUser): TicketResponseDto {
    return this.auth.issueTicket(u);
  }

  // 2FA — chỉ owner có mật khẩu (member dùng 2FA của IdP — PERSONAS §2, dogfood breaker)
  @Roles(UserRole.OWNER)
  @Post('auth/2fa/setup')
  @HttpCode(200)
  setup(@CurrentUser() u: AuthUser): Promise<TwoFactorSetupResponseDto> {
    return this.auth.setupTwoFactor(u);
  }

  @Roles(UserRole.OWNER)
  @Post('auth/2fa/enable')
  @HttpCode(200)
  async enable(@CurrentUser() u: AuthUser, @Body() dto: TwoFactorCodeDto): Promise<RecoveryCodesResponseDto> {
    return { recoveryCodes: await this.auth.enableTwoFactor(u, dto.code) };
  }

  @Roles(UserRole.OWNER)
  @Post('auth/2fa/disable')
  @HttpCode(204)
  async disable(@CurrentUser() u: AuthUser, @Body() dto: TwoFactorCodeDto) {
    await this.auth.disableTwoFactor(u, dto.code);
  }

  @Roles(UserRole.OWNER)
  @Post('auth/2fa/recovery-codes')
  @HttpCode(200)
  async recovery(@CurrentUser() u: AuthUser, @Body() dto: TwoFactorCodeDto): Promise<RecoveryCodesResponseDto> {
    return { recoveryCodes: await this.auth.regenerateRecoveryCodes(u, dto.code) };
  }

  @Get('auth/devices')
  devices(@CurrentUser() u: AuthUser): Promise<DeviceDto[]> {
    return this.auth.devices(u);
  }

  @Delete('auth/devices/:familyId')
  @HttpCode(204)
  async revokeDevice(@CurrentUser() u: AuthUser, @Param('familyId') familyId: string) {
    await this.auth.revokeDevice(u, familyId);
  }

  @Post('auth/devices/revoke-others')
  @HttpCode(204)
  async revokeOthers(@CurrentUser() u: AuthUser) {
    await this.auth.revokeOtherDevices(u);
  }

  @Get('me/preferences')
  async prefs(@CurrentUser() u: AuthUser): Promise<PreferencesDto> {
    return (await this.auth.me(u)).preferences;
  }

  @Patch('me/preferences')
  patchPrefs(@CurrentUser() u: AuthUser, @Body() dto: PreferencesPatchDto): Promise<PreferencesDto> {
    return this.auth.patchPreferences(u, dto);
  }
}
