import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IndividualDashboardController } from './individual-dashboard.controller';
import { IndividualDashboardService } from './individual-dashboard.service';
import { IndividualGateController } from './individual-gate.controller';
import { IndividualGateService } from './individual-gate.service';
import { IndividualEventsController } from './individual-events.controller';
import { IndividualEventsService } from './individual-events.service';
import { IndividualBillingController } from './individual-billing.controller';
import { IndividualBillingService } from './individual-billing.service';
import { CommunicationsModule } from '../communications/communications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, CommunicationsModule, AuthModule],
  controllers: [
    IndividualDashboardController,
    IndividualGateController,
    IndividualEventsController,
    IndividualBillingController,
  ],
  providers: [
    IndividualDashboardService,
    IndividualGateService,
    IndividualEventsService,
    IndividualBillingService,
  ],
  exports: [
    IndividualDashboardService,
    IndividualGateService,
    IndividualEventsService,
  ],
})
export class IndividualModule {}
