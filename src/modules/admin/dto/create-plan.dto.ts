import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OrganizerType {
  INDIVIDUAL = 'Individual',
  AGENCY = 'Agency',
  VENUE = 'Venue',
}

export enum BillingCycle {
  PER_EVENT = 'Per-event',
  MONTHLY = 'Monthly',
  ANNUAL = 'Annual',
}

export class CreatePlanDto {
  @ApiProperty({ example: 'Grand Celebration Pass', description: 'Name of the membership/pass plan' })
  @IsNotEmpty()
  @IsString()
  planName: string;

  @ApiPropertyOptional({
    example: 'Ideal for weddings, large celebrations, galas and social banquets.',
    description: 'Short description shown on the plan card',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 35000, description: 'Price in Naira (NGN)' })
  @IsNotEmpty()
  price: number | string;

  @ApiProperty({
    enum: OrganizerType,
    example: OrganizerType.AGENCY,
    description: 'Target organizer classification (Individual, Agency, Venue)',
  })
  @IsNotEmpty()
  @IsEnum(OrganizerType)
  organizerType: OrganizerType;

  @ApiProperty({
    enum: BillingCycle,
    example: BillingCycle.PER_EVENT,
    description: 'Billing cycle frequency',
  })
  @IsNotEmpty()
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiPropertyOptional({
    example: [
      'Up to 600 Guest passes & VIP tagging',
      'Automated Multilingual WhatsApp dispatch',
      'Security gate fraud prevention alerts',
    ],
    description: 'List of features included with this plan',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: false, description: 'Archive status of plan' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
