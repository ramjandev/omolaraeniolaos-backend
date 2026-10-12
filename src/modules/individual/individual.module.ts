import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IndividualDashboardController } from './individual-dashboard.controller';
import { IndividualDashboardService } from './individual-dashboard.service';
import { IndividualGateController } from './individual-gate.controller';
import { IndividualGateService } from './individual-gate.service';
import { IndividualEventsController } from './individual-events.controller';
import { IndividualEventsService } from './individual-events.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    IndividualDashboardController,
    IndividualGateController,
    IndividualEventsController,
  ],
  providers: [
    IndividualDashboardService,
    IndividualGateService,
    IndividualEventsService,
  ],
  exports: [
    IndividualDashboardService,
    IndividualGateService,
    IndividualEventsService,
  ],
})
export class IndividualModule {}
