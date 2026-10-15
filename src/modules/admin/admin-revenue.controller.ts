import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { CreatePlanDto, OrganizerType } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('01 Super Admin / Revenue')
@Controller('admin/revenue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminRevenuePlansController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  /**
   * 1. GET /api/admin/revenue/overview
   * Returns complete overview telemetry matching Revenue & Plans dashboard page
   */
  @Get('overview')
  @ResponseMessage('Platform revenue and billing overview retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Retrieve 4 KPI cards (Total Revenue, MoM Growth, Available Plans, Active Subscriptions)',
  })
  @ApiResponse({ status: 200, description: 'Revenue overview KPIs returned' })
  async getRevenueOverview() {
    return this.adminService.getRevenueOverview();
  }

  /**
   * 2. GET /api/admin/revenue/breakdown
   * Monthly revenue chart breakdown (Jan to Dec)
   */
  @Get('breakdown')
  @ResponseMessage('Monthly revenue breakdown chart data retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Monthly bar chart distribution data (Jan-Dec) for revenue analytics',
  })
  @ApiQuery({ name: 'period', required: false, enum: ['Yearly', 'Monthly'], example: 'Yearly' })
  @ApiResponse({ status: 200, description: 'Monthly revenue series returned' })
  async getRevenueBreakdown(@Query('period') period?: string) {
    return this.adminService.getRevenueBreakdown(period);
  }

  /**
   * 3. GET /api/admin/revenue/transactions
   * Filterable transactions table matching Revenue & Plans page
   */
  @Get('transactions')
  @ResponseMessage('Revenue transactions retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] List all paid, pending, and failed payment transactions with search and pagination',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['All', 'Paid', 'Failed', 'Pending'], example: 'All' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'TXN-8392A7B1' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Filtered transactions table returned' })
  async getTransactions(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getRevenueTransactions(status, search, page, limit);
  }

  /**
   * 4. GET /api/admin/revenue/all
   * Single consolidated endpoint returning everything for revenue:
   * (Overview KPIs + Monthly Breakdown + Filtered Transactions + Available Plans)
   */
  @Get('all')
  @ResponseMessage('All consolidated revenue and plans telemetry retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Consolidated endpoint returning overview, breakdown chart, transactions, and plans',
  })
  @ApiResponse({ status: 200, description: 'Consolidated revenue dataset returned' })
  async getAllRevenueData() {
    return this.adminService.getAllRevenueData();
  }

  // ==========================================
  // PLANS MANAGEMENT ENDPOINTS (Same Folder)
  // ==========================================

  @Post('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Plan created successfully')
  @ApiOperation({
    summary: '[Admin Only] Create new membership/event pass plan for one of the three organizer types (Individual, Agency, Venue)',
  })
  @ApiResponse({ status: 201, description: 'Plan successfully created and published' })
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.adminService.createPlan(dto);
  }

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

  @Get('plans/:id')
  @ResponseMessage('Plan details retrieved successfully')
  @ApiOperation({ summary: 'Get a single plan by its ID' })
  @ApiParam({ name: 'id', description: 'Unique identifier of the plan' })
  @ApiResponse({ status: 200, description: 'Plan details returned' })
  async getPlanById(@Param('id') id: string) {
    return this.adminService.getPlanById(id);
  }

  @Put('plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Plan updated successfully')
  @ApiOperation({
    summary: '[Admin Only] Edit/Update an existing membership or event pass plan',
  })
  @ApiParam({ name: 'id', description: 'Unique identifier of the plan to update' })
  @ApiResponse({ status: 200, description: 'Plan successfully updated' })
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.adminService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Plan deleted successfully')
  @ApiOperation({
    summary: '[Admin Only] Delete a membership or event pass plan by ID',
  })
  @ApiParam({ name: 'id', description: 'Unique identifier of the plan to delete' })
  @ApiResponse({ status: 200, description: 'Plan successfully deleted' })
  async deletePlan(@Param('id') id: string) {
    return this.adminService.deletePlan(id);
  }
}
