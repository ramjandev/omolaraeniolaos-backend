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

export class RegisterOrganizerVenueDto {
  // Step 1: Venue Manager Credentials
  @ApiProperty({
    example: 'manager@themonarch.ng',
    description: 'Venue manager email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'VenueSecurePass2026!',
    description: 'Account password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'Folake Adeleke',
    description: 'Venue manager full name',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({
    example: '+234 803 456 7890',
    description: 'Venue manager contact phone number',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  // Step 2: Venue Facility & Property Profile
  @ApiProperty({
    example: 'The Monarch Event Centre',
    description: 'Full official name of venue or hall property',
  })
  @IsString()
  @IsNotEmpty()
  propertyName: string;

  @ApiProperty({
    example: 'Plot 10, Lekki-Epe Expressway, Lekki Phase 1',
    description: 'Street address of the venue',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    example: 'Lekki, Lagos',
    description: 'City or district',
  })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({
    example: 'Lagos State',
    description: 'State or province',
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({
    example: 'Nigeria',
    description: 'Country location',
    default: 'Nigeria',
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    example: 2500,
    description: 'Maximum compound guest capacity across all spaces',
  })
  @IsOptional()
  @IsNumber()
  compoundCapacity?: number;

  @ApiPropertyOptional({
    example: '+234 800 MONARCH SEC',
    description: 'Dedicated security or front-gate hotline number',
  })
  @IsString()
  @IsOptional()
  securityHotline?: string;

  // Step 3: Plan Selection & Onboarding Flow
  @ApiProperty({
    example: 'plan_venue_1',
    description: 'Selected Plan ID (e.g. plan_venue_1 for Venue Enterprise Pass)',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to skip upfront payment and complete billing from the venue dashboard (default: true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  skipPayment?: boolean;
}
