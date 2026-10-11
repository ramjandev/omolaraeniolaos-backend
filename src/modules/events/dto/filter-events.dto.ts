import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EventStatus } from '@prisma/client';

export class FilterEventsDto {
  @ApiPropertyOptional({ enum: EventStatus, description: 'Filter by event status' })
  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'Filter by event category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by organizer ID' })
  @IsString()
  @IsOptional()
  organizerId?: string;

  @ApiPropertyOptional({ description: 'Text search by title or description' })
  @IsString()
  @IsOptional()
  search?: string;
}
