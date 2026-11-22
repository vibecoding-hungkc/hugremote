import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString() @Length(1, 128) hostId!: string;
  @IsString() @Length(1, 1024) rootPath!: string;
  @IsOptional() @IsString() @Length(1, 80) name?: string;
}

export class RenameProjectDto {
  @IsString() @Length(1, 80) name!: string;
}

export class MkdirDto {
  @IsString() @Length(1, 1024) path!: string;
}

export class ProjectDto {
  @ApiProperty() id!: string;
  @ApiProperty() hostId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() rootPath!: string;
  @ApiProperty() isHome!: boolean;
}

export class BrowseEntryDto {
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['dir', 'file', 'link'] }) type!: 'dir' | 'file' | 'link';
  @ApiProperty() hidden!: boolean;
}

export class BrowseDto {
  @ApiProperty() path!: string;
  @ApiPropertyOptional() parent?: string;
  @ApiProperty({ type: [BrowseEntryDto] }) entries!: BrowseEntryDto[];
  @ApiPropertyOptional() projectId?: string;
}

export class DryRunDto {
  @ApiProperty() sessions!: number;
}

export class BrowseQuery {
  @IsOptional() @IsString() @MaxLength(1024) path?: string;
}
