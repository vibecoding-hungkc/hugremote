import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ClaudeStatus, PermissionMode } from '@app/shared';

export class CreateClaudeDto {
  @IsOptional() @IsString() @Length(1, 80) name?: string;
  @IsOptional() @IsIn(Object.values(PermissionMode)) permissionMode?: PermissionMode;
  @IsOptional() @IsString() @MaxLength(80) model?: string;
  @IsOptional() @IsString() @MaxLength(20) effort?: string;
  /** Bypass cần xác nhận lần hai (AC-39). */
  @IsOptional() @IsBoolean() confirm?: boolean;
}

export class PatchClaudeDto extends CreateClaudeDto {}

export class SendMessageDto {
  @IsString() @Length(1, 100_000) text!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) attachments?: string[];
}

export class AnswerDto {
  @IsIn(['allow', 'deny', 'always']) decision!: 'allow' | 'deny' | 'always';
}

export class ClaudeSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() projectId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ClaudeStatus }) status!: ClaudeStatus;
  @ApiPropertyOptional() model?: string;
  @ApiPropertyOptional() effort?: string;
  @ApiProperty({ enum: PermissionMode }) permissionMode!: PermissionMode;
  @ApiProperty() ownerUserId!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() queued!: number;
  @ApiProperty() pendingInteractions!: number;
}

export class SendResultDto {
  @ApiProperty() queued!: boolean;
  @ApiPropertyOptional() queueId?: string;
}

export class QueueItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() text!: string;
  @ApiProperty() createdAt!: string;
}
