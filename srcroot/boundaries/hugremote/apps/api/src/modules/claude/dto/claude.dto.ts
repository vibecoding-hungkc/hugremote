import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
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

export class CreateClaudeSessionDto extends CreateClaudeDto {
  /** Tiếp tục một phiên tạo từ Claude CLI (AC-23). */
  @IsOptional() @IsUUID() resumeCliId?: string;
}

export class CliSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() recent!: boolean;
  /** Phiên HugRemote của mình đã gắn (chỉ có khi `?all=1`). */
  @ApiPropertyOptional() linkedId?: string;
}

export class SendMessageDto {
  @IsString() @Length(1, 100_000) text!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) attachments?: string[];
}

export class AnswerDto {
  @IsIn(['allow', 'deny', 'always']) decision!: 'allow' | 'deny' | 'always';
  /** Câu trả lời cho `AskUserQuestion` (AC-21): map `question -> nhãn đã chọn`. */
  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;
}

export class PendingInteractionDto {
  @ApiProperty() id!: string;
  @ApiProperty() tool!: string;
  @ApiProperty() summary!: string;
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
  @ApiProperty({ type: [PendingInteractionDto] }) pending!: PendingInteractionDto[];
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

export class CliModelDto {
  @ApiProperty() value!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) efforts!: string[];
  @ApiProperty() contextWindow!: number;
}

export class CliCommandDto {
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() argumentHint!: string;
}

export class ClaudeOptionsDto {
  @ApiProperty({ type: [CliModelDto] }) models!: CliModelDto[];
  @ApiProperty({ type: [CliCommandDto] }) commands!: CliCommandDto[];
}

export class LimitWindowDto {
  @ApiProperty() pct!: number;
  @ApiPropertyOptional({ nullable: true, type: String }) resetAt!: string | null;
}

export class ClaudeLimitsDto {
  @ApiPropertyOptional({ type: LimitWindowDto }) fiveHour?: LimitWindowDto;
  @ApiPropertyOptional({ type: LimitWindowDto }) weekly?: LimitWindowDto;
}
