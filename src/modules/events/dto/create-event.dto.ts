import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';
import { EventFormat } from '@prisma/client';

export class CreateEventDto {
  @ApiProperty({ example: 'Lagos Tech Summit 2026' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'The premier annual gathering of African builders and innovators.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Technology & Startups' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ enum: EventFormat, example: EventFormat.IN_PERSON })
  @IsEnum(EventFormat)
  format: EventFormat;

  @ApiProperty({ example: '2026-10-24T09:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-10-25T18:00:00.000Z' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 1200, type: Number })
  @IsInt()
  @IsPositive()
  capacity: number;

  @ApiProperty({ example: 'Landmark Centre', required: false })
  @IsString()
  @IsOptional()
  venueName?: string;

  @ApiProperty({ example: 'Water Corporation Drive', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Lagos', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'Nigeria', required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ example: 'NGN', default: 'NGN' })
  @IsString()
  @IsOptional()
  currency?: string;
}
