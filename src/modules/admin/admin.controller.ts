import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
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
}
