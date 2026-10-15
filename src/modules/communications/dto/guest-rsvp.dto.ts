import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class GuestRsvpDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  attendeeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  qrCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ enum: ['accepted', 'tentative', 'declined'] })
  @IsIn(['accepted', 'tentative', 'declined'])
  status: 'accepted' | 'tentative' | 'declined';

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  partySize?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dietary?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
