import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ImportReportDto {
  @ApiProperty() at!: string;
  @ApiProperty() backup!: string;
  @ApiProperty() projects!: number;
  @ApiProperty() claude!: number;
  @ApiProperty() hosts!: number;
  @ApiProperty() password!: boolean;
  @ApiProperty() twoFactor!: boolean;
}

export class SystemInfoDto {
  @ApiPropertyOptional({ type: ImportReportDto, nullable: true }) imported!: ImportReportDto | null;
  @ApiProperty() version!: string;
  @ApiProperty() channel!: string;
  @ApiProperty() node!: string;
  @ApiProperty() address!: string;
  @ApiProperty() basePath!: string;
  @ApiProperty() appUrl!: string;
  @ApiProperty() dataDir!: string;
  @ApiProperty() startedAt!: string;
}

export class CheckDto {
  @ApiProperty() name!: string;
  @ApiProperty() ok!: boolean;
  @ApiPropertyOptional() required?: boolean;
  @ApiProperty() detail!: string;
  @ApiPropertyOptional() hint?: string;
}

export class LogsDto {
  @ApiProperty({ enum: ['app', 'ssh', 'update'] }) kind!: string;
  @ApiProperty({ type: [String] }) lines!: string[];
}

export class UpdateStartDto {
  @IsIn(['now', 'idle']) when!: 'now' | 'idle';
}

export class UpdateStepDto {
  @ApiProperty() name!: string;
  @ApiProperty() status!: string;
}

export class UpdateRunDto {
  @ApiProperty() runId!: string;
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty({ enum: ['running', 'done', 'failed', 'rolled_back'] }) status!: 'running' | 'done' | 'failed' | 'rolled_back';
  @ApiProperty({ type: [UpdateStepDto] }) steps!: UpdateStepDto[];
  @ApiProperty() at!: string;
}

export class RunningDto {
  @ApiProperty() claude!: number;
  @ApiProperty() terminal!: number;
}

export class UpdateStateDto {
  @ApiProperty() installed!: boolean;
  @ApiProperty() current!: string;
  @ApiProperty() channel!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) latest!: string | null;
  @ApiPropertyOptional({ nullable: true, type: UpdateRunDto }) run!: UpdateRunDto | null;
  @ApiProperty() waiting!: boolean;
  @ApiProperty({ type: RunningDto }) running!: RunningDto;
}
