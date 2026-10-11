import { Controller, Get, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AgencyService } from './agency.service';
import { CreateClientDto } from './dto/create-client.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Agency Operations')
@Controller('agency')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AgencyController {
  constructor(@Inject(AgencyService) private readonly agencyService: AgencyService) {}

  @Get('clients')
  @Roles(UserRole.ORGANIZER_AGENCY, UserRole.SUPER_ADMIN)
  @ResponseMessage('Agency clients retrieved successfully')
  @ApiOperation({ summary: 'List corporate clients managed by the agency' })
  async getClients() {
    return this.agencyService.getClients();
  }

  @Post('clients')
  @Roles(UserRole.ORGANIZER_AGENCY, UserRole.SUPER_ADMIN)
  @ResponseMessage('Client account created successfully')
  @ApiOperation({ summary: 'Add a new retainer client account' })
  @ApiBody({ type: CreateClientDto })
  @ApiResponse({ status: 201, description: 'Client account created' })
  async createClient(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateClientDto) {
    return this.agencyService.createClient(user.id, dto);
  }

  @Get('invoices')
  @Roles(UserRole.ORGANIZER_AGENCY, UserRole.SUPER_ADMIN)
  @ResponseMessage('Agency invoices retrieved successfully')
  @ApiOperation({ summary: 'List agency B2B billing invoices' })
  async getInvoices() {
    return this.agencyService.getInvoices();
  }
}
