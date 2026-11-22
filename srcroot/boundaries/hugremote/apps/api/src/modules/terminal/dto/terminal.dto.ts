import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { TerminalStatus } from '@app/shared';

export class CreateTerminalDto {
  @IsOptional() @IsString() @Length(1, 80) name?: string;
  /** Tương đối gốc dự án, phải nằm trong gốc (G-4) — "Mở terminal tại đây". */
  @IsOptional() @IsString() @MaxLength(1024) cwd?: string;
}

export class RenameTerminalDto {
  @IsString() @Length(1, 80) name!: string;
}

export class TerminalDto {
  @ApiProperty() id!: string;
  @ApiProperty() projectId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() cwd!: string;
  @ApiProperty({ enum: TerminalStatus }) status!: TerminalStatus;
  @ApiPropertyOptional() exitCode?: number;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() lastAttachedAt?: string;
  @ApiProperty() ownerUserId!: string;
}
