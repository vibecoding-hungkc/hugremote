import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class WebSessionBody {
  @IsString() @MaxLength(2048) url!: string;
}
export class WebSessionPatch {
  @IsOptional() @IsString() @MaxLength(2048) url?: string;
  /** Đổi tên hiển thị (alias) như phiên khác. */
  @IsOptional() @IsString() @Length(1, 80) name?: string;
}
export class WebSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() projectId!: string;
  @ApiProperty() url!: string;
  @ApiProperty() name!: string;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() lastOpenedAt?: string;
  @ApiProperty() ownerUserId!: string;
}
