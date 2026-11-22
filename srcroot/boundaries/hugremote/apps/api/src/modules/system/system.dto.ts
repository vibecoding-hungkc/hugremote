import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SystemInfoDto {
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
