import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class RegisterOrganizerIndividualDto {
  // Step 1: Account Credentials
  @ApiProperty({
    example: 'james.obi@gmail.com',
    description: 'Individual organizer email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'James Obi',
    description: 'Full legal or display name',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({
    example: '+234 801 234 5678',
    description: 'Direct contact phone number',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  // Step 2: Individual Profile & Event Preferences
  @ApiPropertyOptional({
    example: 'Experienced independent host and curator of private galas and weddings.',
    description: 'Brief bio or organizer profile',
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({
    example: 'Lagos',
    description: 'Primary operating city/state',
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    example: ['Wedding', 'Gala', 'Birthday Party'],
    description: 'Primary event categories',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  // Step 3: Plan Selection & Onboarding Flow
  @ApiProperty({
    example: 'plan_ind_1',
    description: 'Selected Plan ID (e.g. plan_ind_1 for Essential Pass, plan_ind_2 for Grand Celebration Pass)',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to skip upfront payment and complete payment later from the dashboard (default: true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  skipPayment?: boolean;
}
