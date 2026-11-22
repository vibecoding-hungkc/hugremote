import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SsoConfigInputDto {
  @IsIn(['google', 'oidc']) provider!: 'google' | 'oidc';
  @IsOptional() @IsString() @MaxLength(300) issuerUrl?: string;
  @IsString() @MaxLength(300) clientId!: string;
  /** Để trống = giữ secret cũ. */
  @IsOptional() @IsString() @MaxLength(500) clientSecret?: string;
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) @MaxLength(200, { each: true }) allowedEmails!: string[];
  @IsOptional() @IsString() @MaxLength(60) buttonLabel?: string;
  @IsBoolean() enabled!: boolean;
}

export class SsoDiscoverDto {
  @IsIn(['google', 'oidc']) provider!: 'google' | 'oidc';
  @IsOptional() @IsString() @MaxLength(300) issuerUrl?: string;
}

export class AllowEmailDto {
  @IsEmail() email!: string;
}

export class CallbackUrlsDto {
  @ApiProperty() oidc!: string;
  @ApiProperty() google!: string;
}

export class SsoConfigDto {
  @ApiProperty({ enum: ['google', 'oidc'] }) provider!: string;
  @ApiProperty() issuerUrl!: string;
  @ApiProperty() clientId!: string;
  @ApiProperty() hasSecret!: boolean;
  @ApiProperty({ type: [String] }) allowedEmails!: string[];
  @ApiProperty() buttonLabel!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ type: CallbackUrlsDto }) callbackUrls!: CallbackUrlsDto;
}

export class SsoPublicDto {
  @ApiProperty() enabled!: boolean;
  @ApiPropertyOptional() provider?: string;
  @ApiPropertyOptional() label?: string;
}

export class DiscoverResultDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty() issuer!: string;
  @ApiProperty() authorizationEndpoint!: string;
}

export class MemberDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) lastLoginAt!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) revokedAt!: string | null;
  @ApiProperty() running!: number;
}

export class DenialDto {
  @ApiProperty() id!: number;
  @ApiProperty() email!: string;
  @ApiProperty() provider!: string;
  @ApiProperty({ enum: ['not_allowed', 'revoked', 'disabled', 'token_invalid'] }) reason!: string;
  @ApiProperty() at!: string;
}
