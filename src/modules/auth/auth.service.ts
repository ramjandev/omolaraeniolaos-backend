import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole, EventStatus, EventFormat, SpaceType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto, TokenResponseDto } from './dto/auth-response.dto';
import { RegisterOrganizerIndividualDto } from './dto/register-organizer-individual.dto';
import { RegisterOrganizerAgencyDto } from './dto/register-organizer-agency.dto';
import { RegisterOrganizerVenueDto } from './dto/register-organizer-venue.dto';
import { PayPlanDto } from './dto/pay-plan.dto';

export interface ResolvedPlan {
  id: string;
  name: string;
  price: number;
  cycle: string;
  organizerType: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JwtService) private jwtService: JwtService,
    @Optional() @Inject(ConfigService) private configService?: ConfigService,
    @Optional() @Inject(MailService) private mailService?: MailService,
  ) {
    this.accessSecret =
      this.configService?.get<string>('JWT_ACCESS_SECRET') ||
      process.env.JWT_ACCESS_SECRET ||
      'book-secret-access-key';
    this.refreshSecret =
      this.configService?.get<string>('JWT_REFRESH_SECRET') ||
      process.env.JWT_REFRESH_SECRET ||
      'book-secret-refresh-key';
    this.accessExpiresIn =
      this.configService?.get<string>('JWT_ACCESS_EXPIRES_IN') ||
      process.env.JWT_ACCESS_EXPIRES_IN ||
      '15m';
    this.refreshExpiresIn =
      this.configService?.get<string>('JWT_REFRESH_EXPIRES_IN') ||
      process.env.JWT_REFRESH_EXPIRES_IN ||
      '7d';
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role,
        profile: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw new UnauthorizedException('Your account has been deactivated or suspended');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<TokenResponseDto> {
    try {
      const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.refreshSecret,
      });

      if (!payload || !payload.sub) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, status: true },
      });

      if (!user || user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
        throw new UnauthorizedException('Account not found or inactive');
      }

      return this.generateTokens(user.id, user.email, user.role);
    } catch (err) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ sent: boolean }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const resetToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          type: 'PASSWORD_RESET',
        },
        {
          secret: this.accessSecret,
          expiresIn: '1h',
        },
      );

      if (this.mailService) {
        await this.mailService.sendPasswordResetEmail(user.email, resetToken, user.fullName);
      }
    }

    // Always return success message to protect against user enumeration
    return { sent: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ reset: boolean }> {
    try {
      const payload = await this.jwtService.verifyAsync(dto.token, {
        secret: this.accessSecret,
      });

      if (!payload || payload.type !== 'PASSWORD_RESET' || !payload.sub) {
        throw new BadRequestException('Invalid or expired password reset token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new BadRequestException('Account not found');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(dto.newPassword, salt);

      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      return { reset: true };
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException('Password reset token has expired or is invalid');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        agencyProfile: true,
        venueProfile: true,
        staffProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { passwordHash, ...safeUser } = user;
    const planSetting = await this.prisma.platformSetting.findUnique({
      where: { key: `PLAN_USER_${userId}` },
    });
    let plan: {
      planId: string | null;
      planName: string | null;
      isPaid: boolean;
      status: string | null;
    } | null = null;
    if (planSetting?.value) {
      try {
        const parsed = JSON.parse(planSetting.value) as {
          planId?: string;
          planName?: string;
          isPaid?: boolean;
          status?: string;
        };
        plan = {
          planId: parsed.planId ?? null,
          planName: parsed.planName ?? null,
          isPaid: parsed.isPaid === true || parsed.status === 'ACTIVE',
          status: parsed.status ?? null,
        };
      } catch {
        plan = null;
      }
    }
    return { ...safeUser, plan };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<TokenResponseDto> {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  /** Looks up an active plan by cuid or slug. Returns null when no such plan exists. */
  async resolvePlan(planId?: string): Promise<ResolvedPlan | null> {
    if (!planId) return null;
    const plan = await this.prisma.plan.findFirst({
      where: { OR: [{ id: planId }, { slug: planId }], isArchived: false },
    });
    if (!plan) return null;
    return {
      id: plan.id,
      name: plan.planName,
      price: plan.price,
      cycle: plan.billingCycle,
      organizerType: plan.organizerType,
    };
  }

  /** Annual billing charges 12 months at a 20% discount. */
  private applyBillingCycle(plan: ResolvedPlan | null, billingCycle?: string): ResolvedPlan | null {
    if (!plan) return null;
    const isAnnual = billingCycle?.toLowerCase() === 'annual';
    return {
      ...plan,
      price: isAnnual && plan.price > 0 ? Math.round(plan.price * 12 * 0.8) : plan.price,
      cycle: isAnnual ? 'ANNUAL' : plan.cycle,
    };
  }

  /** Appends a plan charge so the individual billing page can list past invoices. */
  private async recordBillingHistory(
    userId: string,
    entry: {
      planId: string;
      description: string;
      amount: number;
      status: 'Paid' | 'Pending' | 'Failed';
      paymentMethod?: string;
      txRef?: string;
    },
  ) {
    const key = `BILLING_HISTORY_${userId}`;
    const existing = await this.prisma.platformSetting.findUnique({ where: { key } });
    let history: Array<Record<string, unknown>> = [];
    if (existing?.value) {
      try {
        const parsed = JSON.parse(existing.value);
        if (Array.isArray(parsed)) history = parsed;
      } catch {
        history = [];
      }
    }

    const now = new Date();
    history.unshift({
      id: `bill_${now.getTime()}`,
      date: now.toISOString(),
      description: entry.description,
      amount: entry.amount,
      currency: 'NGN',
      status: entry.status,
      invoiceNumber: `INV-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`,
      paymentMethod: entry.paymentMethod || 'CARD',
      planId: entry.planId,
      txRef: entry.txRef || null,
    });

    const value = JSON.stringify(history.slice(0, 50));
    await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value },
      create: {
        key,
        value,
        description: `Billing history for user ${userId}`,
      },
    });
  }

  /**
   * Flutterwave confirms the charge. No admin review is required.
   * Pending invoices that match a successful transaction become Paid.
   */
  async reconcilePlanPayments(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) return;

    const key = `BILLING_HISTORY_${userId}`;
    const existing = await this.prisma.platformSetting.findUnique({ where: { key } });
    let history: Array<Record<string, unknown>> = [];
    if (existing?.value) {
      try {
        const parsed = JSON.parse(existing.value);
        if (Array.isArray(parsed)) history = parsed;
      } catch {
        history = [];
      }
    }
    if (!history.some((item) => item.status === 'Pending')) return;

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) return;

    let transactions: Array<Record<string, unknown>> = [];
    try {
      const url = 'https://api.flutterwave.com/v3/transactions?status=successful';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
      if (res.ok && Array.isArray(body.data)) transactions = body.data;
    } catch (err: any) {
      this.logger.error(`Could not confirm Flutterwave plan payments: ${err.message}`);
      return;
    }

    const prefix = `SUB-${userId.slice(0, 8)}-`;
    const matches = transactions.filter((tx) => {
      if (String(tx.status || '').toLowerCase() !== 'successful') return false;
      const meta = this.readChargeMeta(tx.meta);
      const txRef = typeof tx.tx_ref === 'string' ? tx.tx_ref : '';
      return (
        meta.type === 'ORGANIZER_PLAN_SUBSCRIPTION' ||
        meta.userId === userId ||
        txRef.startsWith(prefix)
      );
    });

    const used = new Set<number>();
    let latest: { planId: string; amount: number } | null = null;
    for (const tx of matches) {
      const meta = this.readChargeMeta(tx.meta);
      const txRef = typeof tx.tx_ref === 'string' ? tx.tx_ref : '';
      const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount);
      let index = history.findIndex(
        (item, itemIndex) => !used.has(itemIndex) && txRef && item.txRef === txRef,
      );
      if (index < 0) {
        index = history.findIndex((item, itemIndex) => {
          if (used.has(itemIndex) || item.status !== 'Pending') return false;
          const samePlan = meta.planId && item.planId === meta.planId;
          const sameAmount = Number(item.amount) === amount;
          return samePlan || sameAmount;
        });
      }
      if (index < 0) continue;
      used.add(index);
      history[index] = {
        ...history[index],
        status: 'Paid',
        txRef: txRef || history[index].txRef || null,
        paidAt: typeof tx.created_at === 'string' ? tx.created_at : new Date().toISOString(),
      };
      const planId = meta.planId || (typeof history[index].planId === 'string' ? history[index].planId : '');
      if (planId) latest = { planId, amount: Number.isFinite(amount) ? amount : Number(history[index].amount) };
    }

    if (used.size === 0) return;

    await this.prisma.platformSetting.update({
      where: { key },
      data: { value: JSON.stringify(history) },
    });

    if (latest?.planId) {
      await this.activatePaidPlan(userId, latest.planId, latest.amount);
    }
  }

  private readChargeMeta(meta: unknown): { userId?: string; planId?: string; type?: string } {
    if (!meta) return {};
    if (typeof meta === 'string') {
      try {
        return this.readChargeMeta(JSON.parse(meta));
      } catch {
        return {};
      }
    }
    if (typeof meta !== 'object') return {};
    const row = meta as { userId?: string; planId?: string; type?: string };
    return { userId: row.userId, planId: row.planId, type: row.type };
  }

  private async activatePaidPlan(userId: string, planId: string, amount: number) {
    const plan = await this.resolvePlan(planId);
    const value = JSON.stringify({
      planId: plan?.id ?? planId,
      planName: plan?.name ?? null,
      price: amount,
      cycle: plan?.cycle ?? null,
      isPaid: true,
      status: 'ACTIVE',
      paymentMethod: 'CARD',
      selectedAt: new Date().toISOString(),
    });
    await this.prisma.platformSetting.upsert({
      where: { key: `PLAN_USER_${userId}` },
      update: { value },
      create: {
        key: `PLAN_USER_${userId}`,
        value,
        description: `Plan assigned to user ${userId}`,
      },
    });
  }

  /** Stores the plan chosen at signup and starts checkout when payment is due. */
  private async assignRegistrationPlan(
    user: { id: string; email: string; fullName: string; phone?: string | null },
    plan: ResolvedPlan | null,
    options: { skipPayment?: boolean; paymentMethod?: string; label: string },
  ) {
    if (!plan) {
      return { selectedPlan: null, checkoutResult: null };
    }

    const isFree = plan.price === 0;
    const isSkipped = options.skipPayment === true;
    const checkoutResult =
      !isFree && !isSkipped ? await this.generatePlanCheckoutUrl(user, plan) : null;

    const planStatus = isFree
      ? 'ACTIVE'
      : isSkipped
        ? 'PAYMENT_PENDING'
        : 'CHECKOUT_INITIALIZED';

    const value = JSON.stringify({
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      cycle: plan.cycle,
      isPaid: isFree,
      status: planStatus,
      paymentMethod: options.paymentMethod || (isFree ? 'FREE' : 'CARD'),
      selectedAt: new Date().toISOString(),
    });

    await this.prisma.platformSetting.upsert({
      where: { key: `PLAN_USER_${user.id}` },
      update: { value },
      create: {
        key: `PLAN_USER_${user.id}`,
        value,
        description: `Plan assigned to ${options.label} user ${user.id}`,
      },
    });

    await this.recordBillingHistory(user.id, {
      planId: plan.id,
      description: plan.name,
      amount: plan.price,
      status: isFree ? 'Paid' : 'Pending',
      paymentMethod: options.paymentMethod || (isFree ? 'FREE' : 'CARD'),
    });

    return {
      selectedPlan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        cycle: plan.cycle,
        isPaid: isFree,
        status: planStatus,
      },
      checkoutResult,
    };
  }

  async generatePlanCheckoutUrl(
    user: { id: string; email: string; fullName: string; phone?: string | null },
    plan: { id: string; name: string; price: number },
    redirectUrl?: string,
  ) {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey || plan.price <= 0) return null;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const txRef = `SUB-${user.id.slice(0, 8)}-${Date.now()}`;

    try {
      const res = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: txRef,
          amount: plan.price,
          currency: 'NGN',
          redirect_url:
            redirectUrl || `${frontendUrl}/dashboard?payment_success=true&plan=${plan.id}`,
          customer: {
            email: user.email,
            name: user.fullName,
            phonenumber: user.phone || '',
          },
          customizations: {
            title: `McEnies Vite - ${plan.name}`,
            description: `Subscription/Pass payment for ${plan.name}`,
          },
          meta: {
            userId: user.id,
            planId: plan.id,
            type: 'ORGANIZER_PLAN_SUBSCRIPTION',
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success' && data.data?.link) {
        return {
          checkoutUrl: data.data.link,
          txRef,
        };
      }
    } catch (err: any) {
      this.logger.error(`Failed to generate Flutterwave checkout link: ${err.message}`);
    }

    return null;
  }

  /**
   * 1. Multi-Step Registration: Individual Organizer
   * Handles Steps 1-5: User Account, Initial Event Setup, Plan Selection, and Activation/Payment
   */
  async registerIndividual(dto: RegisterOrganizerIndividualDto) {
    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Confirm password does not match password');
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const plan = await this.resolvePlan(dto.planId);

    // Parse event date, start time, and optional end time
    const baseDate = new Date(dto.eventDate);
    const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;

    const parseTime = (timeStr?: string) => {
      if (!timeStr) return null;
      const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (!match) return null;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      return { hours, minutes };
    };

    const startDate = new Date(validBase);
    const startParsed = parseTime(dto.startTime);
    if (startParsed) {
      startDate.setHours(startParsed.hours, startParsed.minutes, 0, 0);
    } else {
      startDate.setHours(14, 0, 0, 0);
    }

    const endDate = new Date(validBase);
    const endParsed = parseTime(dto.endTime);
    if (endParsed) {
      endDate.setHours(endParsed.hours, endParsed.minutes, 0, 0);
      if (endDate <= startDate) {
        endDate.setDate(endDate.getDate() + 1);
      }
    } else {
      endDate.setTime(startDate.getTime() + 4 * 60 * 60 * 1000); // Default 4 hours duration
    }

    // Generate unique slug for the event
    const cleanSlugBase = (dto.eventName || 'event')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `${cleanSlugBase || 'event'}-${Date.now().toString(36)}`;

    const guestCapacity = Number(dto.expectedGuests) || 150;

    // Create user and initial event atomically
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.INDIVIDUAL,
        profile: {
          create: {
            bio: `Organizer of ${dto.eventName}`,
            company: dto.venueLocation,
          },
        },
        eventsCreated: {
          create: {
            title: dto.eventName,
            slug,
            description: `${dto.eventType} hosted by ${dto.fullName}`,
            category: dto.eventType,
            format: EventFormat.IN_PERSON,
            status: EventStatus.PUBLISHED,
            startDate,
            endDate,
            timezone: 'Africa/Lagos',
            venueName: dto.venueLocation,
            address: dto.venueLocation,
            capacity: guestCapacity,
            currency: 'NGN',
            ticketTiers: {
              create: [
                {
                  name: 'General Guest Pass',
                  capacity: guestCapacity,
                  price: 0,
                  currency: 'NGN',
                },
              ],
            },
          },
        },
      },
      include: {
        profile: true,
        eventsCreated: {
          include: {
            ticketTiers: true,
          },
        },
      },
    });

    const createdEvent = user.eventsCreated[0];
    const { selectedPlan, checkoutResult } = await this.assignRegistrationPlan(user, plan, {
      skipPayment: dto.skipPayment,
      paymentMethod: dto.paymentMethod,
      label: 'individual',
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
      },
      event: {
        id: createdEvent.id,
        title: createdEvent.title,
        slug: createdEvent.slug,
        category: createdEvent.category,
        startDate: createdEvent.startDate,
        endDate: createdEvent.endDate,
        venueName: createdEvent.venueName,
        capacity: createdEvent.capacity,
        status: createdEvent.status,
      },
      selectedPlan,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      checkoutUrl: checkoutResult?.checkoutUrl || null,
      txRef: checkoutResult?.txRef || null,
    };
  }

  /**
   * 2. Multi-Step Registration: Agency Organizer
   * Handles Steps 1-5: Lead User Account, Agency Workspace Profile, Work Scope & Templates,
   * Team Member Invitations, Plan Selection, and Checkout / Dashboard skip.
   */
  async registerAgency(dto: RegisterOrganizerAgencyDto) {
    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Confirm password does not match password');
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const planToCharge = this.applyBillingCycle(
      await this.resolvePlan(dto.planId),
      dto.billingCycle,
    );

    const headquarters = [dto.city, dto.country || 'Nigeria']
      .filter(Boolean)
      .join(', ');

    // Atomically create User, AgencyProfile, and UserProfile
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.AGENCY,
        agencyProfile: {
          create: {
            agencyName: dto.agencyName,
            billingEmail: email,
            headquarters: headquarters || undefined,
            website: dto.logoUrl || undefined,
            standardCommission: 15.0,
          },
        },
        profile: {
          create: {
            company: dto.agencyName,
            jobTitle: dto.agencyType,
            bio: `Agency specializing in ${(dto.eventTypes || []).join(', ') || 'Event Planning'}`,
          },
        },
      },
      include: {
        agencyProfile: true,
        profile: true,
      },
    });

    const agencyProfile = user.agencyProfile!;

    // Save full agency workspace configuration (event types, volume, team size)
    await this.prisma.platformSetting.upsert({
      where: { key: `AGENCY_CONFIG_${agencyProfile.id}` },
      update: {
        value: JSON.stringify({
          agencyName: dto.agencyName,
          agencyType: dto.agencyType,
          logoUrl: dto.logoUrl || null,
          country: dto.country || 'Nigeria',
          city: dto.city || null,
          eventTypes: dto.eventTypes || [],
          eventsPerYear: dto.eventsPerYear || null,
          teamSize: dto.teamSize || null,
          billingCycle: dto.billingCycle || 'monthly',
          updatedAt: new Date().toISOString(),
        }),
      },
      create: {
        key: `AGENCY_CONFIG_${agencyProfile.id}`,
        value: JSON.stringify({
          agencyName: dto.agencyName,
          agencyType: dto.agencyType,
          logoUrl: dto.logoUrl || null,
          country: dto.country || 'Nigeria',
          city: dto.city || null,
          eventTypes: dto.eventTypes || [],
          eventsPerYear: dto.eventsPerYear || null,
          teamSize: dto.teamSize || null,
          billingCycle: dto.billingCycle || 'monthly',
          createdAt: new Date().toISOString(),
        }),
        description: `Workspace metadata for agency ${dto.agencyName}`,
      },
    });

    // Save pending team invitations from Step 3
    if (dto.invitedMembers && dto.invitedMembers.length > 0) {
      await this.prisma.platformSetting.upsert({
        where: { key: `AGENCY_INVITATIONS_${agencyProfile.id}` },
        update: {
          value: JSON.stringify(dto.invitedMembers),
        },
        create: {
          key: `AGENCY_INVITATIONS_${agencyProfile.id}`,
          value: JSON.stringify(dto.invitedMembers),
          description: `Pending team invitations for ${dto.agencyName}`,
        },
      });
    }

    const { selectedPlan, checkoutResult } = await this.assignRegistrationPlan(user, planToCharge, {
      skipPayment: dto.skipPayment,
      paymentMethod: dto.paymentMethod,
      label: 'agency',
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        agencyProfile: user.agencyProfile,
        profile: user.profile,
      },
      agency: {
        id: agencyProfile.id,
        name: dto.agencyName,
        type: dto.agencyType,
        logoUrl: dto.logoUrl || null,
        country: dto.country || 'Nigeria',
        city: dto.city || null,
        eventTypes: dto.eventTypes || [],
        eventsPerYear: dto.eventsPerYear || null,
        teamSize: dto.teamSize || null,
        invitedMembers: dto.invitedMembers || [],
      },
      selectedPlan,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      checkoutUrl: checkoutResult?.checkoutUrl || null,
      txRef: checkoutResult?.txRef || null,
    };
  }

  /**
   * 3. Multi-Step Registration: Venue Organizer
   * Handles Steps 1-5: Business Information, Primary Venue Setup, Spaces & Halls,
   * Team Member Invitations, Plan Selection, and Checkout / Dashboard Skip.
   */
  async registerVenue(dto: RegisterOrganizerVenueDto) {
    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Confirm password does not match password');
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const planToCharge = this.applyBillingCycle(
      await this.resolvePlan(dto.planId),
      dto.billingCycle,
    );

    const mapSpaceType = (t?: string): SpaceType => {
      if (!t) return SpaceType.BALLROOM;
      const upper = t.toUpperCase().replace(/\s+/g, '_');
      const validTypes: Record<string, SpaceType> = {
        BALLROOM: SpaceType.BALLROOM,
        AUDITORIUM: SpaceType.AUDITORIUM,
        TERRACE: SpaceType.TERRACE,
        BOARDROOM: SpaceType.BOARDROOM,
        EXHIBITION_HALL: SpaceType.EXHIBITION_HALL,
        BANQUET_HALL: SpaceType.BANQUET_HALL,
        ROOFTOP: SpaceType.ROOFTOP,
      };
      return validTypes[upper] || SpaceType.BALLROOM;
    };

    const venueCapacity = Number(dto.capacity) || 2500;
    const venueAddress = dto.address || 'Lagos, Nigeria';
    const primaryVenueName = dto.venueName || dto.businessName;

    // Prepare spaces creation
    const spacesData =
      dto.spaces && dto.spaces.length > 0
        ? dto.spaces.map((s) => ({
            name: s.name,
            type: mapSpaceType(s.type),
            capacity: Number(s.capacity) || 100,
            squareMeters: (Number(s.capacity) || 100) * 1.5,
            dailyRate: 0.0,
            currency: 'NGN',
            amenities: s.operatingHours ? [`Hours: ${s.operatingHours}`] : [],
          }))
        : [
            {
              name: primaryVenueName,
              type: mapSpaceType(dto.venueType),
              capacity: venueCapacity,
              squareMeters: venueCapacity * 1.5,
              dailyRate: 0.0,
              currency: 'NGN',
            },
          ];

    // Atomically create User, VenueProfile, Spaces, and UserProfile
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.VENUE,
        venueProfile: {
          create: {
            propertyName: dto.businessName,
            address: venueAddress,
            city: 'Lagos',
            country: 'Nigeria',
            compoundCapacity: venueCapacity,
            spaces: {
              create: spacesData,
            },
          },
        },
        profile: {
          create: {
            company: dto.businessName,
            jobTitle: dto.businessType,
            bio: dto.description || `Hospitality group: ${dto.businessName}`,
          },
        },
      },
      include: {
        venueProfile: {
          include: {
            spaces: true,
          },
        },
        profile: true,
      },
    });

    const venueProfile = user.venueProfile!;

    // Save full venue setup metadata
    await this.prisma.platformSetting.upsert({
      where: { key: `VENUE_CONFIG_${venueProfile.id}` },
      update: {
        value: JSON.stringify({
          businessName: dto.businessName,
          businessType: dto.businessType,
          logoUrl: dto.logoUrl || null,
          venueName: primaryVenueName,
          venueType: dto.venueType || 'Ballroom',
          capacity: venueCapacity,
          address: venueAddress,
          description: dto.description || null,
          spaces: dto.spaces || [],
          invitedMembers: dto.invitedMembers || [],
          billingCycle: dto.billingCycle || 'monthly',
          updatedAt: new Date().toISOString(),
        }),
      },
      create: {
        key: `VENUE_CONFIG_${venueProfile.id}`,
        value: JSON.stringify({
          businessName: dto.businessName,
          businessType: dto.businessType,
          logoUrl: dto.logoUrl || null,
          venueName: primaryVenueName,
          venueType: dto.venueType || 'Ballroom',
          capacity: venueCapacity,
          address: venueAddress,
          description: dto.description || null,
          spaces: dto.spaces || [],
          invitedMembers: dto.invitedMembers || [],
          billingCycle: dto.billingCycle || 'monthly',
          createdAt: new Date().toISOString(),
        }),
        description: `Workspace metadata for venue ${dto.businessName}`,
      },
    });

    // Save pending team invitations from Step 4
    if (dto.invitedMembers && dto.invitedMembers.length > 0) {
      await this.prisma.platformSetting.upsert({
        where: { key: `VENUE_INVITATIONS_${venueProfile.id}` },
        update: {
          value: JSON.stringify(dto.invitedMembers),
        },
        create: {
          key: `VENUE_INVITATIONS_${venueProfile.id}`,
          value: JSON.stringify(dto.invitedMembers),
          description: `Pending team invitations for venue ${dto.businessName}`,
        },
      });
    }

    const { selectedPlan, checkoutResult } = await this.assignRegistrationPlan(user, planToCharge, {
      skipPayment: dto.skipPayment,
      paymentMethod: dto.paymentMethod,
      label: 'venue',
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        venueProfile: {
          id: venueProfile.id,
          propertyName: venueProfile.propertyName,
          address: venueProfile.address,
          city: venueProfile.city,
          compoundCapacity: venueProfile.compoundCapacity,
        },
        profile: user.profile,
      },
      venue: {
        id: venueProfile.id,
        businessName: dto.businessName,
        businessType: dto.businessType,
        logoUrl: dto.logoUrl || null,
        venueName: primaryVenueName,
        venueType: dto.venueType || 'Ballroom',
        capacity: venueCapacity,
        address: venueAddress,
        description: dto.description || null,
        spaces: venueProfile.spaces,
        invitedMembers: dto.invitedMembers || [],
      },
      selectedPlan,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      checkoutUrl: checkoutResult?.checkoutUrl || null,
      txRef: checkoutResult?.txRef || null,
    };
  }

  /**
   * 4. Pay/Upgrade Plan from Portal anytime
   */
  async payPlan(userId: string, dto: PayPlanDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const plan = await this.resolvePlan(dto.planId);
    if (!plan) {
      throw new NotFoundException(`Plan "${dto.planId}" was not found`);
    }

    if (plan.price === 0) {
      await this.prisma.platformSetting.upsert({
        where: { key: `PLAN_USER_${user.id}` },
        update: {
          value: JSON.stringify({
            planId: plan.id,
            planName: plan.name,
            price: 0,
            cycle: plan.cycle,
            isPaid: true,
            status: 'ACTIVE',
            updatedAt: new Date().toISOString(),
          }),
        },
        create: {
          key: `PLAN_USER_${user.id}`,
          value: JSON.stringify({
            planId: plan.id,
            planName: plan.name,
            price: 0,
            cycle: plan.cycle,
            isPaid: true,
            status: 'ACTIVE',
            updatedAt: new Date().toISOString(),
          }),
          description: `Plan assigned to user ${user.id}`,
        },
      });

      await this.recordBillingHistory(user.id, {
        planId: plan.id,
        description: plan.name,
        amount: 0,
        status: 'Paid',
        paymentMethod: 'FREE',
      });

      return {
        isFreePlan: true,
        plan,
        status: 'ACTIVE',
        message: 'Free pass activated successfully',
      };
    }

    const checkout = await this.generatePlanCheckoutUrl(user, plan, dto.redirectUrl);

    if (!checkout) {
      throw new BadRequestException('Could not generate Flutterwave payment link. Check gateway keys.');
    }

    await this.recordBillingHistory(user.id, {
      planId: plan.id,
      description: plan.name,
      amount: plan.price,
      status: 'Pending',
      paymentMethod: 'CARD',
      txRef: checkout.txRef,
    });

    return {
      isFreePlan: false,
      plan,
      checkoutUrl: checkout.checkoutUrl,
      txRef: checkout.txRef,
      status: 'PAYMENT_PENDING',
    };
  }
}
