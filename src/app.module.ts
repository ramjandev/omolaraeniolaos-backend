import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { GateModule } from './modules/gate/gate.module';
import { AgencyModule } from './modules/agency/agency.module';
import { IndividualModule } from './modules/individual/individual.module';
import { VenueModule } from './modules/venue/venue.module';
import { AdminModule } from './modules/admin/admin.module';
import { VoiceRsvpModule } from './modules/voice-rsvp/voice-rsvp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    EventsModule,
    TicketsModule,
    OrdersModule,
    PaymentsModule,
    GateModule,
    AgencyModule,
    IndividualModule,
    VenueModule,
    AdminModule,
    VoiceRsvpModule,
  ],
})
export class AppModule {}
