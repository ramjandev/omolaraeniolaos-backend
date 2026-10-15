import { Controller, Get, Query, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('01 Super Admin / Analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminAnalyticsController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  /**
   * 1. GET /api/admin/analytics/overview
   * Returns the top 6 KPI cards:
   * (New Organizers, Events Created, RSVPs Processed, WhatsApp Messages Sent, Voice RSVP Usage %, Check-in Volume)
   */
  @Get('overview')
  @ResponseMessage('Platform analytics overview retrieved successfully')
  @ApiOperation({
    summary:
      '[Admin Only] Retrieve 6 top KPI cards (New Organizers, Events Created, RSVPs Processed, WhatsApp Messages, Voice RSVP %, Check-in Volume)',
  })
  @ApiResponse({ status: 200, description: 'Analytics KPI metrics returned' })
  async getOverview() {
    return this.adminService.getAnalyticsOverview();
  }

  /**
   * 2. GET /api/admin/analytics/organizer-growth
   * Multi-line chart series by organizer type (Individual, Agency, Venue) over time
   */
  @Get('organizer-growth')
  @ResponseMessage('Organizer growth analytics retrieved successfully')
  @ApiOperation({
    summary:
      '[Admin Only] Multi-line chart data showing organizer growth over time split by Individual, Agency, and Venue',
  })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: ['6_months', '12_months'],
    example: '6_months',
    description: 'Time period range (defaults to 6_months)',
  })
  @ApiResponse({ status: 200, description: 'Organizer growth series returned' })
  async getOrganizerGrowth(@Query('range') range?: string) {
    return this.adminService.getOrganizerGrowth(range);
  }

  /**
   * 3. GET /api/admin/analytics/events-created
   * Bar chart series of events created per month
   */
  @Get('events-created')
  @ResponseMessage('Events created timeline analytics retrieved successfully')
  @ApiOperation({
    summary: '[Admin Only] Bar chart data of events created over time',
  })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: ['6_months', '12_months'],
    example: '6_months',
    description: 'Time period range (defaults to 6_months)',
  })
  @ApiResponse({ status: 200, description: 'Events created series returned' })
  async getEventsCreated(@Query('range') range?: string) {
    return this.adminService.getEventsCreatedOverTime(range);
  }

  /**
   * 4. GET /api/admin/analytics/voice-rsvp-adoption
   * Donut chart breakdown: Button vs Voice Note vs Text Reply
   */
  @Get('voice-rsvp-adoption')
  @ResponseMessage('Voice RSVP adoption breakdown retrieved successfully')
  @ApiOperation({
    summary:
      '[Admin Only] Donut chart distribution of RSVP response channels (Button vs Voice Note vs Text Reply)',
  })
  @ApiResponse({ status: 200, description: 'Voice RSVP adoption breakdown returned' })
  async getVoiceRsvpAdoption() {
    return this.adminService.getVoiceRsvpAdoption();
  }

  /**
   * 5. GET /api/admin/analytics/all
   * Single consolidated endpoint returning all 4 components for the Analytics page
   */
  @Get('all')
  @ResponseMessage('All consolidated analytics telemetry retrieved successfully')
  @ApiOperation({
    summary:
      '[Admin Only] Single consolidated endpoint returning overview KPIs, organizer growth, events created, and voice RSVP adoption',
  })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: ['6_months', '12_months'],
    example: '6_months',
  })
  @ApiResponse({ status: 200, description: 'Complete analytics dataset returned' })
  async getAllAnalytics(@Query('range') range?: string) {
    return this.adminService.getAllAnalyticsData(range);
  }
}
