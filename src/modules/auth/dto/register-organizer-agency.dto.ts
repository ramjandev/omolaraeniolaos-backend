import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AgencyInvitedMemberDto {
  @ApiProperty({
    example: 'alex@luminaevents.co',
    description: 'Email address of invited team member',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Event Planner',
    description: 'Role assigned to the team member (e.g. Event Planner, Coordinator, Producer)',
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class RegisterOrganizerAgencyDto {
  // ==========================================
  // Step 1: Create Your McEniesVite Account
  // ==========================================
  @ApiProperty({
    example: 'Adebayo Ogunlesi',
    description: 'Your Name (Agency lead / representative)',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: 'director@luminaevents.co',
    description: 'Email Address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '+2348023456789',
    description: 'WhatsApp Phone Number (with +234 country code)',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Create Password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: 'SecurePassword123!',
    description: 'Confirm Password (must match password)',
  })
  @IsString()
  @IsOptional()
  confirmPassword?: string;

  // ==========================================
  // Step 1 of 5: Tell Us About Your Agency
  // ==========================================
  @ApiProperty({
    example: 'Lumina Event Studio',
    description: 'Agency Name',
  })
  @IsString()
  @IsNotEmpty()
  agencyName: string;

  @ApiPropertyOptional({
    example: 'https://luminaevents.co/logo.png',
    description: 'Agency Logo image URL (Optional)',
  })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({
    example: 'Event Planning',
    description: 'Agency Type (e.g. Event Planning, Production Agency, PR & Brand Experience)',
  })
  @IsString()
  @IsNotEmpty()
  agencyType: string;

  @ApiPropertyOptional({
    example: 'Nigeria',
    description: 'Country',
    default: 'Nigeria',
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    example: 'Lagos',
    description: 'City',
  })
  @IsString()
  @IsOptional()
  city?: string;

  // ==========================================
  // Step 2 of 5: Tell Us About Your Work
  // ==========================================
  @ApiPropertyOptional({
    example: ['Weddings', 'Corporate Events', 'Conferences'],
    description: 'Types of events organized (Weddings, Birthdays, Corporate Events, Conferences, Private Parties, Social Gatherings)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @ApiPropertyOptional({
    example: '21-50 / year',
    description: 'How many events typically managed per year (1-5 / year, 6-20 / year, 21-50 / year, 50+ / year)',
  })
  @IsString()
  @IsOptional()
  eventsPerYear?: string;

  @ApiPropertyOptional({
    example: '6-15 members',
    description: 'How large is your team (Just me, 2-5 members, 6-15 members, 16+ members)',
  })
  @IsString()
  @IsOptional()
  teamSize?: string;

  // ==========================================
  // Step 3 of 5: Build Your Agency Team
  // ==========================================
  @ApiPropertyOptional({
    type: [AgencyInvitedMemberDto],
    description: 'List of invited team members with email and assigned role',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgencyInvitedMemberDto)
  invitedMembers?: AgencyInvitedMemberDto[];

  // ==========================================
  // Step 4 of 5: Choose A Plan That Fits Your Agency
  // ==========================================
  @ApiPropertyOptional({
    example: 'plan_agency_pro',
    description: 'Selected Plan ID: "plan_agency_solo" (Solo Planner), "plan_agency_pro" (Agency Pro), or "plan_agency_enterprise" (Enterprise)',
    default: 'plan_agency_pro',
  })
  @IsString()
  @IsOptional()
  planId?: string;

  @ApiPropertyOptional({
    example: 'monthly',
    description: 'Billing cycle: "monthly" or "annual" (annual gets 20% discount)',
    default: 'monthly',
  })
  @IsString()
  @IsOptional()
  billingCycle?: string;

  // ==========================================
  // Step 5 of 5: Complete Your Setup & Payment
  // ==========================================
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
