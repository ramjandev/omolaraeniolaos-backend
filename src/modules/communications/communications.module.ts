import { Module } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import {
  CommunicationsController,
  GuestRsvpController,
  WhatsAppWebhookController,
} from './communications.controller';

@Module({
  controllers: [
    CommunicationsController,
    GuestRsvpController,
    WhatsAppWebhookController,
  ],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
