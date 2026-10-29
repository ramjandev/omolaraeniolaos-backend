import { Injectable, Logger, Inject, Optional, NotFoundException, BadRequestException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { CommunicationsService } from '../communications/communications.service';
import {
  GateManagementOverviewResponseDto,
  GateManagementMetricsDto,
  GateStaffMemberItemDto,
  GateEventOptionDto,
  InviteGateStaffDto,
  AssignGateStaffDto,
  AssignAllGateStaffDto,
  UnassignGateStaffDto,
  RemoveGateStaffDto,
} from './dto/individual-gate.dto';

@Injectable()
export class IndividualGateService {
  private readonly logger = new Logger(IndividualGateService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunicationsService) private readonly communications: CommunicationsService,
    @Optional() @Inject(MailService) private readonly mailService?: MailService,
  ) {}

  private frontendBase() {
    const configured = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    if (!configured || configured.includes('localhost') || configured.includes('127.0.0.1')) {
      return 'https://omolaraeniolaos-frontend.vercel.app';
    }
    return configured;
  }

  private inviteSecret() {
    return process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'book-secret-access-key';
  }

  private signInviteToken(payload: {
    sub: string;
    organizerId: string;
    eventId?: string | null;
    gateNumber?: string | null;
  }) {
    return jwt.sign({ ...payload, type: 'GATE_INVITE' }, this.inviteSecret(), { expiresIn: '7d' });
  }

  async getInvitation(token: string) {
    if (!token) {
      throw new BadRequestException('Open the invitation link from your email');
    }
    let payload: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, this.inviteSecret());
      if (!verified || typeof verified === 'string') {
        throw new BadRequestException('This invitation link is invalid or expired');
      }
      payload = verified;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('This invitation link is invalid or expired');
    }
    if (payload.type !== 'GATE_INVITE' || typeof payload.sub !== 'string') {
      throw new BadRequestException('This invitation link is invalid or expired');
    }

    const staff = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, fullName: true, email: true, role: true },
    });
    if (!staff || staff.role !== UserRole.GATE) {
      throw new NotFoundException('This invitation is no longer available');
    }
    const organizerId = typeof payload.organizerId === 'string' ? payload.organizerId : '';
    const organizer = organizerId
      ? await this.prisma.user.findUnique({ where: { id: organizerId }, select: { fullName: true } })
      : null;
    const eventId = typeof payload.eventId === 'string' ? payload.eventId : '';
    const event = eventId
      ? await this.prisma.event.findUnique({
          where: { id: eventId },
          select: { id: true, title: true, startDate: true },
        })
      : null;
    const gateNumber = typeof payload.gateNumber === 'string' && payload.gateNumber ? payload.gateNumber : '';
    if (event) {
      const profile = await this.prisma.gateStaffProfile.upsert({
        where: { userId: staff.id },
        update: {},
        create: { userId: staff.id, gateCode: gateNumber || 'GATE-1' },
      });
      await this.saveShift(profile.id, event.id, gateNumber || 'Gate 1');
    }

    return {
      organizerName: organizer?.fullName || 'Your organizer',
      eventTitle: event?.title || 'Event not assigned yet',
      eventDate: event?.startDate ? event.startDate.toISOString() : null,
      gateNumber: gateNumber || 'Not assigned yet',
      role: 'Gate Staff',
      email: staff.email,
      staffName: staff.fullName,
    };
  }

  private rosterKey(userId: string) {
    return `GATE_ROSTER_${userId}`;
  }

  private async readRoster(userId: string): Promise<string[]> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: this.rosterKey(userId) } });
    if (!row?.value) return [];
    try {
      const parsed = JSON.parse(row.value);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private async rememberStaff(userId: string, staffUserId: string) {
    const ids = await this.readRoster(userId);
    if (!ids.includes(staffUserId)) ids.push(staffUserId);
    await this.prisma.platformSetting.upsert({
      where: { key: this.rosterKey(userId) },
      update: { value: JSON.stringify(ids) },
      create: {
        key: this.rosterKey(userId),
        value: JSON.stringify(ids),
        description: 'Gate staff invited by this organizer',
      },
    });
  }

  private async forgetStaff(userId: string, staffUserId: string) {
    const ids = (await this.readRoster(userId)).filter((id) => id !== staffUserId);
    await this.prisma.platformSetting.upsert({
      where: { key: this.rosterKey(userId) },
      update: { value: JSON.stringify(ids) },
      create: {
        key: this.rosterKey(userId),
        value: JSON.stringify(ids),
        description: 'Gate staff invited by this organizer',
      },
    });
  }

  private async resolveUser(userId?: string) {
    if (!userId) return null;
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  /**
   * Gate management overview: the organizer's events and the gate staff on shift for them.
   */
  async getGateOverview(userId?: string): Promise<GateManagementOverviewResponseDto> {
    const user = await this.resolveUser(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const eventsList = await this.prisma.event.findMany({
      where: { organizerId: user.id },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
    });
    const eventIds = eventsList.map((e) => e.id);
    const rosterIds = await this.readRoster(user.id);

    const dbStaff = rosterIds.length || eventIds.length
      ? await this.prisma.user.findMany({
          where: {
            role: UserRole.GATE,
            OR: [
              ...(rosterIds.length ? [{ id: { in: rosterIds } }] : []),
              ...(eventIds.length
                ? [{ staffProfile: { shifts: { some: { eventId: { in: eventIds } } } } }]
                : []),
            ],
          },
          include: {
            staffProfile: {
              include: {
                shifts: {
                  where: eventIds.length
                    ? { eventId: { in: eventIds }, isActive: true }
                    : { isActive: true },
                  orderBy: { shiftStart: 'desc' },
                  include: { event: { select: { id: true, title: true } } },
                },
              },
            },
          },
          orderBy: { fullName: 'asc' },
        })
      : [];

    const staffItems: GateStaffMemberItemDto[] = [
      {
        id: user.id,
        fullName: `${user.fullName} (You)`,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: 'Owner',
        assignedEventsCount: eventsList.length,
        currentAssignment: eventsList[0]?.title ?? null,
        currentEventId: eventsList[0]?.id ?? null,
        gateNumber: 'All Gates',
        isOwner: true,
        assignments: [],
      },
      ...dbStaff.map((s) => {
        const shifts = (s.staffProfile?.shifts ?? []).filter((shift) => shift.isActive);
        const latestShift = shifts[0];
        const uniqueEvents = new Set(shifts.map((shift) => shift.eventId));
        return {
          id: s.id,
          fullName: s.fullName,
          email: s.email,
          phone: s.phone,
          avatarUrl: s.avatarUrl,
          role: 'Gate Staff',
          assignedEventsCount: uniqueEvents.size,
          currentAssignment: latestShift?.event?.title ?? null,
          currentEventId: latestShift?.event?.id ?? null,
          gateNumber: latestShift?.gateNumber ?? null,
          isOwner: false,
          assignments: shifts.map((shift) => ({
            id: shift.id,
            eventId: shift.eventId,
            eventTitle: shift.event?.title || 'Event',
            gateNumber: shift.gateNumber,
            assignedAt: shift.shiftStart.toISOString(),
          })),
        };
      }),
    ];

    const metrics: GateManagementMetricsDto = {
      ownerCount: 1,
      gateStaffCount: dbStaff.length,
      activeEventsCount: eventsList.length,
    };

    const events: GateEventOptionDto[] = eventsList.map((e) => ({ id: e.id, title: e.title }));

    return { metrics, staff: staffItems, events };
  }

  /**
   * Invite a gate staff member. New accounts get a one-time temporary password.
   */
  async inviteStaff(dto: InviteGateStaffDto, organizerUserId?: string) {
    if (!organizerUserId) {
      throw new BadRequestException('Sign in to invite gate staff');
    }
    const email = dto.email.toLowerCase().trim();

    if (dto.eventId) {
      await this.assertEventOwnedBy(dto.eventId, organizerUserId);
    }

    let temporaryPassword: string | null = null;
    let staffUser = await this.prisma.user.findUnique({ where: { email } });

    if (staffUser && staffUser.role !== UserRole.GATE) {
      throw new BadRequestException('This email belongs to a non gate-staff account');
    }

    if (!staffUser) {
      temporaryPassword = randomBytes(6).toString('base64url');
      staffUser = await this.prisma.user.create({
        data: {
          email,
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash: await bcrypt.hash(temporaryPassword, 10),
          role: UserRole.GATE,
        },
      });
    }

    const profile = await this.prisma.gateStaffProfile.upsert({
      where: { userId: staffUser.id },
      update: {},
      create: { userId: staffUser.id, gateCode: dto.gateNumber || 'GATE-1' },
    });

    let shift: { eventId: string; gateNumber: string } | null = null;
    if (dto.eventId) {
      shift = await this.saveShift(profile.id, dto.eventId, dto.gateNumber || 'Gate 1');
    }

    await this.rememberStaff(organizerUserId, staffUser.id);

    const organizer = await this.prisma.user.findUnique({
      where: { id: organizerUserId },
      select: { fullName: true },
    });
    const inviteToken = this.signInviteToken({
      sub: staffUser.id,
      organizerId: organizerUserId,
      eventId: shift?.eventId || dto.eventId || null,
      gateNumber: shift?.gateNumber || dto.gateNumber || null,
    });
    const inviteUrl = `${this.frontendBase()}/gate-staff/invite?token=${encodeURIComponent(inviteToken)}`;

    if (this.mailService) {
      const passwordLine = temporaryPassword
        ? `<p>Temporary password: <strong>${temporaryPassword}</strong></p>`
        : '<p>Sign in with your existing gate staff password.</p>';
      await this.mailService.sendEmail(
        email,
        'You are invited as gate staff on McEniesVite',
        [
          `<p>Hello ${dto.fullName},</p>`,
          `<p>${organizer?.fullName || 'Your organizer'} has invited you to help manage guest entry.</p>`,
          passwordLine,
          `<p><a href="${inviteUrl}">Open your invitation</a></p>`,
          `<p>Accept the invitation, then sign in with this email and the temporary password.</p>`,
        ].join(''),
      );
    }

    return {
      message: `Gate staff ${email} saved`,
      staff: {
        id: staffUser.id,
        fullName: staffUser.fullName,
        email: staffUser.email,
        phone: staffUser.phone,
        role: 'Gate Staff',
        gateNumber: shift?.gateNumber ?? null,
        currentEventId: shift?.eventId ?? null,
      },
      temporaryPassword,
    };
  }

  /**
   * Assign one gate staff member to an event and gate post.
   */
  async assignStaff(dto: AssignGateStaffDto, organizerUserId?: string) {
    if (!organizerUserId) {
      throw new BadRequestException('Sign in to assign gate staff');
    }
    const allowed = await this.organizerStaffIds(organizerUserId);
    if (!allowed.has(dto.staffId)) {
      throw new BadRequestException('This gate staff member is not on your roster');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: dto.staffId },
      include: { staffProfile: true },
    });
    if (!user?.staffProfile) {
      throw new NotFoundException(`Gate staff ${dto.staffId} not found`);
    }
    const event = await this.assertEventOwnedBy(dto.eventId, organizerUserId);

    const shift = await this.saveShift(user.staffProfile.id, dto.eventId, dto.gateNumber || 'Gate 1');
    const notifications = await this.notifyAssignment(user, event.title, shift.gateNumber);

    return {
      message: this.assignmentMessage('Gate staff assignment saved', [notifications]),
      data: {
        shiftId: shift.id,
        staffId: user.id,
        eventId: shift.eventId,
        gateNumber: shift.gateNumber,
        notifications,
      },
    };
  }

  /**
   * Remove one gate staff member from an event.
   */
  async unassignStaff(dto: UnassignGateStaffDto, organizerUserId?: string) {
    if (!organizerUserId) {
      throw new BadRequestException('Sign in to update gate staff');
    }
    const allowed = await this.organizerStaffIds(organizerUserId);
    if (!allowed.has(dto.staffId)) {
      throw new BadRequestException('This gate staff member is not on your roster');
    }
    await this.assertEventOwnedBy(dto.eventId, organizerUserId);
    const profile = await this.prisma.gateStaffProfile.findUnique({
      where: { userId: dto.staffId },
    });
    if (!profile) {
      throw new NotFoundException('Gate staff profile was not found');
    }
    const removed = await this.prisma.gateStaffShift.deleteMany({
      where: { staffId: profile.id, eventId: dto.eventId },
    });
    return { removed: removed.count, staffId: dto.staffId, eventId: dto.eventId };
  }

  /**
   * Delete a gate staff member from this organizer's roster.
   */
  async removeStaff(dto: RemoveGateStaffDto, organizerUserId?: string) {
    if (!organizerUserId) {
      throw new BadRequestException('Sign in to update gate staff');
    }
    const allowed = await this.organizerStaffIds(organizerUserId);
    if (!allowed.has(dto.staffId)) {
      throw new BadRequestException('This gate staff member is not on your roster');
    }
    const staffUser = await this.prisma.user.findUnique({
      where: { id: dto.staffId },
      include: { staffProfile: true },
    });
    if (!staffUser || staffUser.role !== UserRole.GATE) {
      throw new NotFoundException('Gate staff was not found');
    }

    const events = await this.prisma.event.findMany({
      where: { organizerId: organizerUserId },
      select: { id: true },
    });
    if (staffUser.staffProfile && events.length) {
      await this.prisma.gateStaffShift.deleteMany({
        where: {
          staffId: staffUser.staffProfile.id,
          eventId: { in: events.map((event) => event.id) },
        },
      });
    }
    await this.forgetStaff(organizerUserId, dto.staffId);

    const remainingShifts = staffUser.staffProfile
      ? await this.prisma.gateStaffShift.count({ where: { staffId: staffUser.staffProfile.id } })
      : 0;
    if (remainingShifts === 0) {
      await this.prisma.user.delete({ where: { id: staffUser.id } });
    }

    return { staffId: dto.staffId, deleted: remainingShifts === 0 };
  }

  /**
   * Assign every gate staff member (or the given subset) to an event.
   */
  async assignAllStaff(dto: AssignAllGateStaffDto, organizerUserId?: string) {
    if (!organizerUserId) {
      throw new BadRequestException('Sign in to assign gate staff');
    }
    const event = await this.assertEventOwnedBy(dto.eventId, organizerUserId);
    const allowed = await this.organizerStaffIds(organizerUserId);
    const targetIds = (dto.staffIds?.length ? dto.staffIds : [...allowed]).filter((id) => allowed.has(id));

    const staffProfiles = await this.prisma.gateStaffProfile.findMany({
      where: { userId: { in: targetIds } },
      include: { user: true },
    });

    const notifications = [];
    for (const [index, profile] of staffProfiles.entries()) {
      const gateNumber = dto.gatePrefix ? `${dto.gatePrefix} ${index + 1}` : `Gate ${index + 1}`;
      await this.saveShift(profile.id, dto.eventId, gateNumber);
      notifications.push(await this.notifyAssignment(profile.user, event.title, gateNumber));
    }

    return {
      message: this.assignmentMessage(
        `Assigned ${staffProfiles.length} gate staff to ${event.title}`,
        notifications,
      ),
      data: {
        assignedCount: staffProfiles.length,
        eventId: dto.eventId,
        notifications,
      },
    };
  }

  private async notifyAssignment(
    user: { fullName: string; email: string; phone: string | null },
    eventTitle: string,
    gateNumber: string,
  ) {
    const loginUrl = `${this.frontendBase()}/gate-staff/login`;
    const subject = `You are assigned to ${eventTitle}`;
    const html = [
      `<p>Hello ${user.fullName},</p>`,
      `<p>You are assigned to <strong>${eventTitle}</strong>.</p>`,
      `<p>Your gate is <strong>${gateNumber}</strong>.</p>`,
      `<p>Sign in to the gate workspace: <a href="${loginUrl}">${loginUrl}</a></p>`,
    ].join('');

    const email = this.mailService
      ? await this.mailService.sendEmail(user.email, subject, html).then((result) =>
          result.ok ? { status: 'sent' as const } : { status: 'failed' as const, error: result.error },
        )
      : { status: 'skipped' as const, error: 'Email is not configured' };

    const whatsapp = await this.communications.sendGateNotice({
      phone: user.phone,
      name: user.fullName,
      eventTitle,
      gateNumber,
      loginUrl,
    });

    return { email, whatsapp };
  }

  private assignmentMessage(
    saved: string,
    notices: Array<{
      email: { status: string; error?: string };
      whatsapp: { status: string; error?: string };
    }>,
  ) {
    const emailSent = notices.filter((notice) => notice.email.status === 'sent').length;
    const whatsappSent = notices.filter((notice) => notice.whatsapp.status === 'sent').length;
    const emailError = notices.find((notice) => notice.email.status === 'failed')?.email.error;
    const whatsappError = notices.find((notice) => notice.whatsapp.status === 'failed')?.whatsapp.error;
    const parts = [saved];
    parts.push(
      emailSent > 0
        ? `Email sent to ${emailSent}.`
        : `Email was not delivered${emailError ? `: ${emailError}` : '.'}`,
    );
    parts.push(
      whatsappSent > 0
        ? `WhatsApp sent to ${whatsappSent}.`
        : `WhatsApp was not delivered${whatsappError ? `: ${whatsappError}` : '.'}`,
    );
    return parts.join(' ');
  }

  private async organizerStaffIds(userId: string) {
    const roster = await this.readRoster(userId);
    const events = await this.prisma.event.findMany({
      where: { organizerId: userId },
      select: { id: true },
    });
    const shifted = events.length
      ? await this.prisma.user.findMany({
          where: {
            role: UserRole.GATE,
            staffProfile: { shifts: { some: { eventId: { in: events.map((event) => event.id) } } } },
          },
          select: { id: true },
        })
      : [];
    return new Set([...roster, ...shifted.map((staff) => staff.id)]);
  }

  private async saveShift(staffProfileId: string, eventId: string, gateNumber: string) {
    const existing = await this.prisma.gateStaffShift.findFirst({
      where: { staffId: staffProfileId, eventId, isActive: true },
      orderBy: { shiftStart: 'desc' },
    });
    if (existing) {
      return this.prisma.gateStaffShift.update({
        where: { id: existing.id },
        data: { gateNumber },
      });
    }
    return this.prisma.gateStaffShift.create({
      data: {
        staffId: staffProfileId,
        eventId,
        gateNumber,
        shiftStart: new Date(),
      },
    });
  }

  private async assertEventExists(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    return event;
  }

  private async assertEventOwnedBy(eventId: string, organizerUserId?: string) {
    const event = await this.assertEventExists(eventId);
    if (organizerUserId && event.organizerId !== organizerUserId) {
      throw new BadRequestException('You can only assign staff to your own events');
    }
    return event;
  }
}
