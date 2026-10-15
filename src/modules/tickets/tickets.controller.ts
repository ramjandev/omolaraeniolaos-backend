import { Controller, Get, Post, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTierDto } from './dto/create-tier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('07 Shared Organizer / Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(@Inject(TicketsService) private readonly ticketsService: TicketsService) {}

  @Get(':eventId')
  @ResponseMessage('Ticket tiers retrieved successfully')
  @ApiOperation({ summary: 'List all ticket tiers for a specific event' })
  @ApiParam({
    name: 'eventId',
    type: String,
    description: 'Unique Event ID (UUID)',
    example: 'b94e77cb-8c65-4f32-8419-724578b776be',
  })
  async findByEvent(@Param('eventId') eventId: string) {
    return this.ticketsService.findByEvent(eventId);
  }

  @Post(':eventId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Ticket tier created successfully')
  @ApiOperation({ summary: 'Add a new ticket tier to an event' })
  @ApiParam({
    name: 'eventId',
    type: String,
    description: 'Unique Event ID (UUID)',
    example: 'b94e77cb-8c65-4f32-8419-724578b776be',
  })
  @ApiBody({ type: CreateTierDto })
  @ApiResponse({ status: 201, description: 'Ticket tier created successfully' })
  async create(@Param('eventId') eventId: string, @Body() dto: CreateTierDto) {
    return this.ticketsService.create(eventId, dto);
  }
}
