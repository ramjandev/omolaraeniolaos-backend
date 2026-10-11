import { Controller, Get, Post, Body, Query, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { CreatePlanDto, OrganizerType } from './dto/create-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Admin')
@Controller('admin')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Platform organizers retrieved successfully')
  @ApiOperation({ summary: '[Admin Only] List all verified platform organizers across Individual, Agency, and Venue types' })
  async getOrganizers() {
    return this.adminService.getOrganizers();
  }

  @Get('audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Compliance audit logs retrieved successfully')
  @ApiOperation({ summary: '[Admin Only] Retrieve security, financial, and compliance audit logs' })
  async getAuditLogs() {
    return this.adminService.getAuditLogs();
  }

  /**
   * Route for creating plans that accepts three types: Individual, Agency, or Venue
   */
  @Post('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Plan created successfully')
  @ApiOperation({
    summary: '[Admin Only] Create new membership/event pass plan for one of the three organizer types (Individual, Agency, Venue)',
  })
  @ApiResponse({ status: 201, description: 'Plan successfully created and published' })
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.adminService.createPlan(dto);
  }

  /**
   * Route for fetching plans by organizer type (Individual, Agency, Venue)
   */
  @Get('plans')
  @ResponseMessage('Plans retrieved successfully')
  @ApiOperation({
    summary: 'Get plans filtered by organizer type (Individual, Agency, Venue) for signup or admin plan management',
  })
  @ApiQuery({ name: 'type', enum: OrganizerType, required: false, description: 'Filter by organizer type' })
  @ApiResponse({ status: 200, description: 'Plans list returned' })
  async getPlans(@Query('type') type?: OrganizerType) {
    return this.adminService.getPlans(type);
  }
}
