import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController, AdminOrganizersController } from './admin.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminRevenuePlansController } from './admin-revenue.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminUsersController } from './admin-users.controller';

@Module({
  controllers: [
    AdminDashboardController,
    AdminOrganizersController,
    AdminRevenuePlansController,
    AdminAnalyticsController,
    AdminSettingsController,
    AdminPlansController,
    AdminUsersController,
    AdminController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
