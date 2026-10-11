import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController, AdminOrganizersController } from './admin.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminRevenuePlansController } from './admin-revenue.controller';

@Module({
  controllers: [
    AdminDashboardController,
    AdminOrganizersController,
    AdminRevenuePlansController,
    AdminController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
