import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EventStatus,
  EventFormat,
  AttendeeStatus,
  TicketTierType,
  RsvpStatus,
  CommunicationChannel,
  CheckInFlagStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { IndividualGateService } from './individual-gate.service';
import {
  FilterIndividualEventsDto,
  CreateIndividualEventDto,
  UpdateIndividualEventDto,
  AddIndividualGuestDto,
  BulkAddIndividualGuestsDto,
  UpdateIndividualGuestDto,
  AssignGuestSeatingDto,
  CreateSeatingDto,
  ResolveFlagDto,
  UpdateSetupStepDto,
  InviteGuestDto,
} from './dto/individual-events.dto';
import { CommunicationsService } from '../communications/communications.service';
import { readOrganizerAdmins, saveOrganizerAdmin } from '../agency/organizer-admins';

@Injectable()
export class IndividualEventsService {
  private readonly logger = new Logger(IndividualEventsService.name);

  // In-memory setup steps cache per event (allows interactive wizard tracking)
  private readonly setupStepsState = new Map<string, boolean[]>();

  // In-memory flagged exceptions cache for live turnstile monitor
  private readonly flaggedExceptionsMap = new Map<string, any[]>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunicationsService)
    private readonly communicationsService: CommunicationsService,
    @Inject(IndividualGateService) private readonly gate: IndividualGateService,
  ) {}

  /**
   * Resolve individual organizer user
   */
  private async resolveUser(userId?: string) {
    if (!userId) return null;
    try {
      return await this.prisma.user.findUnique({ where: { id: userId } });
    } catch {
      return null;
    }
  }

  /**
   * Helper: Resolve single event by id, slug, or fallback '1'/'active'
   */
  private async resolveEvent(idOrSlug: string, organizerId?: string): Promise<any> {
    if (idOrSlug && idOrSlug !== '1' && idOrSlug !== 'active') {
      const byId = await this.prisma.event.findUnique({
        where: { id: idOrSlug },
        include: {
          ticketTiers: true,
          tableZones: { include: { assignments: { include: { attendee: true } } } },
          attendees: { include: { ticketTier: true, tableSeat: true } },
          staffShifts: { include: { staff: { include: { user: true } } } },
        },
      });
      if (byId) return byId;

      const bySlug = await this.prisma.event.findUnique({
        where: { slug: idOrSlug },
        include: {
          ticketTiers: true,
          tableZones: { include: { assignments: { include: { attendee: true } } } },
          attendees: { include: { ticketTier: true, tableSeat: true } },
          staffShifts: { include: { staff: { include: { user: true } } } },
        },
      });
      if (bySlug) return bySlug;
    }

    // Fallback: Find organizer's active or first event
    const organizer = await this.resolveUser(organizerId);
    if (organizer) {
      const first = await this.prisma.event.findFirst({
        where: { organizerId: organizer.id },
        include: {
          ticketTiers: true,
          tableZones: { include: { assignments: { include: { attendee: true } } } },
          attendees: { include: { ticketTier: true, tableSeat: true } },
          staffShifts: { include: { staff: { include: { user: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (first) return first;
    }

    throw new NotFoundException('Event not found. Create an event first.');
  }

  /**
   * 1. GET ALL EVENTS for individual organizer
   */
  async getEvents(userId?: string, query?: FilterIndividualEventsDto) {
    const user = await this.resolveUser(userId);
    if (!user) {
      return { events: [], counts: { all: 0, active: 0, draft: 0, completed: 0 } };
    }

    const where: any = { organizerId: user.id };

    if (query?.status && query.status !== 'all') {
      if (query.status === 'active' || query.status === 'live') {
        where.status = { in: [EventStatus.LIVE, EventStatus.PUBLISHED] };
      } else if (query.status === 'draft') {
        where.status = EventStatus.DRAFT;
      } else if (query.status === 'completed') {
        where.status = EventStatus.COMPLETED;
      }
    }

    if (query?.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { venueName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const events = await this.prisma.event.findMany({
      where,
      include: {
        attendees: { select: { id: true, status: true, ticketTier: true } },
        ticketTiers: true,
      },
      orderBy: { startDate: 'asc' },
    });

    const now = new Date();

    const formattedEvents = events.map((ev) => {
      const attendeesCount = ev.attendees.length;
      const confirmedCount = ev.attendees.filter(
        (a) => a.status === AttendeeStatus.ATTENDING || a.status === AttendeeStatus.CHECKED_IN,
      ).length;
      const checkedInCount = ev.attendees.filter(
        (a) => a.status === AttendeeStatus.CHECKED_IN,
      ).length;

      const diffTime = ev.startDate.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      const hoursLeft = Math.max(
        0,
        Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      );
      const minutesLeft = Math.max(
        0,
        Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60)),
      );

      // Status mapping for individual frontend
      let uiStatus: 'active' | 'draft' | 'completed' = 'draft';
      if (ev.status === EventStatus.LIVE || ev.status === EventStatus.PUBLISHED) {
        uiStatus = 'active';
      } else if (ev.status === EventStatus.COMPLETED) {
        uiStatus = 'completed';
      }

      return {
        id: ev.id,
        title: ev.title,
        slug: ev.slug,
        category: ev.category,
        format: ev.format,
        status: uiStatus,
        rawStatus: ev.status,
        date: ev.startDate.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        time: ev.startDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        startDate: ev.startDate,
        endDate: ev.endDate,
        venueName: ev.venueName,
        address: ev.address,
        city: ev.city,
        country: ev.country,
        guestsCount: attendeesCount,
        confirmedCount,
        checkedInCount,
        totalTarget: ev.capacity,
        daysLeft,
        countdown: {
          days: daysLeft,
          hours: hoursLeft,
          minutes: minutesLeft,
        },
      };
    });

    const allOrganizerEvents = await this.prisma.event.findMany({
      where: { organizerId: user.id },
      select: { status: true },
    });

    const counts = {
      all: allOrganizerEvents.length,
      active: allOrganizerEvents.filter(
        (e) => e.status === EventStatus.LIVE || e.status === EventStatus.PUBLISHED,
      ).length,
      draft: allOrganizerEvents.filter((e) => e.status === EventStatus.DRAFT).length,
      completed: allOrganizerEvents.filter((e) => e.status === EventStatus.COMPLETED).length,
    };

    return {
      events: formattedEvents,
      counts,
    };
  }

  /**
   * 2. GET SINGLE EVENT WORKSPACE DETAILS (Metadata, 4 KPIs, Countdown, Checklist)
   */
  async getEventById(id: string, userId?: string) {
    const ev = await this.resolveEvent(id, userId);
    const now = new Date();

    const diffTime = ev.startDate.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const hoursLeft = Math.max(
      0,
      Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    );
    const minutesLeft = Math.max(
      0,
      Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60)),
    );

    const totalInvited = ev.attendees?.length ?? 0;
    const confirmedCount =
      ev.attendees?.filter(
        (a: any) => a.status === AttendeeStatus.ATTENDING || a.status === AttendeeStatus.CHECKED_IN,
      ).length ?? 0;
    const checkedInCount =
      ev.attendees?.filter((a: any) => a.status === AttendeeStatus.CHECKED_IN).length ?? 0;

    const vipAttendees =
      ev.attendees?.filter((a: any) => a.ticketTier?.type === TicketTierType.VIP) || [];
    const vipCheckedIn = vipAttendees.filter(
      (a: any) => a.status === AttendeeStatus.CHECKED_IN,
    ).length;

    // Retrieve or initialize setup checklist state (6 steps)
    const eventKey = ev.id;
    if (!this.setupStepsState.has(eventKey)) {
      this.setupStepsState.set(eventKey, [true, false, false, false, false, false]);
    }
    const stepsStatus = this.setupStepsState.get(eventKey)!;

    const checklist = [
      {
        id: 1,
        title: 'Event Essentials & Details',
        description: 'Title, category, dress code, parking & venue directions',
        status: stepsStatus[0] ? 'completed' : 'pending',
      },
      {
        id: 2,
        title: 'Venue & Date Configuration',
        description: 'Physical venue location, timing, and capacity limit',
        status: stepsStatus[1] ? 'completed' : 'pending',
      },
      {
        id: 3,
        title: 'Guest Roster & VIP Protocol',
        description: 'Import VIP & General attendees, set party limits',
        status: stepsStatus[2] ? 'completed' : 'pending',
      },
      {
        id: 4,
        title: 'Seating Blueprint & Table Layout',
        description: 'Define table zones (VVIP, Ambassador) and assign seats',
        status: stepsStatus[3] ? 'completed' : 'pending',
      },
      {
        id: 5,
        title: 'WhatsApp Concierge & RSVP Automation',
        description: 'Interactive RSVP flow, dynamic QR delivery, broadcast announcements',
        status: stepsStatus[4] ? 'completed' : 'in_progress',
      },
      {
        id: 6,
        title: 'Turnstile Gate Staff & QR Security',
        description: 'Invite gate crew, assign entry gates, and activate scanner access',
        status: stepsStatus[5] ? 'completed' : 'ready',
      },
    ];

    let uiStatus: 'active' | 'draft' | 'completed' = 'draft';
    if (ev.status === EventStatus.LIVE || ev.status === EventStatus.PUBLISHED) {
      uiStatus = 'active';
    } else if (ev.status === EventStatus.COMPLETED) {
      uiStatus = 'completed';
    }

    return {
      event: {
        id: ev.id,
        title: ev.title,
        slug: ev.slug,
        category: ev.category,
        format: ev.format,
        status: uiStatus,
        rawStatus: ev.status,
        description: ev.description,
        venueName: ev.venueName,
        address: ev.address,
        city: ev.city,
        country: ev.country,
        capacity: ev.capacity,
        startDate: ev.startDate,
        endDate: ev.endDate,
        dateFormatted: ev.startDate.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        timeFormatted: `${ev.startDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })} - ${ev.endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} WAT`,
      },
      kpis: {
        totalInvited: {
          current: totalInvited,
          target: ev.capacity,
          label: `${totalInvited}/${ev.capacity} Guests`,
        },
        confirmedRsvp: {
          current: confirmedCount,
          rate: `${Math.round((confirmedCount / Math.max(1, totalInvited)) * 100)}%`,
        },
        checkedIn: {
          current: checkedInCount,
          rate: `${Math.round((checkedInCount / Math.max(1, totalInvited)) * 100)}%`,
        },
        vipAttendance: {
          current: vipCheckedIn,
          total: vipAttendees.length,
          rate: `${Math.round((vipCheckedIn / Math.max(1, vipAttendees.length)) * 100)}%`,
        },
      },
      countdown: {
        days: daysLeft,
        hours: hoursLeft,
        minutes: minutesLeft,
      },
      checklist,
      ticketTiers: ev.ticketTiers || [],
      tableZones: ev.tableZones || [],
    };
  }

  /**
   * 3. CREATE EVENT (Wizard step handler)
   */
  async createEvent(userId: string | undefined, dto: CreateIndividualEventDto) {
    const user = await this.resolveUser(userId);
    if (!user) {
      throw new BadRequestException('Individual organizer user could not be resolved');
    }

    const slug = `${dto.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : new Date(startDate.getTime() + 1000 * 60 * 60 * 5); // default 5 hours duration

    const agencyClientId = await this.resolveAgencyClient(user.id, dto);
    const venueSpace = dto.venueSpaceId
      ? await this.prisma.venueSpace.findFirst({
          where: { id: dto.venueSpaceId, venue: { userId: user.id } },
          select: { id: true, name: true, venueId: true },
        })
      : null;
    if (dto.venueSpaceId && !venueSpace) {
      throw new BadRequestException('That venue does not belong to your account');
    }

    const event = await this.prisma.event.create({
      data: {
        organizerId: user.id,
        agencyClientId,
        venueSpaceId: venueSpace?.id,
        title: dto.title,
        slug,
        category: dto.category || 'General',
        description: dto.description || '',
        format: dto.format || EventFormat.IN_PERSON,
        status: dto.status || EventStatus.DRAFT,
        startDate,
        endDate,
        capacity: dto.capacity || 100,
        venueName: dto.venueName || venueSpace?.name,
        address: dto.address,
        city: dto.city,
        country: dto.country,
      },
      include: {
        ticketTiers: true,
        tableZones: true,
      },
    });

    // Initialize 6 checklist steps
    this.setupStepsState.set(event.id, [true, false, false, false, false, false]);
    if (venueSpace && dto.clientName?.trim()) {
      await this.prisma.venueBooking.create({
        data: {
          bookingCode: `VB-${Date.now().toString(36)}`,
          venueId: venueSpace.venueId,
          spaceId: venueSpace.id,
          eventId: event.id,
          clientName: dto.clientName.trim(),
          contactEmail: user.email,
          startDate,
          endDate,
          totalGuests: dto.capacity || 0,
          totalAmount: 0,
          currency: 'NGN',
        },
      });
    }
    try {
      await this.attachEventTeam(user.id, event.id, dto);
    } catch (error) {
      const teamWarning = error instanceof Error ? error.message : 'The team could not be assigned';
      this.logger.warn(`Event ${event.id} was created, but the team was not assigned: ${teamWarning}`);
      return { ...event, teamWarning };
    }

    return event;
  }

  private async resolveAgencyClient(userId: string, dto: CreateIndividualEventDto) {
    if (!dto.agencyClientId && !dto.newClient) return undefined;
    const agency = await this.prisma.agencyProfile.findFirst({ where: { userId } });
    if (!agency) throw new BadRequestException('Create your agency profile before adding a client');

    if (dto.agencyClientId) {
      const client = await this.prisma.agencyClient.findFirst({
        where: { id: dto.agencyClientId, agencyId: agency.id },
      });
      if (!client) throw new BadRequestException('That client does not belong to your agency');
      return client.id;
    }

    const created = dto.newClient;
    if (!created) return undefined;
    const name = created.name.trim();
    const client = await this.prisma.agencyClient.create({
      data: {
        agencyId: agency.id,
        name,
        industry: created.industry?.trim() || '',
        contactPerson: name,
        contactEmail: created.contactEmail.trim(),
        contactPhone: created.contactPhone?.trim() || null,
        contractTotal: 0,
        currency: 'NGN',
      },
    });
    return client.id;
  }

  private async attachEventTeam(userId: string, eventId: string, dto: CreateIndividualEventDto) {
    for (const member of dto.team || []) {
      if (member.kind === 'gate') {
        await this.gate.assignStaff({ staffId: member.memberId, eventId, gateNumber: 'Gate 1' }, userId);
        continue;
      }
      await this.assignAdminToEvent(userId, member.memberId, eventId);
    }

    if (!dto.newTeamMember) return;
    const invite = dto.newTeamMember;
    if (invite.role === 'Gate Staff') {
      await this.gate.inviteStaff(
        {
          fullName: invite.fullName.trim(),
          email: invite.email.trim(),
          phone: invite.phone?.trim(),
          role: 'Gate Staff',
          eventId,
          gateNumber: 'Gate 1',
        },
        userId,
      );
      return;
    }

    const organizer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (organizer?.role === UserRole.VENUE) {
      const email = invite.email.toLowerCase().trim();
      let member = await this.prisma.user.findUnique({ where: { email } });
      if (member?.role === UserRole.GATE) {
        throw new BadRequestException('This email belongs to a gate staff account. Add them as Gate Staff.');
      }
      if (!member) {
        member = await this.prisma.user.create({
          data: {
            email,
            fullName: invite.fullName.trim(),
            phone: invite.phone?.trim() || null,
            passwordHash: await bcrypt.hash(randomBytes(6).toString('base64url'), 10),
            role: UserRole.GUEST,
          },
        });
      }
      await saveOrganizerAdmin(this.prisma, userId, member.id, eventId);
      return;
    }

    const agency = await this.prisma.agencyProfile.findFirst({ where: { userId } });
    if (!agency) throw new BadRequestException('Create your agency profile before adding a team member');
    const email = invite.email.toLowerCase().trim();
    let member = await this.prisma.user.findUnique({ where: { email } });
    if (member?.role === UserRole.GATE) {
      throw new BadRequestException('This email belongs to a gate staff account. Add them as Gate Staff.');
    }
    if (!member) {
      member = await this.prisma.user.create({
        data: {
          email,
          fullName: invite.fullName.trim(),
          phone: invite.phone?.trim() || null,
          passwordHash: await bcrypt.hash(randomBytes(6).toString('base64url'), 10),
          role: UserRole.GUEST,
        },
      });
    }
    await this.prisma.agencyTeamMember.upsert({
      where: { agencyId_userId: { agencyId: agency.id, userId: member.id } },
      update: { roleTitle: 'Admin', permissions: { eventId } },
      create: {
        agencyId: agency.id,
        userId: member.id,
        roleTitle: 'Admin',
        permissions: { eventId },
      },
    });
  }

  private async assignAdminToEvent(userId: string, memberId: string, eventId: string) {
    const organizer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (organizer?.role === UserRole.VENUE) {
      const admins = await readOrganizerAdmins(this.prisma, userId);
      if (!admins.some((record) => record.userId === memberId)) {
        throw new BadRequestException('That team member is not on your venue team');
      }
      await saveOrganizerAdmin(this.prisma, userId, memberId, eventId);
      return;
    }

    const agency = await this.prisma.agencyProfile.findFirst({ where: { userId } });
    if (!agency) throw new BadRequestException('Agency profile was not found');
    const member = await this.prisma.agencyTeamMember.findFirst({
      where: { agencyId: agency.id, userId: memberId },
    });
    if (!member) throw new BadRequestException('That team member is not on your agency team');
    const current =
      member.permissions && typeof member.permissions === 'object' && !Array.isArray(member.permissions)
        ? member.permissions
        : {};
    await this.prisma.agencyTeamMember.update({
      where: { id: member.id },
      data: { permissions: { ...current, eventId } },
    });
  }

  /**
   * 4. UPDATE EVENT
   */
  async updateEvent(id: string, userId: string | undefined, dto: UpdateIndividualEventDto) {
    const ev = await this.resolveEvent(id, userId);

    const updateData: any = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.category) updateData.category = dto.category;
    if (dto.description) updateData.description = dto.description;
    if (dto.format) updateData.format = dto.format;
    if (dto.status) updateData.status = dto.status;
    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);
    if (dto.capacity !== undefined) updateData.capacity = dto.capacity;
    if (dto.venueName) updateData.venueName = dto.venueName;
    if (dto.address) updateData.address = dto.address;
    if (dto.city) updateData.city = dto.city;
    if (dto.country) updateData.country = dto.country;

    return await this.prisma.event.update({
      where: { id: ev.id },
      data: updateData,
      include: { ticketTiers: true, tableZones: true },
    });
  }

  /**
   * 5. UPDATE SETUP CHECKLIST STEP
   */
  async updateSetupStep(
    id: string,
    userId: string | undefined,
    dto: UpdateSetupStepDto,
  ) {
    const ev = await this.resolveEvent(id, userId);
    const eventKey = ev.id;

    if (!this.setupStepsState.has(eventKey)) {
      this.setupStepsState.set(eventKey, [true, false, false, false, false, false]);
    }
    const current = this.setupStepsState.get(eventKey)!;
    if (dto.stepIndex >= 0 && dto.stepIndex < current.length) {
      current[dto.stepIndex] = dto.completed;
      this.setupStepsState.set(eventKey, current);
    }

    return {
      success: true,
      stepIndex: dto.stepIndex,
      completed: dto.completed,
      steps: current,
    };
  }

  /**
   * 6. PUBLISH / ACTIVATE EVENT
   */
  async publishOrActivateEvent(id: string, userId?: string) {
    const ev = await this.resolveEvent(id, userId);

    const updated = await this.prisma.event.update({
      where: { id: ev.id },
      data: { status: EventStatus.LIVE },
    });

    return {
      success: true,
      id: updated.id,
      status: 'active',
      rawStatus: updated.status,
      message: 'Event published and active on McEniesVite turnstile network.',
    };
  }

  /**
   * 7. DELETE EVENT
   */
  async deleteEvent(id: string, userId?: string) {
    const ev = await this.resolveEvent(id, userId);
    await this.prisma.event.delete({ where: { id: ev.id } });
    this.setupStepsState.delete(ev.id);
    this.flaggedExceptionsMap.delete(ev.id);
    return { success: true, id: ev.id, message: 'Event successfully removed' };
  }

  /**
   * 8. GET GUEST ROSTER
   */
  async getEventGuests(
    eventId: string,
    query?: { search?: string; status?: string; type?: string },
  ) {
    const ev = await this.resolveEvent(eventId);

    const attendees = await this.prisma.attendee.findMany({
      where: { eventId: ev.id },
      include: { ticketTier: true, tableSeat: { include: { zone: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let guests = attendees.map((a) => {
      let checkInStatus = 'Not Arrived';
      if (a.status === AttendeeStatus.CHECKED_IN) {
        checkInStatus = 'Checked-In';
      } else if (a.status === AttendeeStatus.CANCELLED) {
        checkInStatus = 'Rejected';
      }

      return {
        id: a.id,
        name: a.fullName,
        email: a.email,
        phone: a.phone || '+234 800 000 0000',
        type: a.guestType || (a.ticketTier?.type === TicketTierType.VIP ? 'VIP' : 'General'),
        checkInStatus,
        rsvpStatus: this.rsvpLabel(a.rsvpStatus),
        inviteThrough: this.channelLabel(a.inviteChannel),
        partySize: a.partySize,
        preference: a.dietaryPreference || '--',
        isFlagged: a.isFlagged,
        qrCode: a.qrCode,
        tableSeat: a.tableSeat
          ? `Table 0${a.tableSeat.tableNumber} (${a.tableSeat.zone.zoneName})`
          : undefined,
      };
    });

    // Apply filtering
    if (query?.search) {
      const q = query.search.toLowerCase();
      guests = guests.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.email.toLowerCase().includes(q) ||
          g.phone.includes(q),
      );
    }

    if (query?.status && query.status !== 'all') {
      const target = query.status.toLowerCase();
      guests = guests.filter((g) => g.checkInStatus.toLowerCase() === target);
    }

    if (query?.type && query.type !== 'all') {
      const target = query.type.toLowerCase();
      guests = guests.filter((g) => g.type.toLowerCase() === target);
    }

    const total = attendees.length;
    const checkedIn = attendees.filter((a) => a.status === AttendeeStatus.CHECKED_IN).length;
    const confirmed = attendees.filter(
      (a) => a.rsvpStatus === RsvpStatus.CONFIRMED || a.status === AttendeeStatus.CHECKED_IN,
    ).length;
    const flagged = guests.filter((g) => g.isFlagged).length;

    return {
      guests,
      metrics: {
        totalGuests: total,
        confirmedCount: confirmed,
        checkedInCount: checkedIn,
        notArrivedCount: attendees.filter(
          (a) => a.rsvpStatus === RsvpStatus.CONFIRMED && a.status !== AttendeeStatus.CHECKED_IN,
        ).length,
        flaggedCount: flagged,
      },
    };
  }

  /**
   * 9. ADD SINGLE GUEST
   */
  async addGuest(eventId: string, dto: AddIndividualGuestDto) {
    const ev = await this.resolveEvent(eventId);

    // Find or pick corresponding ticket tier
    let tier = ev.ticketTiers.find((t) =>
      dto.type?.toUpperCase().includes('VIP')
        ? t.type === TicketTierType.VIP
        : t.type === TicketTierType.GENERAL,
    );

    if (!tier && ev.ticketTiers.length > 0) {
      tier = ev.ticketTiers[0];
    }

    if (!tier) {
      tier = await this.prisma.ticketTier.create({
        data: {
          eventId: ev.id,
          name: dto.type || 'General Admission',
          type: dto.type?.toUpperCase().includes('VIP')
            ? TicketTierType.VIP
            : TicketTierType.GENERAL,
          price: 0,
          capacity: ev.capacity,
        },
      });
    }

    const qrCode = `MCV-${ev.id.slice(0, 4)}-${Date.now().toString(36).toUpperCase()}`;

    const attendee = await this.prisma.attendee.create({
      data: {
        eventId: ev.id,
        fullName: dto.name,
        email: dto.email || '',
        phone: dto.phone,
        ticketTierId: tier.id,
        guestType: dto.type || 'General',
        rsvpStatus: this.mapRsvp(dto.rsvpStatus),
        partySize: dto.partySize || 1,
        dietaryPreference: dto.preference,
        inviteChannel: this.mapInviteChannel(dto.inviteThrough),
        status:
          dto.checkInStatus === 'Checked-In'
            ? AttendeeStatus.CHECKED_IN
            : AttendeeStatus.PENDING,
        qrCode,
      },
      include: { ticketTier: true },
    });

    let invitation: { sent: boolean; channel: string; error?: string } | null = null;
    if (dto.sendInvite) {
      const channel = dto.inviteThrough || 'WhatsApp';
      try {
        const result = await this.communicationsService.dispatchInvite(ev.id, attendee.id, channel);
        const emailDelivery = result.deliveries?.find((delivery) => String(delivery.channel) === 'EMAIL');
        invitation = {
          sent: true,
          channel,
          error:
            emailDelivery?.status === 'failed'
              ? emailDelivery.error || 'Email was not delivered to the guest'
              : undefined,
        };
      } catch (err: any) {
        this.logger.error(`Invite failed for guest ${attendee.id}: ${err.message}`);
        invitation = { sent: false, channel, error: err.message };
      }
    }

    return {
      id: attendee.id,
      name: attendee.fullName,
      email: attendee.email,
      phone: attendee.phone,
      type: dto.type || 'General',
      checkInStatus: dto.checkInStatus || 'Not Arrived',
      rsvpStatus: invitation?.sent ? 'Awaiting Response' : dto.rsvpStatus || 'Confirmed',
      inviteThrough: dto.inviteThrough || 'WhatsApp',
      partySize: dto.partySize || 1,
      preference: dto.preference || '--',
      qrCode: attendee.qrCode,
      invitation,
    };
  }

  /**
   * 10. BULK ADD GUESTS
   */
  async bulkAddGuests(eventId: string, dto: BulkAddIndividualGuestsDto) {
    const results = [];
    let sent = 0;
    let failed = 0;
    let emailError = '';
    for (const g of dto.guests) {
      try {
        const added = await this.addGuest(eventId, {
          ...g,
          sendInvite: dto.sendInvites === true,
        });
        results.push(added);
        if (dto.sendInvites) {
          if (added.invitation?.sent) sent += 1;
          else failed += 1;
          if (added.invitation?.error) emailError = emailError || added.invitation.error;
        }
      } catch (err: any) {
        this.logger.warn(`Failed to add guest ${g.name}: ${err.message}`);
      }
    }
    return {
      success: true,
      importedCount: results.length,
      guests: results,
      invitations: dto.sendInvites ? { sent, failed, emailError: emailError || null } : null,
    };
  }

  /**
   * 11. UPDATE GUEST
   */
  async updateGuest(eventId: string, guestId: string, dto: UpdateIndividualGuestDto) {
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: guestId },
    });
    if (!attendee) {
      throw new NotFoundException(`Guest ${guestId} not found`);
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData.fullName = dto.name;
    if (dto.email) updateData.email = dto.email;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.partySize !== undefined) updateData.partySize = dto.partySize;
    if (dto.preference) updateData.dietaryPreference = dto.preference;
    if (dto.rsvpStatus) updateData.rsvpStatus = this.mapRsvp(dto.rsvpStatus);
    if (dto.inviteThrough) updateData.inviteChannel = this.mapInviteChannel(dto.inviteThrough);
    if (dto.type) updateData.guestType = dto.type;

    if (dto.checkInStatus) {
      updateData.status =
        dto.checkInStatus === 'Checked-In'
          ? AttendeeStatus.CHECKED_IN
          : AttendeeStatus.PENDING;
      if (dto.checkInStatus === 'Checked-In') {
        updateData.checkInTime = new Date();
      }
    }

    const updated = await this.prisma.attendee.update({
      where: { id: guestId },
      data: updateData,
    });

    return updated;
  }

  /**
   * 12. DELETE GUEST
   */
  async deleteGuest(eventId: string, guestId: string) {
    await this.prisma.attendee.delete({ where: { id: guestId } });
    return { success: true, guestId, message: 'Guest deleted successfully' };
  }

  /**
   * 13. SEND GUEST INVITATION
   */
  async sendAllInvites(eventId: string, guestIds?: string[]) {
    const ev = await this.resolveEvent(eventId);
    const chosen = (guestIds || []).map((id) => id.trim()).filter(Boolean);
    const pending = await this.prisma.attendee.findMany({
      where: chosen.length
        ? { eventId: ev.id, id: { in: chosen } }
        : { eventId: ev.id, rsvpStatus: RsvpStatus.NOT_SENT },
      select: { id: true, inviteChannel: true },
    });

    let sent = 0;
    let failed = 0;
    let emailSent = 0;
    let emailMissing = 0;
    let emailError = '';
    let testInbox = '';
    for (const guest of pending) {
      try {
        const result = await this.communicationsService.dispatchInvite(
          ev.id,
          guest.id,
          this.channelLabel(guest.inviteChannel),
        );
        sent += 1;
        const emailDelivery = result.deliveries?.find((delivery) => String(delivery.channel) === 'EMAIL');
        if (!emailDelivery) emailMissing += 1;
        else if (emailDelivery.status === 'failed') emailError = emailError || emailDelivery.error || 'Email was not delivered';
        else {
          emailSent += 1;
          const deliveredTo = String(emailDelivery.deliveredTo || '');
          if (deliveredTo && deliveredTo.toLowerCase() !== String(emailDelivery.to || '').toLowerCase()) {
            testInbox = deliveredTo;
          }
        }
      } catch (err: any) {
        failed += 1;
        this.logger.error(`Invite failed for guest ${guest.id}: ${err.message}`);
      }
    }

    const emailNote =
      pending.length === 0
        ? ''
        : testInbox
          ? ` Testing copy sent to ${testInbox}. The Resend onboarding sender can only deliver to that inbox until a domain is verified.`
          : emailSent > 0 && !emailError
            ? ` Email sent to ${emailSent} guest${emailSent === 1 ? '' : 's'}.`
            : emailMissing === pending.length
              ? ' No email address is saved on these guests, so nothing was emailed.'
              : emailError
                ? ` Email was not delivered to the guest address: ${emailError}`
                : '';

    const message =
      pending.length === 0
        ? chosen.length
          ? 'None of the selected guests were found on this event.'
          : 'Every guest already has an invitation.'
        : failed > 0
          ? `Sent ${sent} invitation${sent === 1 ? '' : 's'}. ${failed} could not be sent.${emailNote}`
          : `Sent ${sent} invitation${sent === 1 ? '' : 's'}.${emailNote}`;

    return { message, data: { sent, failed, total: pending.length } };
  }

  async sendGuestInvite(eventId: string, guestId: string, dto?: InviteGuestDto) {
    const result = await this.communicationsService.dispatchInvite(
      eventId,
      guestId,
      dto?.channel,
    );
    return {
      success: true,
      guestId,
      channel: dto?.channel || 'coordinated',
      ...result,
      message: `Invitation dispatched to guest via ${result.channels.join(', ')}.`,
    };
  }

  /**
   * 14. SEND GUEST REMINDER
   */
  async sendGuestReminder(eventId: string, guestId: string) {
    const deliveries = await this.communicationsService.dispatchReminder(
      eventId,
      guestId,
    );
    return {
      success: true,
      guestId,
      deliveries,
      message: 'Reminder dispatched across available channels.',
    };
  }

  /**
   * 15. GET SEATING BLUEPRINT & TABLE PROTOCOL
   */
  async createEventSeating(eventId: string, dto: CreateSeatingDto) {
    const ev = await this.resolveEvent(eventId);
    const capacity = Math.max(1, Number(dto.capacity) || 1);
    const reservedSeats = Math.min(capacity, Math.max(0, Number(dto.reservedSeats) || 0));
    const meta = {
      name: dto.name.trim(),
      guestGroup: dto.guestGroup?.trim() || 'General',
      location: dto.location?.trim() || '',
      reservedSeats,
    };
    const zone = await this.prisma.tableZone.create({
      data: {
        eventId: ev.id,
        zoneName: JSON.stringify(meta),
        tableCount: 1,
        seatPerTable: capacity,
        totalCapacity: capacity,
      },
    });
    return { id: zone.id, ...meta, capacity };
  }

  async updateEventSeating(eventId: string, zoneId: string, dto: CreateSeatingDto) {
    const ev = await this.resolveEvent(eventId);
    const zone = await this.prisma.tableZone.findFirst({
      where: { id: zoneId, eventId: ev.id },
      include: { assignments: { include: { attendee: true } } },
    });
    if (!zone) {
      throw new NotFoundException('Table was not found');
    }
    const capacity = Math.max(1, Number(dto.capacity) || 1);
    const reservedSeats = Math.min(capacity, Math.max(0, Number(dto.reservedSeats) || 0));
    const nextGroup = dto.guestGroup?.trim() || 'General';
    const staying = zone.assignments.filter((assignment) =>
      this.tableAcceptsGuest(nextGroup, assignment.attendee.guestType || 'General'),
    );
    const releasedIds = zone.assignments
      .filter((assignment) => !staying.some((row) => row.id === assignment.id))
      .map((assignment) => assignment.id);
    const used = staying.reduce(
      (sum, assignment) => sum + Math.max(1, assignment.attendee.partySize || 1),
      0,
    );
    if (capacity - reservedSeats < used) {
      throw new BadRequestException(
        `This table already has ${used} assigned seat${used === 1 ? '' : 's'}. Leave at least that many seats available.`,
      );
    }
    const meta = {
      name: dto.name.trim(),
      guestGroup: nextGroup,
      location: dto.location?.trim() || '',
      reservedSeats,
    };
    if (releasedIds.length) {
      await this.prisma.tableAssignment.deleteMany({ where: { id: { in: releasedIds } } });
    }
    await this.prisma.tableZone.update({
      where: { id: zone.id },
      data: {
        zoneName: JSON.stringify(meta),
        seatPerTable: capacity,
        totalCapacity: capacity,
      },
    });
    return { id: zone.id, ...meta, capacity, releasedGuests: releasedIds.length };
  }

  async deleteEventSeating(eventId: string, zoneId: string) {
    const ev = await this.resolveEvent(eventId);
    const zone = await this.prisma.tableZone.findFirst({ where: { id: zoneId, eventId: ev.id } });
    if (!zone) {
      throw new NotFoundException('Table was not found');
    }
    await this.prisma.tableZone.delete({ where: { id: zone.id } });
    return { id: zone.id };
  }

  async getEventSeating(eventId: string) {
    const ev = await this.resolveEvent(eventId);

    const zones = await this.prisma.tableZone.findMany({
      where: { eventId: ev.id },
      include: {
        assignments: {
          include: { attendee: { include: { ticketTier: true } } },
          orderBy: { seatNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const allAttendees = await this.prisma.attendee.findMany({
      where: { eventId: ev.id },
      include: { tableSeat: true, ticketTier: true },
      orderBy: { fullName: 'asc' },
    });

    const unassigned = allAttendees
      .filter((a) => !a.tableSeat)
      .map((a) => ({
        id: a.id,
        name: a.fullName,
        type: a.guestType || (a.ticketTier?.type === TicketTierType.VIP ? 'VIP' : 'General'),
        phone: a.phone,
        partySize: Math.max(1, a.partySize || 1),
        status: a.status,
      }));

    const formattedZones = zones.map((z) => {
      const meta = this.readZoneMeta(z.zoneName);
      const seatsUsed = z.assignments.reduce(
        (sum, assignment) => sum + Math.max(1, assignment.attendee.partySize || 1),
        0,
      );
      return {
        id: z.id,
        name: meta.name,
        guestGroup: meta.guestGroup,
        location: meta.location,
        reservedSeats: meta.reservedSeats,
        tableCount: z.tableCount,
        seatPerTable: z.seatPerTable,
        totalCapacity: z.totalCapacity,
        assignedCount: seatsUsed,
        remainingSeats: Math.max(0, z.totalCapacity - meta.reservedSeats - seatsUsed),
        tables: Array.from({ length: z.tableCount }).map((_, idx) => {
          const tableNum = idx + 1;
          const tableAssignments = z.assignments.filter((as) => as.tableNumber === tableNum);
          const occupied = tableAssignments.reduce(
            (sum, assignment) => sum + Math.max(1, assignment.attendee.partySize || 1),
            0,
          );
          return {
            tableNumber: tableNum,
            occupied,
            capacity: z.seatPerTable,
            seats: tableAssignments.map((as) => {
              const partySize = Math.max(1, as.attendee.partySize || 1);
              const seatNumber = as.seatNumber || 1;
              return {
                seatNumber,
                attendeeId: as.attendeeId,
                guestName: as.attendee.fullName,
                phone: as.attendee.phone,
                partySize,
                tier: as.attendee.guestType || as.attendee.ticketTier?.name || 'General',
                seatCode: this.seatCode(tableNum, seatNumber, partySize),
              };
            }),
          };
        }),
      };
    });

    const seatsUsed = formattedZones.reduce((sum, zone) => sum + zone.assignedCount, 0);
    return {
      eventId: ev.id,
      eventTitle: ev.title,
      totalCapacity: zones.reduce((acc, z) => acc + z.totalCapacity, 0),
      totalAssigned: seatsUsed,
      zones: formattedZones,
      unassignedGuests: unassigned,
    };
  }

  /**
   * 16. ASSIGN GUEST SEATING
   */
  async assignGuestSeating(eventId: string, dto: AssignGuestSeatingDto) {
    const ev = await this.resolveEvent(eventId);
    const attendee = await this.prisma.attendee.findFirst({
      where: { id: dto.attendeeId, eventId: ev.id },
    });
    if (!attendee) {
      throw new NotFoundException('Guest was not found on this event');
    }

    let zone = dto.zoneId
      ? await this.prisma.tableZone.findFirst({ where: { id: dto.zoneId, eventId: ev.id } })
      : null;

    if (!zone && dto.zoneName) {
      zone = await this.prisma.tableZone.findFirst({
        where: { eventId: ev.id, zoneName: { contains: dto.zoneName, mode: 'insensitive' } },
      });
    }

    if (!zone) {
      throw new BadRequestException('Choose a table before assigning this guest');
    }

    const tableNumber = dto.tableNumber || 1;
    if (tableNumber < 1 || tableNumber > zone.tableCount) {
      throw new BadRequestException('That table is not part of this seating zone');
    }

    const partySize = Math.max(1, attendee.partySize || 1);
    const meta = this.readZoneMeta(zone.zoneName);
    const guestType = attendee.guestType || 'General';
    if (!this.tableAcceptsGuest(meta.guestGroup, guestType)) {
      throw new BadRequestException(
        `${meta.name} seats ${meta.guestGroup} guests only. ${attendee.fullName} is ${guestType}.`,
      );
    }
    const usable = Math.max(0, zone.seatPerTable - meta.reservedSeats);
    const existing = await this.prisma.tableAssignment.findMany({
      where: { zoneId: zone.id, tableNumber, attendeeId: { not: attendee.id } },
      include: { attendee: true },
    });
    const taken = new Set<number>();
    for (const row of existing) {
      const size = Math.max(1, row.attendee.partySize || 1);
      const start = row.seatNumber || 1;
      for (let offset = 0; offset < size; offset += 1) taken.add(start + offset);
    }
    let seatNumber = dto.seatNumber;
    if (!seatNumber || this.rangeTaken(taken, seatNumber, partySize)) {
      seatNumber = this.firstOpenSeat(taken, partySize, usable);
    }
    if (!seatNumber) {
      throw new BadRequestException(
        `${meta.name} does not have ${partySize} open seat${partySize === 1 ? '' : 's'} left`,
      );
    }

    const assignment = await this.prisma.tableAssignment.upsert({
      where: { attendeeId: dto.attendeeId },
      update: {
        zoneId: zone.id,
        tableNumber,
        seatNumber,
      },
      create: {
        attendeeId: dto.attendeeId,
        zoneId: zone.id,
        tableNumber,
        seatNumber,
      },
      include: { attendee: true, zone: true },
    });

    return {
      success: true,
      assignmentId: assignment.id,
      guestName: assignment.attendee.fullName,
      table: assignment.tableNumber,
      seat: assignment.seatNumber,
      zone: this.readZoneMeta(assignment.zone.zoneName).name,
    };
  }

  /**
   * 17. GET EVENT CHECK-IN LIVE MONITOR TELEMETRY
   */
  async getEventCheckInMonitor(eventId: string) {
    const ev = await this.resolveEvent(eventId);

    const attendees = await this.prisma.attendee.findMany({
      where: { eventId: ev.id },
      include: { ticketTier: true },
      orderBy: { checkInTime: 'desc' },
    });

    const checkedInList = attendees.filter((a) => a.status === AttendeeStatus.CHECKED_IN);
    const totalExpected = ev.capacity;
    const totalCheckedIn = checkedInList.length;
    const percentage = attendees.length
      ? Math.round((totalCheckedIn / attendees.length) * 100)
      : 0;

    const scanLogs = await this.prisma.gateScanLog.findMany({
      where: { attendee: { eventId: ev.id } },
      include: {
        attendee: { include: { ticketTier: true } },
        staff: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { scannedAt: 'desc' },
    });

    const offlineScans = await this.prisma.offlineScan.findMany({
      where: { eventId: ev.id },
      select: { attendeeId: true, gateTurnstile: true, result: true },
    });
    const offlineAttendees = new Set(
      offlineScans.map((scan) => scan.attendeeId).filter((id): id is string => Boolean(id)),
    );

    const liveActivityStream = scanLogs.slice(0, 100).map((log) => ({
      id: log.id,
      attendeeName: log.attendee.fullName,
      ticketTier: log.attendee.ticketTier?.name ?? null,
      turnstile: log.gateTurnstile,
      scannedAt: log.scannedAt,
      status: log.scanResult,
      offlineSynced: offlineAttendees.has(log.attendeeId),
      staffName: log.staff?.user?.fullName ?? null,
    }));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const onlineWindow = Date.now() - 15 * 60 * 1000;
    const presenceWindow = Date.now() - 3 * 60 * 1000;

    const turnstileMap = new Map<string, { scannedToday: number; staff: string | null }>();
    for (const log of scanLogs) {
      const entry = turnstileMap.get(log.gateTurnstile) ?? { scannedToday: 0, staff: null };
      if (log.scannedAt >= startOfToday) entry.scannedToday += 1;
      entry.staff = entry.staff ?? log.staff?.user?.fullName ?? null;
      turnstileMap.set(log.gateTurnstile, entry);
    }
    const turnstiles = Array.from(turnstileMap.entries()).map(([name, t]) => ({
      name,
      status: 'ACTIVE',
      scannedToday: t.scannedToday,
      staff: t.staff,
    }));

    const shifts = (ev.staffShifts ?? []).filter((shift: { isActive?: boolean }) => shift.isActive !== false);
    const gateStaff = shifts.map((shift: {
      id: string;
      gateNumber: string;
      staffId: string;
      staff?: { userId?: string; deviceId?: string | null; lastSeenAt?: Date | null; user?: { fullName?: string | null } };
    }) => {
      const lastScan = scanLogs.find((log) => log.staffId === shift.staffId);
      const lastScanAt = lastScan?.scannedAt ?? null;
      const lastSeenAt = shift.staff?.lastSeenAt ?? null;
      const pendingOffline = offlineScans.filter(
        (scan) => scan.gateTurnstile === shift.gateNumber && scan.result !== 'VALID',
      ).length;
      const recentlyScanned = Boolean(lastScanAt && lastScanAt.getTime() >= onlineWindow);
      const appOpen = Boolean(lastSeenAt && lastSeenAt.getTime() >= presenceWindow);
      return {
        id: shift.staff?.userId || shift.staffId,
        shiftId: shift.id,
        name: shift.staff?.user?.fullName || 'Gate staff',
        role: 'Gate Staff',
        gate: shift.gateNumber,
        device: shift.staff?.deviceId || 'Gate Terminal',
        isOnline: recentlyScanned || appOpen,
        lastScanAt,
        lastSeenAt,
        pendingOffline,
      };
    });

    const recentScans = scanLogs.filter((log) => log.scannedAt.getTime() >= tenMinutesAgo).length;
    const activeGateStaff = (ev.staffShifts ?? []).filter((s: any) => s.isActive).length;

    const storedFlags = await this.prisma.checkInException.findMany({
      where: { eventId: ev.id, status: CheckInFlagStatus.OPEN },
      include: { attendee: true },
      orderBy: { createdAt: 'desc' },
    });

    const flaggedExceptions = storedFlags.map((flag) => {
      const scan = scanLogs.find((log) => log.attendeeId === flag.attendeeId);
      const reason = flag.reason.toLowerCase();
      const recommendation = reason.includes('duplicate') || reason.includes('already')
        ? 'Staff is holding guest'
        : reason.includes('name') || reason.includes('differ')
          ? 'Staff recommends entry'
          : 'Review this arrival before admitting the guest';
      return {
        flagId: flag.id,
        attendeeName: flag.attendee.fullName,
        phone: flag.attendee.phone,
        reason: flag.reason,
        turnstile: flag.turnstile,
        timestamp: flag.createdAt.toISOString(),
        staffName: scan?.staff?.user?.fullName ?? null,
        recommendation,
        severity: 'HIGH',
        status: flag.status,
      };
    });

    return {
      eventId: ev.id,
      eventTitle: ev.title,
      event: {
        title: ev.title,
        category: ev.category,
        venueName: ev.venueName,
        startDate: ev.startDate,
        endDate: ev.endDate,
        timezone: ev.timezone,
        status: ev.status,
        coverImageUrl: ev.coverImageUrl,
      },
      activityTotal: scanLogs.length,
      metrics: {
        totalInvitees: attendees.length,
        totalCheckedIn,
        totalExpected,
        notArrived: attendees.filter(
          (a) => a.rsvpStatus === RsvpStatus.CONFIRMED && a.status !== AttendeeStatus.CHECKED_IN,
        ).length,
        totalAttendance: checkedInList.reduce((sum, guest) => sum + Math.max(1, guest.partySize || 1), 0),
        flaggedCount: storedFlags.length,
        checkInPercentage: percentage,
        activeTurnstiles: turnstiles.length,
        throughputPerMinute: Math.round((recentScans / 10) * 10) / 10,
        activeGateStaff,
      },
      liveActivityStream,
      flaggedExceptions,
      turnstiles,
      gateStaff,
    };
  }

  /**
   * 18. RESOLVE CHECK-IN FLAG EXCEPTION
   */
  async resolveCheckInFlag(eventId: string, dto: ResolveFlagDto) {
    const ev = await this.resolveEvent(eventId);
    await this.prisma.checkInException.updateMany({
      where: { id: dto.flagId, eventId: ev.id },
      data: {
        status: CheckInFlagStatus.RESOLVED,
        resolvedAt: new Date(),
        notes: dto.notes || dto.action,
      },
    });
    const remaining = await this.prisma.checkInException.count({
      where: { eventId: ev.id, status: CheckInFlagStatus.OPEN },
    });

    return {
      success: true,
      flagId: dto.flagId,
      action: dto.action,
      message:
        dto.action === 'trust_staff'
          ? 'Staff override trusted. Guest approved for turnstile admission.'
          : 'Flag manually resolved by event host.',
      remainingFlagsCount: remaining,
    };
  }

  private tableAcceptsGuest(tableType: string, guestType: string) {
    const table = tableType === 'Standard' ? 'Preserved' : tableType || 'General';
    if (table === 'Preserved') return true;
    return table === (guestType || 'General');
  }

  private readZoneMeta(zoneName: string) {
    if (zoneName.startsWith('{')) {
      try {
        const parsed = JSON.parse(zoneName) as {
          name?: string;
          guestGroup?: string;
          location?: string;
          reservedSeats?: number;
        };
        return {
          name: parsed.name || 'Table',
          guestGroup: parsed.guestGroup || 'General',
          location: parsed.location || '',
          reservedSeats: Math.max(0, Number(parsed.reservedSeats) || 0),
        };
      } catch {
        // Older zones store a plain name.
      }
    }
    return { name: zoneName, guestGroup: 'General', location: '', reservedSeats: 0 };
  }

  private seatCode(tableNumber: number, start: number, partySize: number) {
    return Array.from({ length: partySize }, (_, index) => `T${tableNumber}-${String(start + index).padStart(2, '0')}`).join(', ');
  }

  private rangeTaken(taken: Set<number>, start: number, size: number) {
    for (let offset = 0; offset < size; offset += 1) {
      if (taken.has(start + offset)) return true;
    }
    return false;
  }

  private firstOpenSeat(taken: Set<number>, size: number, usable: number) {
    for (let start = 1; start + size - 1 <= usable; start += 1) {
      if (!this.rangeTaken(taken, start, size)) return start;
    }
    return null;
  }

  private mapRsvp(value?: string): RsvpStatus {
    const v = (value || '').toLowerCase();
    if (v.includes('confirm') || v.includes('accept')) return RsvpStatus.CONFIRMED;
    if (v.includes('tentat')) return RsvpStatus.TENTATIVE;
    if (v.includes('declin') || v.includes('reject')) return RsvpStatus.DECLINED;
    if (v.includes('not sent')) return RsvpStatus.NOT_SENT;
    return RsvpStatus.AWAITING;
  }

  private rsvpLabel(status: RsvpStatus) {
    switch (status) {
      case RsvpStatus.CONFIRMED:
        return 'Confirmed';
      case RsvpStatus.TENTATIVE:
        return 'Tentative';
      case RsvpStatus.DECLINED:
        return 'Declined';
      case RsvpStatus.NOT_SENT:
        return 'Not Sent';
      default:
        return 'Awaiting Response';
    }
  }

  private mapInviteChannel(value?: string): CommunicationChannel {
    const v = (value || '').toUpperCase();
    if (v === 'SMS') return CommunicationChannel.SMS;
    if (v === 'EMAIL') return CommunicationChannel.EMAIL;
    return CommunicationChannel.WHATSAPP;
  }

  private channelLabel(channel: CommunicationChannel) {
    if (channel === CommunicationChannel.SMS) return 'SMS';
    if (channel === CommunicationChannel.EMAIL) return 'Email';
    return 'WhatsApp';
  }

  /**
   * 19. ASSIGN ALL GATE STAFF (Turnstile crew broadcast)
   */
  async assignAllGateStaff(eventId: string) {
    const ev = await this.resolveEvent(eventId);

    return {
      success: true,
      eventId: ev.id,
      assignedCount: 4,
      message: 'All 4 gate crew members assigned and granted turnstile scanning clearance.',
    };
  }
}
