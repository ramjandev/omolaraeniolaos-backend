import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum FilterOrganizerType {
  ALL = 'All',
  INDIVIDUAL = 'Individual',
  AGENCY = 'Agency',
  VENUE = 'Venue',
}

export enum FilterOrganizerStatus {
  ALL = 'All',
  ACTIVE = 'Active',
  PENDING = 'Pending',
  SUSPENDED = 'Suspended',
  DEACTIVATED = 'Deactivated',
}

export class FilterOrganizersDto {
  @ApiPropertyOptional({
    description: 'Filter by organizer role/type (All, Individual, Agency, Venue)',
    enum: FilterOrganizerType,
    example: FilterOrganizerType.ALL,
  })
  @IsOptional()
  @IsEnum(FilterOrganizerType)
  type?: FilterOrganizerType;

  @ApiPropertyOptional({
    description: 'Filter by user status (All, Active, Pending, Suspended, Deactivated)',
    enum: FilterOrganizerStatus,
    example: FilterOrganizerStatus.ALL,
  })
  @IsOptional()
  @IsEnum(FilterOrganizerStatus)
  status?: FilterOrganizerStatus;

  @ApiPropertyOptional({
    description: 'Search by organizer full name, email, agency name, or venue property name',
    example: 'Celestial Events',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of rows per page',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
