import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { VenueService } from './venue.service';
import { CreateSpaceDto, UpdateSpaceDto } from './dto/create-space.dto';
import { SaveTableDto, SaveZoneDto } from './dto/seating.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('04 Venue Organizer / Workspace')
@Controller('venue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENUE)
@ApiBearerAuth()
export class VenueController {
  constructor(@Inject(VenueService) private readonly venueService: VenueService) {}

  @Get('dashboard')
  @ResponseMessage('Venue dashboard retrieved successfully')
  @ApiOperation({ summary: 'Venue spaces, bookings, availability, and performance from stored records' })
  async getDashboard(@CurrentUser() user: CurrentUserDto) {
    return this.venueService.getDashboard(user.id);
  }

  @Get('reports')
  @ResponseMessage('Venue reports retrieved successfully')
  @ApiOperation({ summary: 'Venue booking trends, utilization, and event breakdown' })
  async getReports(
    @CurrentUser() user: CurrentUserDto,
    @Query('range') range?: string,
    @Query('spaceId') spaceId?: string,
  ) {
    return this.venueService.getReports(user.id, { range, spaceId });
  }

  @Get('spaces')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Venue spaces retrieved successfully')
  @ApiOperation({ summary: 'List venue halls and spaces with rental capacities and rates' })
  async getSpaces(@CurrentUser() user: CurrentUserDto) {
    return this.venueService.getSpaces(user.id);
  }

  @Post('spaces')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENUE, UserRole.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Venue space created successfully')
  @ApiOperation({ summary: 'Create a new hall / space for lease' })
  @ApiBody({ type: CreateSpaceDto })
  @ApiResponse({ status: 201, description: 'Space created' })
  async createSpace(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateSpaceDto) {
    return this.venueService.createSpace(user.id, dto);
  }

  @Get('spaces/:id')
  @ResponseMessage('Venue space retrieved successfully')
  @ApiOperation({ summary: 'Venue space details, seating, and bookings' })
  async getSpace(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.venueService.getSpace(user.id, id);
  }

  @Patch('spaces/:id')
  @ResponseMessage('Venue space updated successfully')
  @ApiOperation({ summary: 'Update a venue space' })
  @ApiBody({ type: UpdateSpaceDto })
  async updateSpace(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateSpaceDto,
  ) {
    return this.venueService.updateSpace(user.id, id, dto);
  }

  @Get('bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Venue bookings retrieved successfully')
  @ApiOperation({ summary: 'List venue space reservations and booking calendar' })
  async getBookings(@CurrentUser() user: CurrentUserDto) {
    return this.venueService.getBookings(user.id);
  }

  @Get('tables')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Venue table layouts retrieved successfully')
  @ApiOperation({ summary: 'List banquet table layout zones and floor plans' })
  async getTables(@CurrentUser() user: CurrentUserDto, @Query('spaceId') spaceId?: string) {
    return this.venueService.getTables(user.id, spaceId);
  }

  @Post('tables/zones')
  @ResponseMessage('Seating zone created')
  @ApiBody({ type: SaveZoneDto })
  async createZone(@CurrentUser() user: CurrentUserDto, @Body() dto: SaveZoneDto) {
    return this.venueService.saveZone(user.id, dto);
  }

  @Patch('tables/zones/:id')
  @ResponseMessage('Seating zone updated')
  @ApiBody({ type: SaveZoneDto })
  async updateZone(@CurrentUser() user: CurrentUserDto, @Param('id') id: string, @Body() dto: SaveZoneDto) {
    return this.venueService.saveZone(user.id, dto, id);
  }

  @Delete('tables/zones/:id')
  @ResponseMessage('Seating zone deleted')
  async deleteZone(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.venueService.deleteZone(user.id, id);
  }

  @Post('tables/zones/:id/tables')
  @ResponseMessage('Table saved')
  @ApiBody({ type: SaveTableDto })
  async saveTable(@CurrentUser() user: CurrentUserDto, @Param('id') id: string, @Body() dto: SaveTableDto) {
    return this.venueService.saveTable(user.id, id, dto);
  }

  @Delete('tables/zones/:zoneId/tables/:tableId')
  @ResponseMessage('Table deleted')
  async deleteTable(
    @CurrentUser() user: CurrentUserDto,
    @Param('zoneId') zoneId: string,
    @Param('tableId') tableId: string,
  ) {
    return this.venueService.deleteTable(user.id, zoneId, tableId);
  }
}
