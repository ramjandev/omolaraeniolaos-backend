import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const FALLBACK_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://omo_database_user:14fhFsgToH05ZqcpqcKpIehCpEIsdLRD@dpg-db2u18vavr4c7393qjo0-a.ohio-postgres.render.com/omo_database?sslmode=require';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || FALLBACK_DATABASE_URL,
        },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL database successfully.');
      await this.seedInitialUsers();
    } catch (err: any) {
      this.logger.error(`Database connection issue: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {}
  }

  private async seedInitialUsers() {
    try {
      const adminExists = await this.user.findUnique({
        where: { email: 'admin@mceniesvite.com' },
      });

      if (!adminExists) {
        this.logger.log('Seeding initial demo ecosystem accounts...');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('SecurePassword123!', salt);

        const demoUsers = [
          {
            email: 'admin@mceniesvite.com',
            fullName: 'Super Administrator',
            role: UserRole.SUPER_ADMIN,
          },
          {
            email: 'organizer@mceniesvite.com',
            fullName: 'Omolara Eniola',
            role: UserRole.ORGANIZER_INDIVIDUAL,
          },
          {
            email: 'agency@mceniesvite.com',
            fullName: 'Zenith Agency Director',
            role: UserRole.ORGANIZER_AGENCY,
          },
          {
            email: 'venue@mceniesvite.com',
            fullName: 'Eko Grand Venue Manager',
            role: UserRole.ORGANIZER_VENUE,
          },
          {
            email: 'gate@mceniesvite.com',
            fullName: 'Gate Staff Lead',
            role: UserRole.GATE_STAFF,
          },
          {
            email: 'guest@mceniesvite.com',
            fullName: 'Demo Attendee Guest',
            role: UserRole.GUEST,
          },
        ];

        for (const u of demoUsers) {
          await this.user.upsert({
            where: { email: u.email },
            update: {},
            create: {
              email: u.email,
              passwordHash,
              fullName: u.fullName,
              role: u.role,
              profile: {
                create: {},
              },
            },
          });
        }
        this.logger.log('Initial demo accounts seeded successfully for all 6 roles.');
        await this.seedInitialEvents();
      } else {
        const eventsCount = await this.event.count();
        if (eventsCount === 0) {
          await this.seedInitialEvents();
        }
      }
    } catch (err: any) {
      this.logger.warn(`Auto-seeding skipped: ${err.message}`);
    }
  }

  private async seedInitialEvents() {
    try {
      const organizer = await this.user.findFirst({
        where: {
          role: {
            in: [
              UserRole.ORGANIZER_AGENCY,
              UserRole.ORGANIZER_INDIVIDUAL,
              UserRole.ORGANIZER_VENUE,
            ],
          },
        },
      });

      if (!organizer) return;

      this.logger.log('Seeding initial active platform events...');

      const sampleEvents = [
        {
          title: 'The Grand Royal Gala & Investiture',
          slug: `grand-royal-gala-${Date.now()}`,
          description: 'A prestigious royal celebration with dinner and red carpet.',
          category: 'Gala',
          status: 'LIVE' as any,
          startDate: new Date('2026-10-24T14:00:00Z'),
          endDate: new Date('2026-10-24T23:00:00Z'),
          venueName: 'The Monarch Event Centre',
          capacity: 600,
        },
        {
          title: 'Tech Fest Africa 2026',
          slug: `tech-fest-africa-${Date.now()}`,
          description: 'Pan-African tech gathering and innovation summit.',
          category: 'Conference',
          status: 'PUBLISHED' as any,
          startDate: new Date('2026-11-12T09:00:00Z'),
          endDate: new Date('2026-11-14T18:00:00Z'),
          venueName: 'Eko Convention Centre',
          capacity: 1500,
        },
        {
          title: 'Imperial Wedding Ceremony',
          slug: `imperial-wedding-${Date.now()}`,
          description: 'Celebration of love with families and distinguished dignitaries.',
          category: 'Wedding',
          status: 'LIVE' as any,
          startDate: new Date('2026-12-05T12:00:00Z'),
          endDate: new Date('2026-12-05T20:00:00Z'),
          venueName: 'Landmark Centre Hall 1',
          capacity: 450,
        },
      ];

      for (const ev of sampleEvents) {
        await this.event.create({
          data: {
            ...ev,
            organizerId: organizer.id,
          },
        });
      }
      this.logger.log('Initial events seeded successfully into PostgreSQL.');
    } catch (e: any) {
      this.logger.warn(`Event auto-seeding skipped: ${e.message}`);
    }
  }
}
