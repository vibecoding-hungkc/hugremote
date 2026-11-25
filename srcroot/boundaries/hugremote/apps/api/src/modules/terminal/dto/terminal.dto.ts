import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { TerminalStatus } from '@app/shared';

export class CreateTerminalDto {
  @IsOptional() @IsString() @Length(1, 80) name?: string;
  /** Tương đối gốc dự án, phải nằm trong gốc (G-4) — "Mở terminal tại đây". */
  @IsOptional() @IsString() @MaxLength(1024) cwd?: string;
  /** Vòng 3: tên session tmux — có thì PTY chạy `tmux new-session -A -s <tên>` (G-17 whitelist). */
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,64}$/) tmux?: string;
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
  @ApiPropertyOptional() tmuxName?: string;
}

export class TmuxSessionDto {
  @ApiProperty() name!: string;
  @ApiProperty() windows!: number;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() sessionId?: string;
}
