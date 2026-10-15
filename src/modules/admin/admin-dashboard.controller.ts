import { Controller, Get, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('01 Super Admin / Dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminDashboardController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get('summary')
  @ResponseMessage('Admin dashboard overview summary retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] 4 KPI Cards (Total Organizers: 142, Active Events: 847, Completed Events: 2,341, Platform Revenue: ₦4.2M)',
  })
  @ApiResponse({ status: 200, description: '4 KPI metrics summary returned' })
  async getDashboardSummary() {
    return this.adminService.getDashboardSummary();
  }

  @Get('organizer-breakdown')
  @ResponseMessage('Organizer distribution breakdown retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Distribution doughnut chart data (Individual: 69%, Agency: 22%, Venue: 9%)',
  })
  @ApiResponse({ status: 200, description: 'Organizer breakdown by percentage & count returned' })
  async getOrganizerBreakdown() {
    return this.adminService.getOrganizerBreakdown();
  }

  @Get('revenue-by-type')
  @ResponseMessage('Revenue by organizer type breakdown retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Revenue Table breakdown by Organizer Type (Individual ₦2.1M, Agency ₦1.6M, Venue ₦0.5M)',
  })
  @ApiResponse({ status: 200, description: 'Revenue by organizer type returned' })
  async getRevenueByOrganizerType() {
    return this.adminService.getRevenueByOrganizerType();
  }

  @Get('active-events')
  @ResponseMessage('Active events retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Paginated list of Active Events matching Dashboard table with status, guest count, and event type',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'Royal Gala' })
  @ApiResponse({ status: 200, description: 'Paginated active events returned' })
  async getActiveEvents(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.getDashboardActiveEvents(page, limit, search);
  }

  @Get('events/:id')
  @ResponseMessage('Admin single event details retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Retrieve single event details with organizer, venue/agency relations, ticket tiers, schedules, and attendance metrics',
  })
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
    description: 'Unique Event ID (UUID)',
    example: '1a249d44-8eed-4b88-9f7b-f323952ee599',
  })
  @ApiResponse({ status: 200, description: 'Single event full detail returned' })
  async getEventById(@Param('id') id: string) {
    return this.adminService.getAdminEventById(id);
  }

  @Get('metrics')
  @ResponseMessage('All consolidated dashboard telemetry retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Consolidated endpoint returning summary, breakdown, revenue table, and active events in a single call',
  })
  @ApiResponse({ status: 200, description: 'Consolidated dashboard telemetry returned' })
  async getFullDashboardTelemetry() {
    return this.adminService.getMetrics();
  }
}
