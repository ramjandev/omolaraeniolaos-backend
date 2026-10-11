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

@ApiTags('Venue Operations')
@Controller('venue')
export class VenueController {
  constructor(@Inject(VenueService) private readonly venueService: VenueService) {}

  @Get('spaces')
  @ResponseMessage('Venue spaces retrieved successfully')
  @ApiOperation({ summary: 'List venue halls and spaces with rental capacities and rates' })
  async getSpaces() {
    return this.venueService.getSpaces();
  }

  @Post('spaces')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER_VENUE, UserRole.SUPER_ADMIN)
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
  async getBookings() {
    return this.venueService.getBookings();
  }

  @Get('tables')
  @ResponseMessage('Venue table layouts retrieved successfully')
  @ApiOperation({ summary: 'List banquet table layout zones and floor plans' })
  async getTables() {
    return this.venueService.getTables();
  }
}
