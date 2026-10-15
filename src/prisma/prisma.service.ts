import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const DEFAULT_ADMIN_EMAIL = 'admin@mceniesvite.com';
const DEFAULT_ADMIN_PASSWORD = 'Password123!';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL database successfully.');
      await this.ensureDefaultAdmin();
    } catch (err: any) {
      this.logger.error(`Database connection issue: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {}
  }

  /** Creates the platform admin once. Never overwrites an existing account. */
  private async ensureDefaultAdmin() {
    const email = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

    try {
      const existing = await this.user.findUnique({ where: { email } });
      if (existing) return;

      const passwordHash = await bcrypt.hash(password, 10);
      await this.user.create({
        data: {
          email,
          passwordHash,
          fullName: process.env.ADMIN_NAME || 'Platform Admin',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          profile: { create: {} },
        },
      });
      this.logger.log(`Default admin created: ${email}`);
    } catch (err: any) {
      this.logger.warn(`Default admin bootstrap skipped: ${err.message}`);
    }
  }
}
