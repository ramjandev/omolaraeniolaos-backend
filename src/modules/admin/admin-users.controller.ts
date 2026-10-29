import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { InvitePlatformUserDto, UpdatePlatformUserDto } from './dto/platform-user.dto';

@ApiTags('01 Super Admin / Platform Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get()
  @ResponseMessage('Platform users retrieved successfully')
  @ApiOperation({ summary: '[Admin Only] List platform admin accounts' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'active', 'suspended'] })
  listPlatformUsers(@Query('search') search?: string, @Query('status') status?: string) {
    return this.adminService.listPlatformUsers(search, status);
  }

  @Post()
  @ResponseMessage('Platform user invited successfully')
  @ApiOperation({ summary: '[Admin Only] Create a platform admin and issue a temporary password' })
  invitePlatformUser(@Body() dto: InvitePlatformUserDto) {
    return this.adminService.invitePlatformUser(dto);
  }

  @Patch(':id')
  @ResponseMessage('Platform user updated successfully')
  @ApiOperation({ summary: '[Admin Only] Update a platform admin name, role label, or status' })
  updatePlatformUser(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformUserDto,
    @CurrentUser() actor: CurrentUserDto,
  ) {
    return this.adminService.updatePlatformUser(id, dto, actor?.id);
  }

  @Delete(':id')
  @ResponseMessage('Platform user removed successfully')
  @ApiOperation({ summary: '[Admin Only] Remove a platform admin account' })
  deletePlatformUser(@Param('id') id: string, @CurrentUser() actor: CurrentUserDto) {
    return this.adminService.deletePlatformUser(id, actor?.id);
  }
}
