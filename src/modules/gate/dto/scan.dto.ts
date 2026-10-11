import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ScanDto {
  @ApiProperty({ example: 'MC-PASS-8F92A-44B', description: 'Unique QR Code hash', type: String })
  @IsString()
  @IsNotEmpty()
  qrCode: string;

  @ApiProperty({ example: 'Gate A-1', default: 'Gate A-1' })
  @IsString()
  @IsOptional()
  gateTurnstile?: string;

  @ApiProperty({ example: 'staff-uuid-1234', required: false })
  @IsString()
  @IsOptional()
  staffId?: string;
}
