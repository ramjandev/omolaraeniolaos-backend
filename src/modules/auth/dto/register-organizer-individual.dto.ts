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

export class RegisterOrganizerIndividualDto {
  // ==========================================
  // Step 1: Create Your McEniesVite Account
  // ==========================================
  @ApiProperty({
    example: 'James Obi',
    description: 'Full legal or display name',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: 'james.obi@gmail.com',
    description: 'Email address of individual organizer',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '+2348012345678',
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
  // Step 2: Let's Set Up Your Event
  // ==========================================
  @ApiProperty({
    example: 'Golden Jubilee Gala Dinner',
    description: 'Event Name',
  })
  @IsString()
  @IsNotEmpty()
  eventName: string;

  @ApiProperty({
    example: 'Wedding',
    description: 'Event Type (e.g. Wedding, Birthday Party, Gala, Dinner, Anniversary)',
  })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({
    example: '2026-12-20',
    description: 'Event Date (YYYY-MM-DD or ISO 8601 string)',
  })
  @IsString()
  @IsNotEmpty()
  eventDate: string;

  @ApiPropertyOptional({
    example: 150,
    description: 'Expected Guests count (e.g. 150)',
    default: 150,
  })
  @IsOptional()
  @IsNumber()
  expectedGuests?: number;

  @ApiProperty({
    example: '14:00',
    description: 'Start Time (e.g. "14:00" or "2:00 PM")',
  })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiPropertyOptional({
    example: '20:00',
    description: 'End Time (Optional, e.g. "20:00" or "8:00 PM")',
  })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiProperty({
    example: 'Eko Convention Centre, Victoria Island, Lagos',
    description: 'Venue / Location',
  })
  @IsString()
  @IsNotEmpty()
  venueLocation: string;

  // ==========================================
  // Step 3 & 4: Package Pricing & Payment Setup
  // ==========================================
  @ApiPropertyOptional({
    example: 'plan_ind_1',
    description:
      'Selected Plan ID: "plan_ind_1" (Essential Event Pass - ₦00) or "plan_ind_2" (Grand Celebration Pass - ₦35,000)',
    default: 'plan_ind_1',
  })
  @IsString()
  @IsOptional()
  planId?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Whether the organizer clicked "Skip to Dashboard ->" to finish payment later from the portal',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
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
    description: 'Credit/Debit card number (if paying by card in Step 4)',
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
    description: 'Card CVV/CVC 3-digit security code',
  })
  @IsString()
  @IsOptional()
  cvv?: string;
}
