import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminPlansController } from './admin-plans.controller';

@Module({
  controllers: [AdminController, AdminPlansController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
