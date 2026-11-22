import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

export class RepoQuery {
  @IsOptional() @IsString() @MaxLength(1024) repo?: string;
}
export class DiffQuery extends RepoQuery {
  @IsString() @MaxLength(4096) path!: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true' || value === '1') @IsBoolean() staged?: boolean;
}
export class CommitsQuery extends RepoQuery {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(0) cursor?: number;
}
export class CommitQuery extends RepoQuery {
  @IsOptional() @IsString() @MaxLength(4096) path?: string;
}
export class PathsDto extends RepoQuery {
  /** `["*"]` = tất cả. */
  @IsArray() @ArrayMaxSize(5000) @IsString({ each: true }) paths!: string[];
}
export class DiscardDto extends RepoQuery {
  @IsString() @MaxLength(4096) path!: string;
}
export class CommitDto extends RepoQuery {
  @IsString() @Length(1, 10_000) message!: string;
}
export class CheckoutDto extends RepoQuery {
  @IsString() @Length(1, 250) branch!: string;
  @IsOptional() @IsBoolean() create?: boolean;
}
