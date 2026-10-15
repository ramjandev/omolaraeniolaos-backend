import { Controller, Get, Post, Body, HttpCode, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GateService } from './gate.service';
import { ScanDto, SyncScansDto } from './dto/scan.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('05 Gate Staff / Scanner')
@Controller('gate')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.GATE,
  UserRole.INDIVIDUAL,
  UserRole.AGENCY,
  UserRole.VENUE,
)
@ApiBearerAuth()
export class GateController {
  constructor(@Inject(GateService) private readonly gateService: GateService) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Ticket successfully verified and checked in')
  @ApiOperation({ summary: 'High-speed turnstile QR ticket validation and admission' })
  @ApiBody({ type: ScanDto })
  @ApiResponse({ status: 200, description: 'Ticket successfully verified and checked in' })
  @ApiResponse({ status: 404, description: 'Ticket not found / invalid QR' })
  @ApiResponse({ status: 409, description: 'Duplicate scan: already checked in' })
  async verify(@Body() dto: ScanDto) {
    return this.gateService.verify(dto);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Offline scans synced')
  @ApiOperation({ summary: 'Replay QR scans captured while the gate device was offline' })
  @ApiBody({ type: SyncScansDto })
  async sync(@Body() dto: SyncScansDto) {
    return this.gateService.syncOfflineScans(dto.scans || []);
  }

  @Get('sample-pass')
  @ResponseMessage('Sandbox sample pass retrieved')
  @ApiOperation({ summary: 'Sandbox-only sample QR for gate demo (disabled in production)' })
  async samplePass() {
    return this.gateService.samplePass();
  }

  @Get('shifts')
  @ResponseMessage('Gate shifts retrieved successfully')
  @ApiOperation({ summary: 'Get active gate staff turnstile shifts' })
  async getShifts() {
    return this.gateService.getShifts();
  }
}
