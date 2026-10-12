import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus, EventStatus, EventFormat, AttendeeStatus, OrderStatus } from '@prisma/client';

export class IndividualUserDto {
  @ApiProperty({ example: '1a249d44-8eed-4b88-9f7b-f323952ee599' })
  id: string;

  @ApiProperty({ example: 'James Obi' })
  fullName: string;

  @ApiProperty({ example: 'individual@mceniesvite.com' })
  email: string;

  @ApiPropertyOptional({ example: '+234 803 123 4567' })
  phone?: string | null;

  @ApiPropertyOptional({ example: null })
  avatarUrl?: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.ORGANIZER_INDIVIDUAL })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: '2026-10-10T12:00:00.000Z' })
  createdAt: Date;
}

export class IndividualTicketTierDto {
  @ApiProperty({ example: 'tt_101' })
  id: string;

  @ApiProperty({ example: 'General Admission' })
  name: string;

  @ApiProperty({ example: 5000 })
  price: number;

  @ApiProperty({ example: 150 })
  capacity: number;

  @ApiProperty({ example: 0 })
  soldCount: number;
}

export class IndividualTableZoneDto {
  @ApiProperty({ example: 'tz_101' })
  id: string;

  @ApiProperty({ example: 'VIP Royal Table Zone' })
  zoneName: string;

  @ApiProperty({ example: 10 })
  tableCount: number;

  @ApiProperty({ example: 8 })
  seatPerTable: number;

  @ApiProperty({ example: 80 })
  totalCapacity: number;
}

export class IndividualEventCountsDto {
  @ApiProperty({ example: 12 })
  attendees: number;

  @ApiProperty({ example: 3 })
  orders: number;

  @ApiProperty({ example: 2 })
  ticketTiers: number;

  @ApiProperty({ example: 1 })
  tableZones: number;
}

export class IndividualActiveEventDto {
  @ApiProperty({ example: '1a249d44-8eed-4b88-9f7b-f323952ee599' })
  id: string;

  @ApiProperty({ example: '1a249d44-8eed-4b88-9f7b-f323952ee599' })
  organizerId: string;

  @ApiProperty({ example: 'The Grand Royal Gala & Investiture' })
  title: string;

  @ApiProperty({ example: 'the-grand-royal-gala-investiture' })
  slug: string;

  @ApiProperty({ example: 'A prestigious royal celebration with dinner and red carpet.' })
  description: string;

  @ApiProperty({ example: 'Gala' })
  category: string;

  @ApiProperty({ enum: EventFormat, example: EventFormat.IN_PERSON })
  format: EventFormat;

  @ApiProperty({ enum: EventStatus, example: EventStatus.DRAFT })
  status: EventStatus;

  @ApiProperty({ example: '2026-10-24T18:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ example: '2026-10-24T23:00:00.000Z' })
  endDate: Date;

  @ApiProperty({ example: 'UTC+1' })
  timezone: string;

  @ApiPropertyOptional({ example: 'The Monarch Event Centre' })
  venueName?: string | null;

  @ApiPropertyOptional({ example: 'Lekki Phase 1' })
  address?: string | null;

  @ApiPropertyOptional({ example: 'Lagos' })
  city?: string | null;

  @ApiPropertyOptional({ example: 'Nigeria' })
  country?: string | null;

  @ApiProperty({ example: 150 })
  capacity: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiPropertyOptional({ example: null })
  coverImageUrl?: string | null;

  @ApiProperty({ example: '2026-10-10T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-10T12:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: [IndividualTicketTierDto] })
  ticketTiers: IndividualTicketTierDto[];

  @ApiProperty({ type: [IndividualTableZoneDto] })
  tableZones: IndividualTableZoneDto[];

  @ApiProperty({ type: IndividualEventCountsDto })
  _count: IndividualEventCountsDto;
}

export class IndividualChecklistStepDto {
  @ApiProperty({ example: 1 })
  stepNumber: number;

  @ApiProperty({ example: 'basics' })
  key: string;

  @ApiProperty({ example: 'Event Basic' })
  title: string;

  @ApiProperty({ example: true })
  isCompleted: boolean;
}

export class IndividualSetupChecklistDto {
  @ApiProperty({ example: true })
  basicsCompleted: boolean;

  @ApiProperty({ example: false })
  detailsCompleted: boolean;

  @ApiProperty({ example: false })
  guestsConfigured: boolean;

  @ApiProperty({ example: false })
  invitationsSent: boolean;

  @ApiProperty({ example: false })
  rsvpConfigured: boolean;

  @ApiProperty({ example: false })
  seatingConfigured: boolean;

  @ApiProperty({ example: 1 })
  completedCount: number;

  @ApiProperty({ example: 6 })
  totalCount: number;

  @ApiProperty({ example: 17 })
  completionPercentage: number;

  @ApiProperty({ type: [IndividualChecklistStepDto] })
  steps: IndividualChecklistStepDto[];
}

export class IndividualMetricsDto {
  @ApiProperty({ example: 1 })
  totalEvents: number;

  @ApiProperty({ example: 1 })
  draftEvents: number;

  @ApiProperty({ example: 0 })
  liveEvents: number;

  @ApiProperty({ example: 0 })
  completedEvents: number;

  @ApiProperty({ example: 150 })
  totalCapacity: number;

  @ApiProperty({ example: 12 })
  totalAttendees: number;

  @ApiProperty({ example: 8 })
  confirmedAttendees: number;

  @ApiProperty({ example: 0 })
  checkedInAttendees: number;

  @ApiProperty({ example: 0 })
  totalRevenue: number;
}

export class IndividualRecentAttendeeDto {
  @ApiProperty({ example: 'att_101' })
  id: string;

  @ApiProperty({ example: 'Dr. Tunde Fashola' })
  fullName: string;

  @ApiProperty({ example: 'tunde@fashola.com' })
  email: string;

  @ApiProperty({ enum: AttendeeStatus, example: AttendeeStatus.ATTENDING })
  status: AttendeeStatus;

  @ApiPropertyOptional({ example: null })
  checkInTime?: Date | null;

  @ApiProperty({ example: '2026-10-12T07:45:00.000Z' })
  createdAt: Date;
}

export class IndividualRecentOrderDto {
  @ApiProperty({ example: 'ord_101' })
  id: string;

  @ApiProperty({ example: 'ORD-9821' })
  orderNumber: string;

  @ApiProperty({ example: 'Dr. Tunde Fashola' })
  buyerName: string;

  @ApiProperty({ example: 'tunde@fashola.com' })
  buyerEmail: string;

  @ApiProperty({ example: 15000 })
  totalAmount: number;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PAID })
  status: OrderStatus;

  @ApiProperty({ example: '2026-10-12T07:45:00.000Z' })
  createdAt: Date;
}

export class IndividualDashboardResponseDto {
  @ApiProperty({ type: IndividualUserDto })
  user: IndividualUserDto;

  @ApiPropertyOptional({ type: IndividualActiveEventDto })
  activeEvent: IndividualActiveEventDto | null;

  @ApiProperty({ type: IndividualSetupChecklistDto })
  setupChecklist: IndividualSetupChecklistDto;

  @ApiProperty({ type: IndividualMetricsDto })
  metrics: IndividualMetricsDto;

  @ApiProperty({ type: [IndividualRecentAttendeeDto] })
  recentAttendees: IndividualRecentAttendeeDto[];

  @ApiProperty({ type: [IndividualRecentOrderDto] })
  recentOrders: IndividualRecentOrderDto[];
}
