import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InviteGateStaffDto {
  @ApiProperty({ example: 'John Mensah', description: 'Full name of gate staff member' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'john.mensah@mceniesvite.com', description: 'Email address for invitation' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+234 803 456 7890', description: 'Contact phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Gate Staff', default: 'Gate Staff', description: 'Role assigned' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: '1a249d44-8eed-4b88-9f7b-f323952ee599', description: 'Event ID to assign staff to' })
  @IsString()
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional({ example: 'Main Entrance Gate A', description: 'Gate name / turnstile post' })
  @IsString()
  @IsOptional()
  gateNumber?: string;
}

export class AssignGateStaffDto {
  @ApiProperty({ example: 'staff_101', description: 'Staff user ID or profile ID' })
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({ example: '1a249d44-8eed-4b88-9f7b-f323952ee599', description: 'Target event ID' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiPropertyOptional({ example: 'Gate 1', description: 'Turnstile or entrance gate name' })
  @IsString()
  @IsOptional()
  gateNumber?: string;
}

export class AssignAllGateStaffDto {
  @ApiProperty({ example: '1a249d44-8eed-4b88-9f7b-f323952ee599', description: 'Target event ID' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiPropertyOptional({ example: 'Gate', description: 'Gate prefix or uniform gate name' })
  @IsString()
  @IsOptional()
  gatePrefix?: string;

  @ApiPropertyOptional({ example: ['staff_1', 'staff_2'], description: 'Optional subset of staff IDs to assign' })
  @IsOptional()
  staffIds?: string[];
}

export class RemoveGateStaffDto {
  @ApiProperty({ example: 'staff_101' })
  @IsString()
  @IsNotEmpty()
  staffId: string;
}

export class UnassignGateStaffDto {
  @ApiProperty({ example: 'staff_101' })
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({ example: '1a249d44-8eed-4b88-9f7b-f323952ee599' })
  @IsString()
  @IsNotEmpty()
  eventId: string;
}

export class GateStaffAssignmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventId: string;

  @ApiProperty()
  eventTitle: string;

  @ApiProperty()
  gateNumber: string;

  @ApiProperty()
  assignedAt: string;
}

export class GateStaffMemberItemDto {
  @ApiProperty({ example: 'staff_101' })
  id: string;

  @ApiProperty({ example: 'John Mensah' })
  fullName: string;

  @ApiProperty({ example: 'john@email.com' })
  email: string;

  @ApiPropertyOptional({ example: '+234 803 123 4567' })
  phone?: string | null;

  @ApiPropertyOptional({ example: null })
  avatarUrl?: string | null;

  @ApiProperty({ example: 'Gate Staff' })
  role: string;

  @ApiProperty({ example: 1 })
  assignedEventsCount: number;

  @ApiPropertyOptional({ example: 'The Grand Royal Gala & Investiture' })
  currentAssignment?: string | null;

  @ApiPropertyOptional({ example: '1a249d44-8eed-4b88-9f7b-f323952ee599' })
  currentEventId?: string | null;

  @ApiPropertyOptional({ example: 'Gate A' })
  gateNumber?: string | null;

  @ApiProperty({ example: false })
  isOwner: boolean;

  @ApiProperty({ type: [GateStaffAssignmentDto] })
  assignments: GateStaffAssignmentDto[];
}

export class GateManagementMetricsDto {
  @ApiProperty({ example: 1, description: 'Total staff owners / hosts' })
  ownerCount: number;

  @ApiProperty({ example: 5, description: 'Total assigned gate staff' })
  gateStaffCount: number;

  @ApiProperty({ example: 1, description: 'Active events with gate staff' })
  activeEventsCount: number;
}

export class GateEventOptionDto {
  @ApiProperty({ example: '1a249d44-8eed-4b88-9f7b-f323952ee599' })
  id: string;

  @ApiProperty({ example: 'The Grand Royal Gala & Investiture' })
  title: string;
}

export class GateManagementOverviewResponseDto {
  @ApiProperty({ type: GateManagementMetricsDto })
  metrics: GateManagementMetricsDto;

  @ApiProperty({ type: [GateStaffMemberItemDto] })
  staff: GateStaffMemberItemDto[];

  @ApiProperty({ type: [GateEventOptionDto] })
  events: GateEventOptionDto[];
}
