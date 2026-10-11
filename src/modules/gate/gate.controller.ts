import { Controller, Get, Post, Body, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { GateService } from './gate.service';
import { ScanDto } from './dto/scan.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Gate Staff Operations')
@Controller('gate')
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

  @Get('shifts')
  @ResponseMessage('Gate shifts retrieved successfully')
  @ApiOperation({ summary: 'Get active gate staff turnstile shifts' })
  async getShifts() {
    return this.gateService.getShifts();
  }
}
