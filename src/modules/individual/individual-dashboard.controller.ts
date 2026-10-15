import {
  Controller,
  Get,
  UseGuards,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IndividualDashboardService } from './individual-dashboard.service';
import {
  IndividualDashboardResponseDto,
  IndividualMetricsDto,
} from './dto/individual-dashboard.dto';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('02 Individual Organizer / Dashboard')
@Controller(['individual/dashboard', 'organizer/individual/dashboard'])
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class IndividualDashboardController {
  constructor(
    @Inject(IndividualDashboardService)
    private readonly dashboardService: IndividualDashboardService,
  ) {}

  @Get()
  @ResponseMessage('Individual organizer dashboard retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Retrieve relational dashboard data (user, active event, relational checklist, metrics, recent attendees/orders)',
    description: 'Returns relational database records from PostgreSQL/Prisma without static frontend navigation links or mock text.',
  })
  @ApiResponse({
    status: 200,
    description: 'Relational individual dashboard data returned successfully',
    type: IndividualDashboardResponseDto,
  })
  async getDashboardOverview(@CurrentUser() user?: CurrentUserDto) {
    return this.dashboardService.getDashboardOverview(user?.id);
  }

  @Get('metrics')
  @ResponseMessage('Individual organizer metrics retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Retrieve relational event and attendee metrics',
    description: 'Aggregates counts and sums from Prisma Event, Attendee, and Order tables for this individual organizer.',
  })
  @ApiResponse({
    status: 200,
    description: 'Relational metrics returned successfully',
    type: IndividualMetricsDto,
  })
  async getMetrics(@CurrentUser() user?: CurrentUserDto) {
    return this.dashboardService.getMetrics(user?.id);
  }

  @Get('events')
  @ResponseMessage('Individual organizer events retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] List relational events created by this organizer',
    description: 'Queries Prisma Event table with ticket tiers, table zones, and attendee count relations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Relational events list returned successfully',
  })
  async getEvents(@CurrentUser() user?: CurrentUserDto) {
    return this.dashboardService.getEvents(user?.id);
  }

  @Get('attendees')
  @ResponseMessage('Individual organizer attendees retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] List relational attendees across organizer events',
    description: 'Queries Prisma Attendee table with event and ticket tier relations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Relational attendees list returned successfully',
  })
  async getAttendees(@CurrentUser() user?: CurrentUserDto) {
    return this.dashboardService.getAttendees(user?.id);
  }
}
