import { Controller, Get, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { FilterOrganizersDto } from './dto/filter-organizers.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('01 Super Admin / Organizers')
@Controller('admin/organizers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminOrganizersController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get()
  @ResponseMessage('Platform organizers retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] List all platform organizations with filtering by type (All, Individual, Agency, Venue), status, search keyword, and pagination',
  })
  @ApiResponse({ status: 200, description: 'Filtered platform organizers and tab counts returned' })
  async getOrganizers(@Query() filter: FilterOrganizersDto) {
    return this.adminService.getOrganizers(filter);
  }

  @Get(':id')
  @ResponseMessage('Organization details retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Retrieve single organization details with profile, team/clients/spaces relations, and created events',
  })
  @ApiParam({ name: 'id', description: 'Unique Organizer User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Single organization details returned' })
  async getOrganizerById(@Param('id') id: string) {
    return this.adminService.getOrganizerById(id);
  }
}

@ApiTags('01 Super Admin / Dashboard')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get('metrics')
  @ResponseMessage('Admin telemetry metrics retrieved successfully')
  @ApiOperation({ summary: '[Admin Only] Platform-wide telemetry metrics matching Figma dashboard (GMV, Active Events, Breakdown)' })
  @ApiResponse({ status: 200, description: 'Admin telemetry metrics returned' })
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('organizers')
  @ResponseMessage('Platform organizers retrieved successfully')
  @ApiOperation({ summary: '[Admin Only] List all verified platform organizers with filters' })
  async getOrganizers(@Query() filter: FilterOrganizersDto) {
    return this.adminService.getOrganizers(filter);
  }

  @Get('organizers/:id')
  @ResponseMessage('Organization details retrieved successfully')
  @ApiOperation({ summary: '[Admin Only] Retrieve single organization details by ID' })
  @ApiParam({ name: 'id', description: 'Unique Organizer User ID (UUID)' })
  async getAdminOrganizerById(@Param('id') id: string) {
    return this.adminService.getOrganizerById(id);
  }

  @Get('audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Compliance audit logs retrieved successfully')
  @ApiOperation({ summary: '[Admin Only] Retrieve security, financial, and compliance audit logs' })
  async getAuditLogs() {
    return this.adminService.getAuditLogs();
  }
}
