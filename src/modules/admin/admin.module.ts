import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController, AdminOrganizersController } from './admin.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminPlansController } from './admin-plans.controller';

@Module({
  controllers: [
    AdminDashboardController,
    AdminOrganizersController,
    AdminPlansController,
    AdminController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
