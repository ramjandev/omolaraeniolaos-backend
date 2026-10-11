import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class RegisterOrganizerAgencyDto {
  // Step 1: Lead Account Credentials
  @ApiProperty({
    example: 'director@premiumevents.ng',
    description: 'Agency principal / admin email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'AgencySecure2026!',
    description: 'Account password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'Adebayo Ogunlesi',
    description: 'Agency representative full name',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({
    example: '+234 802 345 6789',
    description: 'Agency representative phone number',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  // Step 2: Agency Corporate Profile
  @ApiProperty({
    example: 'Premium Events Ng',
    description: 'Registered business/agency brand name',
  })
  @IsString()
  @IsNotEmpty()
  agencyName: string;

  @ApiPropertyOptional({
    example: 'billing@premiumevents.ng',
    description: 'Designated billing and invoicing email address (defaults to account email)',
  })
  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @ApiPropertyOptional({
    example: 'RC-1928374',
    description: 'CAC Corporate Registration or Tax ID',
  })
  @IsString()
  @IsOptional()
  corporateTaxId?: string;

  @ApiPropertyOptional({
    example: 'Victoria Island, Lagos, Nigeria',
    description: 'Agency headquarters location / address',
  })
  @IsString()
  @IsOptional()
  headquarters?: string;

  @ApiPropertyOptional({
    example: 'https://premiumevents.ng',
    description: 'Agency website URL',
  })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    example: 12,
    description: 'Estimated team size or active staff count',
  })
  @IsOptional()
  @IsNumber()
  teamSize?: number;

  // Step 3: Plan Selection & Onboarding Flow
  @ApiProperty({
    example: 'plan_agency_1',
    description: 'Selected Plan ID (e.g. plan_agency_1 for Agency Pro Pass)',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to skip upfront payment during registration and pay later from the agency portal (default: true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  skipPayment?: boolean;
}
