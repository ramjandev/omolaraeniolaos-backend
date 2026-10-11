import { Module } from '@nestjs/common';
import { GateService } from './gate.service';
import { GateController } from './gate.controller';

@Module({
  controllers: [GateController],
  providers: [GateService],
  exports: [GateService],
})
export class GateModule {}
