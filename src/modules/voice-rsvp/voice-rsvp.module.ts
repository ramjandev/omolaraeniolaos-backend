import { Module } from '@nestjs/common';
import { VoiceRsvpService } from './voice-rsvp.service';
import { VoiceRsvpController } from './voice-rsvp.controller';

@Module({
  controllers: [VoiceRsvpController],
  providers: [VoiceRsvpService],
  exports: [VoiceRsvpService],
})
export class VoiceRsvpModule {}
