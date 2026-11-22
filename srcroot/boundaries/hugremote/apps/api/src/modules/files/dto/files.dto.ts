import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

const bool = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

export class FsListQuery {
  @IsOptional() @IsString() @MaxLength(4096) path?: string;
  @IsOptional() @Transform(bool) @IsBoolean() hidden?: boolean;
}

export class FsReadQuery {
  @IsString() @MaxLength(4096) path!: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(10 * 1024 * 1024) tail?: number;
}

export class FsPathQuery {
  @IsString() @MaxLength(4096) path!: string;
}

export class FsWriteDto {
  @IsString() @MaxLength(4096) path!: string;
  @IsString() content!: string;
  @IsOptional() @IsNumber() baseMtime?: number;
}

export class FsActionDto {
  @IsIn(['mkdir', 'touch', 'rename', 'copy', 'delete']) op!: 'mkdir' | 'touch' | 'rename' | 'copy' | 'delete';
  @IsString() @MaxLength(4096) path!: string;
  @IsOptional() @IsString() @MaxLength(4096) to?: string;
}

export class FsSearchQuery {
  @IsString() @Length(2, 500) q!: string;
  @IsOptional() @Transform(bool) @IsBoolean() regex?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() case?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() hidden?: boolean;
}

export class FsUploadDto {
  @IsOptional() @IsString() @MaxLength(4096) dir?: string;
}
