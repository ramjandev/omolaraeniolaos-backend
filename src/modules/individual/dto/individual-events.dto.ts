import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventStatus, EventFormat } from '@prisma/client';

export class FilterIndividualEventsDto {
  @ApiPropertyOptional({
    description: 'Filter by event status (all, active, live, draft, completed)',
    example: 'all',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Search by keyword in event title, description or venue',
    example: 'Gala',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by event category (Gala, Wedding, Birthday, etc.)',
    example: 'Gala',
  })
  @IsString()
  @IsOptional()
  category?: string;
}

export class CreateIndividualEventDto {
  @ApiProperty({
    description: 'Event Title',
    example: 'The Grand Royal Gala & Investiture',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Event Category',
    example: 'Gala',
    default: 'Gala',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({
    description: 'Event Description',
    example: 'An exclusive black-tie gala and investiture ceremony.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: EventFormat,
    default: EventFormat.IN_PERSON,
    example: EventFormat.IN_PERSON,
  })
  @IsEnum(EventFormat)
  @IsOptional()
  format?: EventFormat;

  @ApiProperty({
    description: 'Event Date / Start Date (ISO string or YYYY-MM-DD)',
    example: '2026-10-24T18:00:00.000Z',
  })
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Event End Date (ISO string or YYYY-MM-DD)',
    example: '2026-10-24T23:00:00.000Z',
  })
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Start Time (e.g. 18:00)',
    example: '18:00',
  })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'End Time (e.g. 23:00)',
    example: '23:00',
  })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Expected Guest Capacity',
    example: 100,
    default: 100,
  })
  @IsNumber()
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Venue Name',
    example: 'The Monarch Event Centre',
  })
  @IsString()
  @IsOptional()
  venueName?: string;

  @ApiPropertyOptional({
    description: 'Full Venue Address',
    example: '123 Water Corporation Drive, Victoria Island, Lagos',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Lagos',
    default: 'Lagos',
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'Nigeria',
    default: 'Nigeria',
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    description: 'Parking Information for guests',
    example: 'Complimentary valet parking is available at the main drop-off entrance.',
  })
  @IsString()
  @IsOptional()
  parkingInfo?: string;

  @ApiPropertyOptional({
    description: 'Dress Code Protocol',
    example: 'Black Tie & Traditional Elegance: We request guests to wear formal evening wear.',
  })
  @IsString()
  @IsOptional()
  dressCode?: string;

  @ApiPropertyOptional({
    description: 'Additional Guest Notes or announcements',
    example: 'The red carpet reception and welcome cocktails will begin promptly at 2:00 PM.',
  })
  @IsString()
  @IsOptional()
  additionalNotes?: string;

  @ApiPropertyOptional({
    description: 'Selected Invitation Template ID',
    example: 'tpl-1',
  })
  @IsString()
  @IsOptional()
  invitationTemplateId?: string;

  @ApiPropertyOptional({
    enum: EventStatus,
    default: EventStatus.DRAFT,
    example: EventStatus.DRAFT,
  })
  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;
}

export class UpdateIndividualEventDto extends CreateIndividualEventDto {}

export class AddIndividualGuestDto {
  @ApiProperty({
    description: 'Guest Full Name',
    example: 'Chief & Mrs. Babatunde Alabi',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'WhatsApp / Phone Number',
    example: '+234 802 345 6789',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    description: 'Email Address',
    example: 'babatunde.alabi@gmail.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Guest Group / Tier (VIP, General, Family & Friends, Speakers & Partners)',
    example: 'VIP',
    default: 'General',
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'Party Size / Number of Attendees',
    example: 2,
    default: 1,
  })
  @IsNumber()
  @IsOptional()
  partySize?: number;

  @ApiPropertyOptional({
    description: 'RSVP Status (Confirmed, Tentative, Declined, No Response)',
    example: 'Confirmed',
    default: 'No Response',
  })
  @IsString()
  @IsOptional()
  rsvpStatus?: string;

  @ApiPropertyOptional({
    description: 'Check-in Status (Checked-In, Not Arrived, Rejected, Tentative)',
    example: 'Checked-In',
    default: 'Not Arrived',
  })
  @IsString()
  @IsOptional()
  checkInStatus?: string;

  @ApiPropertyOptional({
    description: 'Invitation Channel (WhatsApp, Email, SMS)',
    example: 'WhatsApp',
    default: 'WhatsApp',
  })
  @IsString()
  @IsOptional()
  inviteThrough?: string;

  @ApiPropertyOptional({
    description: 'Dietary or Seating Preference',
    example: 'Jollof & Grilled Croaker • Table 01 (VVIP Royal)',
  })
  @IsString()
  @IsOptional()
  preference?: string;
}

export class BulkAddIndividualGuestsDto {
  @ApiProperty({
    type: [AddIndividualGuestDto],
    description: 'List of guests to import',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddIndividualGuestDto)
  guests: AddIndividualGuestDto[];
}

export class UpdateIndividualGuestDto {
  @ApiPropertyOptional({ example: 'Chief & Mrs. Babatunde Alabi' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '+234 802 345 6789' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'babatunde.alabi@gmail.com' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'VIP' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  partySize?: number;

  @ApiPropertyOptional({ example: 'Confirmed' })
  @IsString()
  @IsOptional()
  rsvpStatus?: string;

  @ApiPropertyOptional({ example: 'Checked-In' })
  @IsString()
  @IsOptional()
  checkInStatus?: string;

  @ApiPropertyOptional({ example: 'WhatsApp' })
  @IsString()
  @IsOptional()
  inviteThrough?: string;

  @ApiPropertyOptional({ example: 'Jollof & Grilled Croaker' })
  @IsString()
  @IsOptional()
  preference?: string;

  @ApiPropertyOptional({ example: 'Halal / Vegetarian' })
  @IsString()
  @IsOptional()
  dietary?: string;
}

export class AssignGuestSeatingDto {
  @ApiProperty({ description: 'Attendee / Guest ID', example: 'g-1' })
  @IsString()
  @IsNotEmpty()
  attendeeId: string;

  @ApiProperty({ description: 'Table Number (e.g. 1)', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  tableNumber: number;

  @ApiPropertyOptional({ description: 'Seat Number', example: 3 })
  @IsNumber()
  @IsOptional()
  seatNumber?: number;

  @ApiPropertyOptional({ description: 'Zone Name', example: 'VVIP Royal' })
  @IsString()
  @IsOptional()
  zoneName?: string;
}

export class ResolveFlagDto {
  @ApiProperty({ description: 'Flagged Item ID', example: 'fl-1' })
  @IsString()
  @IsNotEmpty()
  flagId: string;

  @ApiProperty({
    description: 'Resolution Action (trust_staff or manual_resolve)',
    example: 'trust_staff',
  })
  @IsString()
  @IsNotEmpty()
  action: 'trust_staff' | 'manual_resolve';

  @ApiPropertyOptional({
    description: 'Optional resolution notes',
    example: 'Verified by gate supervisor',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateSetupStepDto {
  @ApiProperty({ description: 'Setup Step index (0 to 5)', example: 0 })
  @IsNumber()
  @IsNotEmpty()
  stepIndex: number;

  @ApiProperty({ description: 'Completion status of the step', example: true })
  @IsNotEmpty()
  completed: boolean;
}

export class InviteGuestDto {
  @ApiPropertyOptional({
    description: 'Invitation channel (WhatsApp, Email, SMS)',
    example: 'WhatsApp',
    default: 'WhatsApp',
  })
  @IsString()
  @IsOptional()
  channel?: string;
}

