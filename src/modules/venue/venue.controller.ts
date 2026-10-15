import { Controller, Get, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { VenueService } from './venue.service';
import { CreateSpaceDto } from './dto/create-space.dto';
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
  async getTables(@CurrentUser() user: CurrentUserDto) {
    return this.venueService.getTables(user.id);
  }
}
