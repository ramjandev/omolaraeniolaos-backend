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
      }
    } catch (err: any) {
      this.logger.warn(`Auto-seeding skipped: ${err.message}`);
    }
  }
}
