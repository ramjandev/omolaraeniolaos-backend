import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole, EventStatus, EventFormat } from '@prisma/client';
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

const DEFAULT_PLANS: Record<string, { id: string; name: string; price: number; cycle: string; organizerType: string }> = {
  plan_ind_1: {
    id: 'plan_ind_1',
    name: 'Essential Event Pass',
    price: 0,
    cycle: 'Per-event',
    organizerType: 'Individual',
  },
  plan_ind_2: {
    id: 'plan_ind_2',
    name: 'Grand Celebration Pass',
    price: 35000,
    cycle: 'Per-event',
    organizerType: 'Individual',
  },
  plan_agency_1: {
    id: 'plan_agency_1',
    name: 'Agency Pro Pass',
    price: 120000,
    cycle: 'Monthly',
    organizerType: 'Agency',
  },
  plan_venue_1: {
    id: 'plan_venue_1',
    name: 'Venue Enterprise Pass',
    price: 250000,
    cycle: 'Monthly',
    organizerType: 'Venue',
  },
};

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
    return safeUser;
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

  async resolvePlan(planId: string) {
    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: `PLAN_${planId}` },
      });
      if (setting) {
        const parsed = JSON.parse(setting.value);
        return {
          id: parsed.id,
          name: parsed.planName,
          price: Number(parsed.price) || 0,
          cycle: parsed.billingCycle,
          organizerType: parsed.organizerType,
        };
      }
    } catch {}

    return (
      DEFAULT_PLANS[planId] || {
        id: planId,
        name: 'Standard Event Pass',
        price: 0,
        cycle: 'Per-event',
        organizerType: 'Individual',
      }
    );
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
    const planId = dto.planId || 'plan_ind_1';
    const plan = await this.resolvePlan(planId);

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
        role: UserRole.ORGANIZER_INDIVIDUAL,
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
    const isFree = plan.price === 0;
    const isSkipped = dto.skipPayment === true;
    let checkoutResult: { checkoutUrl: string; txRef: string } | null = null;

    if (!isFree && !isSkipped) {
      checkoutResult = await this.generatePlanCheckoutUrl(user, plan);
    }

    const planStatus = isFree
      ? 'ACTIVE'
      : isSkipped
        ? 'PAYMENT_PENDING'
        : 'CHECKOUT_INITIALIZED';

    await this.prisma.platformSetting.upsert({
      where: { key: `PLAN_USER_${user.id}` },
      update: {
        value: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          cycle: plan.cycle,
          isPaid: isFree,
          status: planStatus,
          paymentMethod: dto.paymentMethod || (isFree ? 'FREE' : 'CARD'),
          selectedAt: new Date().toISOString(),
        }),
      },
      create: {
        key: `PLAN_USER_${user.id}`,
        value: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          cycle: plan.cycle,
          isPaid: isFree,
          status: planStatus,
          paymentMethod: dto.paymentMethod || (isFree ? 'FREE' : 'CARD'),
          selectedAt: new Date().toISOString(),
        }),
        description: `Plan assigned to individual user ${user.id}`,
      },
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
      selectedPlan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        cycle: plan.cycle,
        isPaid: isFree,
        status: planStatus,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      checkoutUrl: checkoutResult?.checkoutUrl || null,
      txRef: checkoutResult?.txRef || null,
    };
  }

  /**
   * 2. Multi-Step Registration: Agency Organizer
   */
  async registerAgency(dto: RegisterOrganizerAgencyDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const plan = await this.resolvePlan(dto.planId);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.ORGANIZER_AGENCY,
        agencyProfile: {
          create: {
            agencyName: dto.agencyName,
            billingEmail: dto.billingEmail || email,
            corporateTaxId: dto.corporateTaxId,
            headquarters: dto.headquarters,
            website: dto.website,
          },
        },
      },
      include: {
        agencyProfile: true,
      },
    });

    const skipPayment = dto.skipPayment !== false;
    let checkoutResult: { checkoutUrl: string; txRef: string } | null = null;

    if (!skipPayment && plan.price > 0) {
      checkoutResult = await this.generatePlanCheckoutUrl(user, plan);
    }

    await this.prisma.platformSetting.upsert({
      where: { key: `PLAN_USER_${user.id}` },
      update: {
        value: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          cycle: plan.cycle,
          isPaid: plan.price === 0,
          status: plan.price === 0 ? 'ACTIVE' : skipPayment ? 'PAYMENT_PENDING' : 'CHECKOUT_INITIALIZED',
          selectedAt: new Date().toISOString(),
        }),
      },
      create: {
        key: `PLAN_USER_${user.id}`,
        value: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          cycle: plan.cycle,
          isPaid: plan.price === 0,
          status: plan.price === 0 ? 'ACTIVE' : skipPayment ? 'PAYMENT_PENDING' : 'CHECKOUT_INITIALIZED',
          selectedAt: new Date().toISOString(),
        }),
        description: `Plan assigned to user ${user.id}`,
      },
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
      },
      selectedPlan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        cycle: plan.cycle,
        isPaid: plan.price === 0,
        status: plan.price === 0 ? 'ACTIVE' : skipPayment ? 'PAYMENT_PENDING' : 'CHECKOUT_INITIALIZED',
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      checkoutUrl: checkoutResult?.checkoutUrl || null,
      txRef: checkoutResult?.txRef || null,
    };
  }

  /**
   * 3. Multi-Step Registration: Venue Organizer
   */
  async registerVenue(dto: RegisterOrganizerVenueDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const plan = await this.resolvePlan(dto.planId);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.ORGANIZER_VENUE,
        venueProfile: {
          create: {
            propertyName: dto.propertyName,
            address: dto.address,
            city: dto.city,
            state: dto.state,
            country: dto.country || 'Nigeria',
            compoundCapacity: dto.compoundCapacity || 2500,
            securityHotline: dto.securityHotline,
          },
        },
      },
      include: {
        venueProfile: true,
      },
    });

    const skipPayment = dto.skipPayment !== false;
    let checkoutResult: { checkoutUrl: string; txRef: string } | null = null;

    if (!skipPayment && plan.price > 0) {
      checkoutResult = await this.generatePlanCheckoutUrl(user, plan);
    }

    await this.prisma.platformSetting.upsert({
      where: { key: `PLAN_USER_${user.id}` },
      update: {
        value: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          cycle: plan.cycle,
          isPaid: plan.price === 0,
          status: plan.price === 0 ? 'ACTIVE' : skipPayment ? 'PAYMENT_PENDING' : 'CHECKOUT_INITIALIZED',
          selectedAt: new Date().toISOString(),
        }),
      },
      create: {
        key: `PLAN_USER_${user.id}`,
        value: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          cycle: plan.cycle,
          isPaid: plan.price === 0,
          status: plan.price === 0 ? 'ACTIVE' : skipPayment ? 'PAYMENT_PENDING' : 'CHECKOUT_INITIALIZED',
          selectedAt: new Date().toISOString(),
        }),
        description: `Plan assigned to user ${user.id}`,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        venueProfile: user.venueProfile,
      },
      selectedPlan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        cycle: plan.cycle,
        isPaid: plan.price === 0,
        status: plan.price === 0 ? 'ACTIVE' : skipPayment ? 'PAYMENT_PENDING' : 'CHECKOUT_INITIALIZED',
      },
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

    return {
      isFreePlan: false,
      plan,
      checkoutUrl: checkout.checkoutUrl,
      txRef: checkout.txRef,
      status: 'PAYMENT_PENDING',
    };
  }
}
