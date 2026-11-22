import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { HostAuthType, HostKind } from '@app/shared';

const ALIAS = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
const HOSTNAME = /^[A-Za-z0-9._:-]{1,253}$/;
const USER = /^[A-Za-z0-9._-]{1,64}$/;
const PATHISH = /^[A-Za-z0-9._~/+@ -]{1,512}$/;

export class HostInputDto {
  @IsString() @Matches(ALIAS) alias!: string;
  @IsString() @Matches(HOSTNAME) hostName!: string;
  @IsString() @Matches(USER) user!: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsIn(Object.values(HostAuthType)) authType!: HostAuthType;
  @IsOptional() @IsString() @Matches(PATHISH) keyPath?: string;
  @IsOptional() @IsString() @MaxLength(512) password?: string;
  @IsOptional() @IsString() @MaxLength(512) passphrase?: string;
  @IsOptional() @IsString() @Matches(ALIAS) proxyJump?: string;
  @IsOptional() @IsString() @Matches(PATHISH) workspaceDir?: string;
}

export class HostPatchDto {
  @IsOptional() @IsString() @Matches(HOSTNAME) hostName?: string;
  @IsOptional() @IsString() @Matches(USER) user?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsIn(Object.values(HostAuthType)) authType?: HostAuthType;
  @IsOptional() @IsString() @Matches(PATHISH) keyPath?: string;
  /** Bỏ trống = giữ bí mật cũ (AC-5). */
  @IsOptional() @IsString() @MaxLength(512) password?: string;
  @IsOptional() @IsString() @MaxLength(512) passphrase?: string;
  @IsOptional() @IsString() proxyJump?: string;
  @IsOptional() @IsString() @Matches(PATHISH) workspaceDir?: string;
  /** Thời điểm Thử kết nối thành công với host/port/user mới — bắt buộc khi đổi địa chỉ (409 HOST_TEST_REQUIRED). */
  @IsOptional() @IsString() testedAt?: string;
}

export class HostTestDto extends HostPatchDto {
  @IsOptional() @IsString() @Matches(ALIAS) alias?: string;
}

export class TrustKeyDto {
  @IsString() fingerprint!: string;
  @IsString() keyType!: string;
  @IsOptional() @IsString() @MaxLength(253) host?: string;
  @IsOptional() @IsInt() port?: number;
  /** Máy chưa lưu: đi qua máy trung gian nào, user nào (để tin khoá của máy đích sau jump — dogfood smoke #6). */
  @IsOptional() @IsString() @MaxLength(253) proxyJump?: string;
  @IsOptional() @IsString() @MaxLength(64) user?: string;
}

export class PinsDto {
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) hostIds!: string[];
}

export class HostDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: HostKind }) kind!: HostKind;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() hostName?: string;
  @ApiPropertyOptional() user?: string;
  @ApiPropertyOptional() port?: number;
  @ApiPropertyOptional() proxyJump?: string;
  @ApiPropertyOptional() keyPath?: string;
  @ApiPropertyOptional({ enum: HostAuthType }) authType?: HostAuthType;
  @ApiProperty() hasSecret!: boolean;
  @ApiProperty() workspaceDir!: string;
  @ApiProperty() trusted!: boolean;
  @ApiProperty() pinned!: boolean;
  @ApiPropertyOptional() pinPosition?: number;
  @ApiPropertyOptional() configFile?: string;
  @ApiPropertyOptional({ type: [String] }) dependents?: string[];
}

export class HostListDto {
  @ApiProperty({ type: [HostDto] }) hosts!: HostDto[];
  @ApiProperty({ type: [String] }) warnings!: string[];
  @ApiProperty() configMtime!: number;
}

export class TestResultDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty() testedAt!: string;
  @ApiPropertyOptional() fingerprint?: string;
  @ApiPropertyOptional() keyType?: string;
}

export class SshKeyDto {
  @ApiProperty() path!: string;
  @ApiProperty() type!: string;
  @ApiPropertyOptional() comment?: string;
}
