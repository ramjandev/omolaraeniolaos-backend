import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpaceStatus, SpaceType } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateSpaceDto {
  @ApiProperty({ example: 'Grand Ballroom A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: SpaceType, example: SpaceType.BALLROOM })
  @IsEnum(SpaceType)
  type: SpaceType;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @ApiPropertyOptional({ example: '1 Eko Hotel Drive, Victoria Island, Lagos' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: SpaceStatus })
  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}

export class UpdateSpaceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: SpaceType })
  @IsOptional()
  @IsEnum(SpaceType)
  type?: SpaceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: SpaceStatus })
  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
