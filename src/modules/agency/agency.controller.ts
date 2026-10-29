import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AgencyService } from './agency.service';
import { CreateClientDto, UpdateClientDto } from './dto/create-client.dto';
import { AssignTeamMemberDto, InviteTeamMemberDto } from './dto/invite-team.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('03 Agency Organizer / Workspace')
@Controller('agency')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AgencyController {
  constructor(@Inject(AgencyService) private readonly agencyService: AgencyService) {}

  @Get('dashboard')
  @Roles(UserRole.AGENCY, UserRole.ADMIN)
  @ResponseMessage('Agency dashboard retrieved successfully')
  @ApiOperation({
    summary: 'Agency home metrics, upcoming events, and recent client, invoice, and team activity',
  })
  async getDashboard(@CurrentUser() user: CurrentUserDto) {
    return this.agencyService.getDashboard(user.id);
  }

  @Get('clients')
  @Roles(UserRole.AGENCY, UserRole.ADMIN)
  @ResponseMessage('Agency clients retrieved successfully')
  @ApiOperation({ summary: 'List corporate clients managed by the agency' })
  async getClients(@CurrentUser() user: CurrentUserDto) {
    return this.agencyService.getClients(user.id, user.role);
  }

  @Post('clients')
  @Roles(UserRole.AGENCY, UserRole.ADMIN)
  @ResponseMessage('Client account created successfully')
  @ApiOperation({ summary: 'Add a new retainer client account' })
  @ApiBody({ type: CreateClientDto })
  @ApiResponse({ status: 201, description: 'Client account created' })
  async createClient(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateClientDto) {
    return this.agencyService.createClient(user.id, dto);
  }

  @Get('clients/:id')
  @Roles(UserRole.AGENCY, UserRole.ADMIN)
  @ResponseMessage('Agency client retrieved successfully')
  @ApiOperation({ summary: 'Client profile, events, and activity' })
  async getClient(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.agencyService.getClient(user.id, id);
  }

  @Patch('clients/:id')
  @Roles(UserRole.AGENCY, UserRole.ADMIN)
  @ResponseMessage('Client updated successfully')
  @ApiOperation({ summary: 'Update a client contact record' })
  async updateClient(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.agencyService.updateClient(user.id, id, dto);
  }

  @Patch('clients/:id/archive')
  @Roles(UserRole.AGENCY, UserRole.ADMIN)
  @ResponseMessage('Client archived successfully')
  @ApiOperation({ summary: 'Archive a client' })
  async archiveClient(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.agencyService.archiveClient(user.id, id);
  }

  @Get('reports')
  @Roles(UserRole.AGENCY, UserRole.ADMIN)
  @ResponseMessage('Agency reports retrieved successfully')
  @ApiOperation({ summary: 'Agency event, guest, and revenue reports' })
  async getReports(
    @CurrentUser() user: CurrentUserDto,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('eventId') eventId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.agencyService.getReports(user.id, { range, from, to, eventId, clientId });
  }

  @Get('team')
  @Roles(UserRole.AGENCY, UserRole.VENUE, UserRole.ADMIN)
  @ResponseMessage('Agency team retrieved successfully')
  @ApiOperation({ summary: 'Agency owner, admins, and gate staff' })
  async getTeam(@CurrentUser() user: CurrentUserDto) {
    return this.agencyService.getTeam(user.id);
  }

  @Post('team/invite')
  @Roles(UserRole.AGENCY, UserRole.VENUE, UserRole.ADMIN)
  @ResponseMessage('Team invitation sent successfully')
  @ApiOperation({ summary: 'Invite an agency admin or gate staff member' })
  @ApiBody({ type: InviteTeamMemberDto })
  async inviteTeamMember(@CurrentUser() user: CurrentUserDto, @Body() dto: InviteTeamMemberDto) {
    return this.agencyService.inviteTeamMember(user.id, dto);
  }

  @Post('team/assign')
  @Roles(UserRole.AGENCY, UserRole.VENUE, UserRole.ADMIN)
  @ResponseMessage('Team member assigned successfully')
  @ApiOperation({ summary: 'Assign an admin or gate staff member to an event' })
  @ApiBody({ type: AssignTeamMemberDto })
  async assignTeamMember(@CurrentUser() user: CurrentUserDto, @Body() dto: AssignTeamMemberDto) {
    return this.agencyService.assignTeamMember(user.id, dto);
  }

  @Get('invoices')
  @Roles(UserRole.AGENCY, UserRole.ADMIN)
  @ResponseMessage('Agency invoices retrieved successfully')
  @ApiOperation({ summary: 'List agency B2B billing invoices' })
  async getInvoices(@CurrentUser() user: CurrentUserDto) {
    return this.agencyService.getInvoices(user.id, user.role);
  }
}
