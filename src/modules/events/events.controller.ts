import { Controller, Get, Post, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { FilterEventsDto } from './dto/filter-events.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(@Inject(EventsService) private readonly eventsService: EventsService) {}

  @Get()
  @ResponseMessage('Events retrieved successfully')
  @ApiOperation({ summary: 'List published and upcoming events with filters' })
  @ApiQuery({ name: 'status', required: false, enum: EventStatus, description: 'Filter by event status' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by event category' })
  @ApiQuery({ name: 'organizerId', required: false, type: String, description: 'Filter by organizer UUID' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Keyword search across title and description' })
  async findAll(@Query() query: FilterEventsDto) {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('Event details retrieved successfully')
  @ApiOperation({ summary: 'Retrieve comprehensive event details, ticket tiers, and schedules' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Unique Event ID (UUID)',
    example: 'b94e77cb-8c65-4f32-8419-724578b776be',
  })
  async findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Event created successfully')
  @ApiOperation({ summary: 'Create a new event production' })
  @ApiBody({ type: CreateEventDto })
  @ApiResponse({ status: 201, description: 'Event created as DRAFT' })
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.id, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Event published successfully')
  @ApiOperation({ summary: 'Publish draft event to live status' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Unique Event ID (UUID) to publish',
    example: 'b94e77cb-8c65-4f32-8419-724578b776be',
  })
  async publish(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    return this.eventsService.publish(id, user);
  }
}
