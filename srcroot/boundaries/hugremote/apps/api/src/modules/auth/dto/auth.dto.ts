import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { UserRole } from '@app/shared';

export class LoginDto {
  @IsString() @Length(1, 256) password!: string;
}

export class VerifyTwoFactorDto {
  @IsString() pendingToken!: string;
  /** Mã TOTP 6 số hoặc một mã khôi phục. */
  @IsString() @Length(6, 32) code!: string;
}

export class ChangePasswordDto {
  @IsString() @Length(1, 256) currentPassword!: string;
  @IsString() @Length(1, 256) newPassword!: string;
}

export class TwoFactorCodeDto {
  @IsString() @Length(6, 32) code!: string;
}

export class PreferencesPatchDto {
  @IsOptional() @IsIn(['dark', 'light', 'system']) theme?: 'dark' | 'light' | 'system';
  @IsOptional() @IsIn(['vi', 'en']) locale?: 'vi' | 'en';
  @IsOptional() @IsBoolean() compact?: boolean;
  /** `{ projectId: 'sessions' | 'files' | 'git' | 'claude/<id>' | 'terminal/<id>' }` — gộp nông. */
  @IsOptional() @IsObject() lastTab?: Record<string, string>;
}

export class SessionResponseDto {
  @ApiPropertyOptional() accessToken?: string;
  @ApiProperty() needs2fa!: boolean;
  @ApiPropertyOptional() pendingToken?: string;
  @ApiProperty() mustChangePassword!: boolean;
}

export class PreferencesDto {
  @ApiPropertyOptional({ enum: ['dark', 'light', 'system'] }) theme?: string;
  @ApiPropertyOptional({ enum: ['vi', 'en'] }) locale?: string;
  @ApiPropertyOptional() compact?: boolean;
  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } }) lastTab?: Record<string, string>;
}

export class MeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiPropertyOptional() email?: string;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty() twoFactorEnabled!: boolean;
  @ApiProperty() recoveryCodesLeft!: number;
  @ApiProperty({ type: PreferencesDto }) preferences!: PreferencesDto;
}

export class TicketResponseDto {
  @ApiProperty() ticket!: string;
  @ApiProperty() expiresIn!: number;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty() secret!: string;
  @ApiProperty() otpauthUri!: string;
  @ApiProperty() qrSvg!: string;
}

export class RecoveryCodesResponseDto {
  @ApiProperty({ type: [String] }) recoveryCodes!: string[];
}

export class DeviceDto {
  @ApiProperty() familyId!: string;
  @ApiPropertyOptional() userAgent?: string;
  @ApiPropertyOptional() ip?: string;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() lastUsedAt?: string;
  @ApiProperty() current!: boolean;
}

export class NameDto {
  @IsString() @Length(1, 80) @MaxLength(80) name!: string;
}
