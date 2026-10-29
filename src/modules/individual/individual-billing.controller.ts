import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { IndividualBillingService } from './individual-billing.service';

@ApiTags('02 Individual Organizer / Billing')
@Controller(['individual/billing', 'organizer/individual/billing'])
@UseGuards(OptionalJwtAuthGuard, RolesGuard)
@Roles(UserRole.INDIVIDUAL, UserRole.AGENCY, UserRole.VENUE)
@ApiBearerAuth()
export class IndividualBillingController {
  constructor(
    @Inject(IndividualBillingService)
    private readonly billingService: IndividualBillingService,
  ) {}

  @Get()
  @ResponseMessage('Individual billing retrieved successfully')
  @ApiOperation({
    summary: '[Individual Organizer] Current plan, account, and billing history',
  })
  getBilling(@CurrentUser() user?: CurrentUserDto) {
    return this.billingService.getBilling(user?.id);
  }
}
