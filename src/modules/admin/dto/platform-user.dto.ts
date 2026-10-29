import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const PLATFORM_ROLE_LABELS = ['Super Admin', 'Admin', 'Platform Operator'] as const;
export const PLATFORM_STATUS_LABELS = ['Active', 'Suspended'] as const;

export class InvitePlatformUserDto {
  @ApiProperty({ example: 'Ama Boateng' })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ example: 'ama@studio.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: PLATFORM_ROLE_LABELS, example: 'Admin' })
  @IsIn(PLATFORM_ROLE_LABELS)
  role: (typeof PLATFORM_ROLE_LABELS)[number];
}

export class UpdatePlatformUserDto {
  @ApiPropertyOptional({ example: 'Ama Boateng' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ enum: PLATFORM_ROLE_LABELS })
  @IsOptional()
  @IsIn(PLATFORM_ROLE_LABELS)
  role?: (typeof PLATFORM_ROLE_LABELS)[number];

  @ApiPropertyOptional({ enum: PLATFORM_STATUS_LABELS })
  @IsOptional()
  @IsIn(PLATFORM_STATUS_LABELS)
  status?: (typeof PLATFORM_STATUS_LABELS)[number];
}
