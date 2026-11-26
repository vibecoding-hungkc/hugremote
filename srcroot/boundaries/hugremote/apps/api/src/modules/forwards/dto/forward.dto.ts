import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateForwardDto {
  @IsIn(['L', 'R']) direction!: 'L' | 'R';
  @IsString() @Length(1, 128) hostId!: string;
  /** Phía máy SSH: đích của `-L` (thường localhost; có thể máy khác trong mạng của nó). `-R` luôn bind 127.0.0.1 (G-17). */
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9.-]{1,253}$/) remoteHost?: string;
  @IsInt() @Min(1) @Max(65535) remotePort!: number;
  /** Cổng trên Mac: `-L` = cổng nghe (≥1024), `-R` = cổng service đang chạy trên Mac. */
  @IsInt() @Min(1) @Max(65535) localPort!: number;
  @IsOptional() @IsString() @Length(0, 80) label?: string;
  @IsOptional() @IsBoolean() autoStart?: boolean;
}

export class UpdateForwardDto {
  @IsOptional() @IsInt() @Min(1) @Max(65535) remotePort?: number;
  @IsOptional() @IsInt() @Min(1) @Max(65535) localPort?: number;
  @IsOptional() @IsString() @Length(0, 80) label?: string;
  @IsOptional() @IsBoolean() autoStart?: boolean;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class ForwardDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['L', 'R'] }) direction!: 'L' | 'R';
  @ApiProperty() hostId!: string;
  @ApiProperty() remoteHost!: string;
  @ApiProperty() remotePort!: number;
  @ApiProperty() localPort!: number;
  @ApiPropertyOptional() label?: string;
  @ApiProperty() autoStart!: boolean;
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ enum: ['on', 'off', 'err'] }) status!: 'on' | 'off' | 'err';
  @ApiPropertyOptional() error?: string;
  /** Chỉ khi gọi `?check=1`: cổng đích có ai nghe không (`-R`: cổng trên máy local · `-L`: cổng trên máy SSH). */
  @ApiPropertyOptional({ enum: ['up', 'down'] }) target?: 'up' | 'down';
}

export class ListeningPortDto {
  @ApiProperty() port!: number;
  @ApiProperty() proc!: string;
}
