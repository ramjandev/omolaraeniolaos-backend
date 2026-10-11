import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { SpaceType } from '@prisma/client';

export class CreateSpaceDto {
  @ApiProperty({ example: 'Grand Imperial Ballroom' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: SpaceType, example: SpaceType.BALLROOM })
  @IsEnum(SpaceType)
  type: SpaceType;

  @ApiProperty({ example: 1500, type: Number })
  @IsInt()
  @IsPositive()
  capacity: number;

  @ApiProperty({ example: 1200, type: Number })
  @IsNumber()
  @IsPositive()
  squareMeters: number;

  @ApiProperty({ example: 2500000, type: Number })
  @IsNumber()
  @IsPositive()
  dailyRate: number;

  @ApiProperty({ example: 'NGN', default: 'NGN' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: ['State-of-art PA System', 'Climate Controlled', 'VIP Green Room', 'Valet Parking'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];
}
