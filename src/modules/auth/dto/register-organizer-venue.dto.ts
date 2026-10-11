import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VenueSpaceItemDto {
  @ApiProperty({
    example: 'Grand Ballroom',
    description: 'Name of the space or hall',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Maximum guest capacity for this space',
  })
  @IsOptional()
  @IsNumber()
  capacity?: number;

  @ApiPropertyOptional({
    example: 'Ballroom',
    description: 'Type of space (e.g. Ballroom, Auditorium, Terrace, Boardroom, Banquet Hall, Rooftop)',
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    example: '09:00-01:00',
    description: 'Operating hours (e.g. 09:00-01:00)',
  })
  @IsString()
  @IsOptional()
  operatingHours?: string;
}

export class VenueInvitedMemberDto {
  @ApiProperty({
    example: 'manager@themonarch.ng',
    description: 'Email of invited team member',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Manager',
    description: 'Role of invited team member (e.g. Manager, Coordinator, Gate Staff)',
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class RegisterOrganizerVenueDto {
  // ==========================================
  // Step 1: Account Creation
  // ==========================================
  @ApiProperty({
    example: 'Folake Adeleke',
    description: 'Your Name (Venue Manager / Owner)',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: 'manager@themonarch.ng',
    description: 'Email address of venue manager',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '+2348034567890',
    description: 'WhatsApp Phone Number (with +234 country code)',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'VenueSecurePass2026!',
    description: 'Create Password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: 'VenueSecurePass2026!',
    description: 'Confirm Password (must match password)',
  })
  @IsString()
  @IsOptional()
  confirmPassword?: string;

  // ==========================================
  // Step 1 of 5: Business Information
  // ==========================================
  @ApiProperty({
    example: 'Lumina Event Studio',
    description: 'Owner/Business Name (or Hospitality Group Name)',
  })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiPropertyOptional({
    example: 'https://themonarch.ng/logo.png',
    description: 'Business / Venue Logo URL (Optional)',
  })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({
    example: 'Event Hall Operator',
    description: 'Business Type (e.g. Event Hall Operator, Hotel & Resort, Conference Centre)',
  })
  @IsString()
  @IsNotEmpty()
  businessType: string;

  // ==========================================
  // Step 2 of 5: Create First Venue (Primary Venue)
  // ==========================================
  @ApiPropertyOptional({
    example: 'The Monarch Grand Palace',
    description: 'Venue Name',
  })
  @IsString()
  @IsOptional()
  venueName?: string;

  @ApiPropertyOptional({
    example: 'Ballroom',
    description: 'Venue Type (e.g. Ballroom, Auditorium, Event Centre)',
  })
  @IsString()
  @IsOptional()
  venueType?: string;

  @ApiPropertyOptional({
    example: 2500,
    description: 'Total Capacity (guests)',
  })
  @IsOptional()
  @IsNumber()
  capacity?: number;

  @ApiPropertyOptional({
    example: 'Plot 10, Lekki-Epe Expressway, Lekki Phase 1, Lagos, Nigeria',
    description: 'Full Physical Address of the venue',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: 'Premier luxury multi-hall venue in the heart of Lekki with world-class acoustics and high-capacity gate control.',
    description: 'Venue description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  // ==========================================
  // Step 3 of 5: Add Spaces & Halls
  // ==========================================
  @ApiPropertyOptional({
    type: [VenueSpaceItemDto],
    description: 'List of individual spaces, halls, or event suites within the venue',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VenueSpaceItemDto)
  spaces?: VenueSpaceItemDto[];

  // ==========================================
  // Step 4 of 5: Build Your Team
  // ==========================================
  @ApiPropertyOptional({
    type: [VenueInvitedMemberDto],
    description: 'List of invited team members (Managers, Coordinators, Gate Staff)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VenueInvitedMemberDto)
  invitedMembers?: VenueInvitedMemberDto[];

  // ==========================================
  // Step 5 of 5: Choose A Plan & Payment
  // ==========================================
  @ApiPropertyOptional({
    example: 'plan_venue_1',
    description: 'Selected Plan ID: "plan_venue_starter", "plan_venue_1", "plan_venue_pro", or "plan_venue_enterprise"',
    default: 'plan_venue_1',
  })
  @IsString()
  @IsOptional()
  planId?: string;

  @ApiPropertyOptional({
    example: 'monthly',
    description: 'Billing cycle: "monthly" or "annual"',
    default: 'monthly',
  })
  @IsString()
  @IsOptional()
  billingCycle?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether user clicked "Skip to Dashboard ->" to skip payment and pay later from dashboard',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  skipPayment?: boolean;

  @ApiPropertyOptional({
    example: 'CARD',
    description: 'Selected payment method: "CARD" or "BANK_TRANSFER"',
  })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({
    example: '5399834512345678',
    description: 'Card Number (if paying by card in Step 5)',
  })
  @IsString()
  @IsOptional()
  cardNumber?: string;

  @ApiPropertyOptional({
    example: '12/28',
    description: 'Card expiration date (MM/YY or DD/MM/YY)',
  })
  @IsString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({
    example: '123',
    description: 'Card CVV/CVC security code',
  })
  @IsString()
  @IsOptional()
  cvv?: string;
}
