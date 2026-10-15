import {
  Controller,
  Get,
  Put,
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
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { UpdatePlatformSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('01 Super Admin / Settings')
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get()
  @ResponseMessage('Platform settings retrieved successfully')
  @ApiOperation({
    summary:
      'Retrieve system-wide configuration (WhatsApp API, Google Cloud Speech, Flutterwave, Feature Flags, Supported Languages, Default Plan Settings)',
  })
  @ApiResponse({ status: 200, description: 'Complete platform configuration returned' })
  async getSettings() {
    return this.adminService.getPlatformSettings();
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Platform settings updated successfully')
  @ApiOperation({
    summary:
      '[Admin Only] Update feature flags, default plan settings, language states, or credentials',
  })
  @ApiBody({ type: UpdatePlatformSettingsDto })
  @ApiResponse({ status: 200, description: 'Updated platform settings returned' })
  async updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.adminService.updatePlatformSettings(dto);
  }

  @Post('test-connection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Connection test completed')
  @ApiOperation({
    summary:
      '[Admin Only] Test integration health for a provider (whatsapp, payment, aispeech)',
  })
  @ApiQuery({
    name: 'provider',
    required: true,
    enum: ['whatsapp', 'payment', 'aispeech'],
    example: 'whatsapp',
  })
  @ApiResponse({ status: 200, description: 'Connection status test result returned' })
  async testConnection(@Query('provider') provider: string) {
    return this.adminService.testPlatformConnection(provider);
  }
}
