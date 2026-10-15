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

@ApiTags('01 Super Admin / Plans')
@Controller('admin/plans')
export class AdminPlansController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Post()
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

  @Get()
  @ResponseMessage('Plans retrieved successfully')
  @ApiOperation({
    summary: 'Get plans filtered by organizer type (Individual, Agency, Venue) for signup or admin plan management',
  })
  @ApiQuery({ name: 'type', enum: OrganizerType, required: false, description: 'Filter by organizer type' })
  @ApiResponse({ status: 200, description: 'Plans list returned' })
  async getPlans(@Query('type') type?: OrganizerType) {
    return this.adminService.getPlans(type);
  }

  @Get(':id')
  @ResponseMessage('Plan details retrieved successfully')
  @ApiOperation({ summary: 'Get a single plan by its ID' })
  @ApiParam({ name: 'id', description: 'Unique identifier of the plan' })
  @ApiResponse({ status: 200, description: 'Plan details returned' })
  async getPlanById(@Param('id') id: string) {
    return this.adminService.getPlanById(id);
  }

  @Put(':id')
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

  @Delete(':id')
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
