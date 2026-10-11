// =============================================================================
// Backend TypeScript Domain Models & Enums
// Independent of @prisma/client generation for zero-crash startup
// =============================================================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORGANIZER_INDIVIDUAL = 'ORGANIZER_INDIVIDUAL',
  ORGANIZER_AGENCY = 'ORGANIZER_AGENCY',
  ORGANIZER_VENUE = 'ORGANIZER_VENUE',
  GATE_STAFF = 'GATE_STAFF',
  GUEST = 'GUEST',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  LIVE = 'LIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}

export enum EventFormat {
  IN_PERSON = 'IN_PERSON',
  VIRTUAL = 'VIRTUAL',
  HYBRID = 'HYBRID',
}

export enum TicketTierType {
  FREE = 'FREE',
  EARLY_BIRD = 'EARLY_BIRD',
  GENERAL = 'GENERAL',
  VIP = 'VIP',
  SPEAKER = 'SPEAKER',
  SPONSOR = 'SPONSOR',
  BACKSTAGE = 'BACKSTAGE',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentGateway {
  STRIPE = 'STRIPE',
  PAYSTACK = 'PAYSTACK',
  FLUTTERWAVE = 'FLUTTERWAVE',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum AttendeeStatus {
  PENDING = 'PENDING',
  ATTENDING = 'ATTENDING',
  CHECKED_IN = 'CHECKED_IN',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum SpaceType {
  BALLROOM = 'BALLROOM',
  AUDITORIUM = 'AUDITORIUM',
  TERRACE = 'TERRACE',
  BOARDROOM = 'BOARDROOM',
  EXHIBITION_HALL = 'EXHIBITION_HALL',
  BANQUET_HALL = 'BANQUET_HALL',
  ROOFTOP = 'ROOFTOP',
}

export enum SpaceStatus {
  AVAILABLE = 'AVAILABLE',
  BOOKED = 'BOOKED',
  MAINTENANCE = 'MAINTENANCE',
  CLOSED = 'CLOSED',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
