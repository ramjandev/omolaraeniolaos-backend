import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { IndividualGateService } from './individual-gate.service';
import {
  GateManagementOverviewResponseDto,
  InviteGateStaffDto,
  AssignGateStaffDto,
  AssignAllGateStaffDto,
} from './dto/individual-gate.dto';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Individual - Gate Management')
@Controller(['individual/gate', 'organizer/individual/gate'])
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class IndividualGateController {
  constructor(
    @Inject(IndividualGateService)
    private readonly gateService: IndividualGateService,
  ) {}

  @Get()
  @ResponseMessage('Gate management roster retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Dedicated Gate Management Roster & Telemetry',
    description: 'Retrieves all assigned gate staff, host records, active events, and metrics on a dedicated route not tied to a single event.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gate staff roster returned successfully',
    type: GateManagementOverviewResponseDto,
  })
  async getGateOverview(@CurrentUser() user?: CurrentUserDto) {
    return this.gateService.getGateOverview(user?.id);
  }

  @Post('invite')
  @ResponseMessage('Gate staff invitation sent successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Invite a new Gate Staff member',
    description: 'Dispatches an invitation to gate staff with name, email, phone, role, and event/gate assignment.',
  })
  @ApiBody({ type: InviteGateStaffDto })
  @ApiResponse({
    status: 201,
    description: 'Gate staff invitation created and dispatched',
  })
  async inviteStaff(
    @CurrentUser() user: CurrentUserDto | undefined,
    @Body() dto: InviteGateStaffDto,
  ) {
    return this.gateService.inviteStaff(dto, user?.id);
  }

  @Post('assign')
  @ResponseMessage('Gate staff assignment updated successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Assign Gate Staff to an event & gate turnstile',
    description: 'Assigns an existing gate staff member to a selected event and gate post.',
  })
  @ApiBody({ type: AssignGateStaffDto })
  @ApiResponse({
    status: 200,
    description: 'Assignment saved successfully',
  })
  async assignStaff(@Body() dto: AssignGateStaffDto) {
    return this.gateService.assignStaff(dto);
  }

  @Post('assign-all')
  @ResponseMessage('All gate staff members assigned successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Assign All Gate Staff to an event',
    description: 'Bulk assigns all available gate staff members to a target event and optional gate turnstiles.',
  })
  @ApiBody({ type: AssignAllGateStaffDto })
  @ApiResponse({
    status: 200,
    description: 'All gate staff successfully assigned to the event',
  })
  async assignAllStaff(@Body() dto: AssignAllGateStaffDto) {
    return this.gateService.assignAllStaff(dto);
  }
}
