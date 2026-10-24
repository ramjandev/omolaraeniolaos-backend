import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IndividualEventsService } from './individual-events.service';
import {
  FilterIndividualEventsDto,
  CreateIndividualEventDto,
  UpdateIndividualEventDto,
  AddIndividualGuestDto,
  BulkAddIndividualGuestsDto,
  UpdateIndividualGuestDto,
  AssignGuestSeatingDto,
  CreateSeatingDto,
  ResolveFlagDto,
  UpdateSetupStepDto,
  InviteGuestDto,
} from './dto/individual-events.dto';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('02 Individual Organizer / Events')
@Controller(['individual/events', 'organizer/individual/events'])
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class IndividualEventsController {
  constructor(
    @Inject(IndividualEventsService)
    private readonly eventsService: IndividualEventsService,
  ) {}

  @Get()
  @ResponseMessage('Individual organizer events retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] List events with status & search filters',
    description:
      'Returns all events managed by the individual organizer, including countdown, attendee counts, and live status.',
  })
  async getEvents(
    @CurrentUser() user?: CurrentUserDto,
    @Query() query?: FilterIndividualEventsDto,
  ) {
    return this.eventsService.getEvents(user?.id, query);
  }

  @Post()
  @ResponseMessage('Event created successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Create a new event via wizard',
    description:
      'Creates a new event production with default ticket tiers (VIP & General) and initial table seating layout.',
  })
  @ApiBody({ type: CreateIndividualEventDto })
  async createEvent(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateIndividualEventDto,
  ) {
    return this.eventsService.createEvent(user?.id, dto);
  }

  @Get(':id')
  @ResponseMessage('Event workspace details retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Get single event workspace details',
    description:
      'Retrieves event metadata, the 4 KPI cards (Invited, Confirmed RSVP, Checked In, VIP Attendance), countdown, and 6 setup checklist steps.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID or slug, or "1" / "active" for active event' })
  async getEventById(@Param('id') id: string, @CurrentUser() user?: CurrentUserDto) {
    return this.eventsService.getEventById(id, user?.id);
  }

  @Patch(':id')
  @ResponseMessage('Event details updated successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Update event metadata',
    description: 'Updates details such as title, description, venue, capacity, or dates.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiBody({ type: UpdateIndividualEventDto })
  async updateEvent(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: UpdateIndividualEventDto,
  ) {
    return this.eventsService.updateEvent(id, user?.id, dto);
  }

  @Patch(':id/setup-step')
  @ResponseMessage('Setup step updated successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Update wizard checklist step progress',
    description: 'Marks one of the 6 event setup steps as completed or in progress.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiBody({ type: UpdateSetupStepDto })
  async updateSetupStep(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: UpdateSetupStepDto,
  ) {
    return this.eventsService.updateSetupStep(id, user?.id, dto);
  }

  @Post(':id/publish')
  @ResponseMessage('Event published and activated successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Activate / Publish event',
    description: 'Transitions event status from DRAFT to LIVE on the turnstile check-in network.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  async publishEvent(@Param('id') id: string, @CurrentUser() user?: CurrentUserDto) {
    return this.eventsService.publishOrActivateEvent(id, user?.id);
  }

  @Delete(':id')
  @ResponseMessage('Event deleted successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Delete event',
    description: 'Removes an event and its associated local configurations.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  async deleteEvent(@Param('id') id: string, @CurrentUser() user?: CurrentUserDto) {
    return this.eventsService.deleteEvent(id, user?.id);
  }

  // ---------------------------------------------------------------------------
  // GUEST ROSTER & RSVP MANAGEMENT
  // ---------------------------------------------------------------------------

  @Get(':id/guests')
  @ResponseMessage('Guest roster retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Retrieve guest roster with filters',
    description:
      'Fetches full attendee list with VIP/General tiers, check-in status, RSVP status, party size, and seating assignments.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiQuery({ name: 'search', required: false, description: 'Filter by guest name, email, or phone' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by check-in status (checked-in, not arrived, etc.)' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by guest type (VIP, General, etc.)' })
  async getEventGuests(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.eventsService.getEventGuests(id, { search, status, type });
  }

  @Post(':id/guests')
  @ResponseMessage('Guest added successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Add a single guest to event roster',
    description: 'Generates secure cryptographic QR code and registers guest with group & preferences.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiBody({ type: AddIndividualGuestDto })
  async addGuest(
    @Param('id') id: string,
    @Body() dto: AddIndividualGuestDto,
  ) {
    return this.eventsService.addGuest(id, dto);
  }

  @Post(':id/guests/bulk')
  @ResponseMessage('Bulk guests imported successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Bulk import guests from spreadsheet / CSV',
    description: 'Imports multiple guest entries simultaneously into the event roster.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiBody({ type: BulkAddIndividualGuestsDto })
  async bulkAddGuests(
    @Param('id') id: string,
    @Body() dto: BulkAddIndividualGuestsDto,
  ) {
    return this.eventsService.bulkAddGuests(id, dto);
  }

  @Patch(':id/guests/:guestId')
  @ResponseMessage('Guest details updated successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Update guest details',
    description: 'Updates guest name, phone, RSVP status, check-in status, or seating preferences.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiParam({ name: 'guestId', description: 'Guest / Attendee UUID' })
  @ApiBody({ type: UpdateIndividualGuestDto })
  async updateGuest(
    @Param('id') id: string,
    @Param('guestId') guestId: string,
    @Body() dto: UpdateIndividualGuestDto,
  ) {
    return this.eventsService.updateGuest(id, guestId, dto);
  }

  @Delete(':id/guests/:guestId')
  @ResponseMessage('Guest removed successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Remove guest from roster',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiParam({ name: 'guestId', description: 'Guest / Attendee UUID' })
  async deleteGuest(
    @Param('id') id: string,
    @Param('guestId') guestId: string,
  ) {
    return this.eventsService.deleteGuest(id, guestId);
  }

  @Post(':id/guests/invitations')
  @ResponseMessage('Invitations dispatched')
  @ApiOperation({
    summary: '[Individual Organizer] Send invitations to every guest who has not been invited',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  async sendAllInvites(@Param('id') id: string) {
    return this.eventsService.sendAllInvites(id);
  }

  @Post(':id/guests/:guestId/invite')
  @ResponseMessage('Guest invitation dispatched successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Send / Re-send invitation',
    description: 'Dispatches digital pass with QR code via WhatsApp, Email, or SMS.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiParam({ name: 'guestId', description: 'Guest / Attendee UUID' })
  @ApiBody({ type: InviteGuestDto, required: false })
  async sendGuestInvite(
    @Param('id') id: string,
    @Param('guestId') guestId: string,
    @Body() dto?: InviteGuestDto,
  ) {
    return this.eventsService.sendGuestInvite(id, guestId, dto);
  }

  @Post(':id/guests/:guestId/reminder')
  @ResponseMessage('Guest reminder dispatched successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Send event reminder to guest',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiParam({ name: 'guestId', description: 'Guest / Attendee UUID' })
  async sendGuestReminder(
    @Param('id') id: string,
    @Param('guestId') guestId: string,
  ) {
    return this.eventsService.sendGuestReminder(id, guestId);
  }

  // ---------------------------------------------------------------------------
  // SEATING PROTOCOL & TABLE ASSIGNMENTS
  // ---------------------------------------------------------------------------

  @Post(':id/seating')
  @ResponseMessage('Seating table created successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Add a table or seating zone',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiBody({ type: CreateSeatingDto })
  async createEventSeating(@Param('id') id: string, @Body() dto: CreateSeatingDto) {
    return this.eventsService.createEventSeating(id, dto);
  }

  @Patch(':id/seating/:zoneId')
  @ResponseMessage('Seating table updated successfully')
  @ApiOperation({ summary: '[Individual Organizer] Update a table' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiParam({ name: 'zoneId', description: 'Table zone UUID' })
  @ApiBody({ type: CreateSeatingDto })
  async updateEventSeating(
    @Param('id') id: string,
    @Param('zoneId') zoneId: string,
    @Body() dto: CreateSeatingDto,
  ) {
    return this.eventsService.updateEventSeating(id, zoneId, dto);
  }

  @Delete(':id/seating/:zoneId')
  @ResponseMessage('Seating table removed successfully')
  @ApiOperation({ summary: '[Individual Organizer] Remove a table' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiParam({ name: 'zoneId', description: 'Table zone UUID' })
  async deleteEventSeating(@Param('id') id: string, @Param('zoneId') zoneId: string) {
    return this.eventsService.deleteEventSeating(id, zoneId);
  }

  @Get(':id/seating')
  @ResponseMessage('Seating blueprint retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Retrieve table zones and seating blueprint',
    description: 'Fetches table zones (VVIP, Ambassador), occupied seats, and unassigned guest list.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  async getEventSeating(@Param('id') id: string) {
    return this.eventsService.getEventSeating(id);
  }

  @Post(':id/seating/assign')
  @ResponseMessage('Guest seat assigned successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Assign guest to table and seat',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiBody({ type: AssignGuestSeatingDto })
  async assignGuestSeating(
    @Param('id') id: string,
    @Body() dto: AssignGuestSeatingDto,
  ) {
    return this.eventsService.assignGuestSeating(id, dto);
  }

  // ---------------------------------------------------------------------------
  // LIVE TURNSTILE MONITOR & SECURITY TELEMETRY
  // ---------------------------------------------------------------------------

  @Get(':id/check-in')
  @ResponseMessage('Live check-in monitor telemetry retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Live Turnstile Check-In Stream & Telemetry',
    description:
      'Provides live scan activity stream, flagged exceptions queue, active gate staff, and check-in velocity.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  async getEventCheckInMonitor(@Param('id') id: string) {
    return this.eventsService.getEventCheckInMonitor(id);
  }

  @Post(':id/check-in/resolve-flag')
  @ResponseMessage('Check-in exception flag resolved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Resolve a flagged turnstile exception',
    description: 'Allows host to execute "trust_staff" admission override or manual resolution.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiBody({ type: ResolveFlagDto })
  async resolveCheckInFlag(
    @Param('id') id: string,
    @Body() dto: ResolveFlagDto,
  ) {
    return this.eventsService.resolveCheckInFlag(id, dto);
  }

  @Post(':id/check-in/assign-all-gates')
  @ResponseMessage('All gate staff assigned successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Assign all available gate staff to turnstiles',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  async assignAllGateStaff(@Param('id') id: string) {
    return this.eventsService.assignAllGateStaff(id);
  }
}
