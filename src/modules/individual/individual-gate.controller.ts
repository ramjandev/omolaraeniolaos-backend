import {
  Controller,
  Get,
  Post,
  Body,
  Query,
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
  UnassignGateStaffDto,
  RemoveGateStaffDto,
} from './dto/individual-gate.dto';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('02 Individual Organizer / Gate Crew')
@Controller(['individual/gate', 'organizer/individual/gate'])
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class IndividualGateController {
  constructor(
    @Inject(IndividualGateService)
    private readonly gateService: IndividualGateService,
  ) {}

  @Get('invitation')
  @ResponseMessage('Gate staff invitation retrieved')
  @ApiOperation({
    summary: '[Public] Preview a gate staff invitation',
    description: 'Returns the organizer, event, date, and gate for a first-time invitation link.',
  })
  async getInvitation(@Query('token') token?: string) {
    return this.gateService.getInvitation(token || '');
  }

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
  async assignStaff(
    @CurrentUser() user: CurrentUserDto | undefined,
    @Body() dto: AssignGateStaffDto,
  ) {
    return this.gateService.assignStaff(dto, user?.id);
  }

  @Post('unassign')
  @ResponseMessage('Gate assignment removed')
  @ApiOperation({
    summary: '[Individual Organizer] Remove a gate staff assignment',
    description: 'Removes a gate staff member from one event.',
  })
  @ApiBody({ type: UnassignGateStaffDto })
  async unassignStaff(
    @CurrentUser() user: CurrentUserDto | undefined,
    @Body() dto: UnassignGateStaffDto,
  ) {
    return this.gateService.unassignStaff(dto, user?.id);
  }

  @Post('remove')
  @ResponseMessage('Gate staff removed')
  @ApiOperation({
    summary: '[Individual Organizer] Delete a gate staff member',
    description: 'Removes the staff member from the roster, clears their assignments, and deletes the gate account.',
  })
  @ApiBody({ type: RemoveGateStaffDto })
  async removeStaff(
    @CurrentUser() user: CurrentUserDto | undefined,
    @Body() dto: RemoveGateStaffDto,
  ) {
    return this.gateService.removeStaff(dto, user?.id);
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
  async assignAllStaff(
    @CurrentUser() user: CurrentUserDto | undefined,
    @Body() dto: AssignAllGateStaffDto,
  ) {
    return this.gateService.assignAllStaff(dto, user?.id);
  }
}
