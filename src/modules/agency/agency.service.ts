import { BadRequestException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { AttendeeStatus, EventStatus, InvoiceStatus, OrderStatus, Prisma, RsvpStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { IndividualGateService } from '../individual/individual-gate.service';
import { CreateClientDto, UpdateClientDto } from './dto/create-client.dto';
import { AssignTeamMemberDto, InviteTeamMemberDto } from './dto/invite-team.dto';
import { readOrganizerAdmins, saveOrganizerAdmin } from './organizer-admins';

@Injectable()
export class AgencyService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(IndividualGateService) private readonly gate: IndividualGateService,
  ) {}

  async getClients(userId?: string, role?: string) {
    const where =
      role !== 'ADMIN' && userId
        ? { agencyId: (await this.prisma.agencyProfile.findFirst({ where: { userId } }))?.id || '__none__' }
        : undefined;
    if (where?.agencyId === '__none__') return [];
    const clients = await this.prisma.agencyClient.findMany({
      where,
      include: { _count: { select: { events: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const notes = await this.noteMap(clients.map((client) => client.id));
    return clients.map((client) =>
      this.toClientRow({ ...client, notes: notes.get(client.id) ?? null }, client._count.events),
    );
  }

  async getClient(userId: string, clientId: string) {
    const client = await this.ownedClient(userId, clientId);
    const now = new Date();
    const events = [...client.events].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    const completed = events.filter((event) => event.status === EventStatus.COMPLETED);
    const upcoming = events.filter(
      (event) =>
        event.startDate >= now &&
        event.status !== EventStatus.COMPLETED &&
        event.status !== EventStatus.CANCELLED &&
        event.status !== EventStatus.ARCHIVED,
    );
    const activity = events
      .flatMap((event) => {
        const created = {
          id: `created-${event.id}`,
          title: 'Event created',
          detail: event.title,
          occurredAt: event.createdAt.toISOString(),
        };
        if (event.status !== EventStatus.COMPLETED) return [created];
        return [
          created,
          {
            id: `completed-${event.id}`,
            title: 'Event completed',
            detail: event.title,
            occurredAt: event.updatedAt.toISOString(),
          },
        ];
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 8);

    const notes = await this.noteMap([client.id]);
    return {
      ...this.toClientRow({ ...client, notes: notes.get(client.id) ?? null }, events.length),
      summary: {
        totalEvents: events.length,
        upcoming: upcoming.length,
        completed: completed.length,
      },
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        startDate: event.startDate.toISOString(),
        venueName: event.venueName,
        city: event.city,
        status: event.status,
        uiStatus: this.eventUiStatus(event.status),
        coverImageUrl: event.coverImageUrl,
      })),
      activity,
    };
  }

  async updateClient(userId: string, clientId: string, dto: UpdateClientDto) {
    await this.ownedClient(userId, clientId);
    const client = await this.prisma.agencyClient.update({
      where: { id: clientId },
      data: {
        name: dto.name?.trim() || undefined,
        industry: dto.industry?.trim() ?? undefined,
        contactPerson: dto.contactPerson?.trim() || dto.name?.trim() || undefined,
        contactEmail: dto.contactEmail?.trim() || undefined,
        contactPhone: dto.contactPhone?.trim() || undefined,
      },
      include: { _count: { select: { events: true } } },
    });
    if (dto.notes !== undefined) await this.writeNotes(clientId, dto.notes.trim());
    const notes = await this.noteMap([client.id]);
    return this.toClientRow({ ...client, notes: notes.get(client.id) ?? null }, client._count.events);
  }

  async archiveClient(userId: string, clientId: string) {
    await this.ownedClient(userId, clientId);
    const client = await this.prisma.agencyClient.update({
      where: { id: clientId },
      data: { status: 'archived' },
      include: { _count: { select: { events: true } } },
    });
    return this.toClientRow(client, client._count.events);
  }

  private toClientRow(
    client: {
      id: string;
      name: string;
      industry: string;
      contactPerson: string;
      contactEmail: string;
      contactPhone: string | null;
      notes?: string | null;
      status: string;
      createdAt: Date;
    },
    totalEvents: number,
  ) {
    return {
      id: client.id,
      name: client.name,
      industry: client.industry,
      contactPerson: client.contactPerson,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone,
      notes: client.notes ?? null,
      status: client.status,
      createdAt: client.createdAt.toISOString(),
      totalEvents,
    };
  }

  private async noteMap(ids: string[]) {
    if (!ids.length) return new Map<string, string | null>();
    const rows = await this.prisma.$queryRaw<Array<{ id: string; notes: string | null }>>(
      Prisma.sql`SELECT "id", "notes" FROM "AgencyClient" WHERE "id" IN (${Prisma.join(ids)})`,
    );
    return new Map(rows.map((row) => [row.id, row.notes]));
  }

  private async writeNotes(id: string, notes: string) {
    await this.prisma.$executeRaw`UPDATE "AgencyClient" SET "notes" = ${notes} WHERE "id" = ${id}`;
  }

  private eventUiStatus(status: EventStatus) {
    if (status === EventStatus.COMPLETED) return 'Completed';
    if (status === EventStatus.LIVE || status === EventStatus.PUBLISHED) return 'Confirmed';
    if (status === EventStatus.CANCELLED || status === EventStatus.ARCHIVED) return 'Archive';
    return 'Planning';
  }

  private async ownedClient(userId: string, clientId: string) {
    const agency = await this.prisma.agencyProfile.findFirst({ where: { userId } });
    if (!agency) throw new NotFoundException('Agency profile was not found');
    const client = await this.prisma.agencyClient.findFirst({
      where: { id: clientId, agencyId: agency.id },
      include: { events: true },
    });
    if (!client) throw new NotFoundException('Client was not found');
    return client;
  }

  async createClient(userId: string, dto: CreateClientDto) {
    let agency = await this.prisma.agencyProfile.findFirst({
      where: { userId },
    });

    if (!agency) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      agency = await this.prisma.agencyProfile.create({
        data: {
          userId,
          agencyName: `${user?.fullName || 'Production'} Agency`,
          billingEmail: user?.email || 'billing@agency.com',
        },
      });
    }

    const name = dto.name.trim();
    const created = await this.prisma.agencyClient.create({
      data: {
        agencyId: agency.id,
        name,
        industry: dto.industry?.trim() || '',
        contactPerson: dto.contactPerson?.trim() || name,
        contactEmail: dto.contactEmail.trim(),
        contactPhone: dto.contactPhone?.trim() || null,
        contractTotal: dto.contractTotal ?? 0,
        currency: dto.currency || 'NGN',
      },
    });
    const notes = dto.notes?.trim() || null;
    if (notes) await this.writeNotes(created.id, notes);
    return { ...created, notes };
  }

  async getInvoices(userId?: string, role?: string) {
    if (role !== 'ADMIN' && userId) {
      const agency = await this.prisma.agencyProfile.findFirst({ where: { userId } });
      if (!agency) return [];
      return this.prisma.agencyInvoice.findMany({
        where: { agencyId: agency.id },
        include: {
          client: { select: { name: true, contactEmail: true } },
          event: { select: { title: true } },
        },
        orderBy: { issueDate: 'desc' },
      });
    }

    return this.prisma.agencyInvoice.findMany({
      where: undefined,
      include: {
        client: { select: { name: true, contactEmail: true } },
        event: { select: { title: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        agencyProfile: { select: { id: true, agencyName: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Organizer not found');
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const next30Days = new Date(startOfToday);
    next30Days.setDate(next30Days.getDate() + 30);

    const agencyId = user.agencyProfile?.id;
    const openEvent = {
      organizerId: userId,
      status: { notIn: [EventStatus.CANCELLED, EventStatus.ARCHIVED, EventStatus.COMPLETED] },
    };

    const [
      totalEvents,
      eventsThisMonth,
      upcomingCount,
      activeClients,
      teamMembers,
      upcomingEvents,
      recentClients,
      recentInvoices,
      recentTeam,
    ] = await Promise.all([
      this.prisma.event.count({
        where: {
          organizerId: userId,
          status: { notIn: [EventStatus.CANCELLED, EventStatus.ARCHIVED] },
        },
      }),
      this.prisma.event.count({
        where: {
          organizerId: userId,
          createdAt: { gte: startOfMonth },
          status: { notIn: [EventStatus.CANCELLED, EventStatus.ARCHIVED] },
        },
      }),
      this.prisma.event.count({
        where: {
          ...openEvent,
          startDate: { gte: startOfToday, lte: next30Days },
        },
      }),
      agencyId
        ? this.prisma.agencyClient.count({
            where: { agencyId, status: { equals: 'active', mode: 'insensitive' } },
          })
        : Promise.resolve(0),
      agencyId
        ? this.prisma.agencyTeamMember.count({ where: { agencyId } })
        : Promise.resolve(0),
      this.prisma.event.findMany({
        where: { ...openEvent, endDate: { gte: startOfToday } },
        orderBy: { startDate: 'asc' },
        take: 4,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          startDate: true,
          agencyClient: { select: { name: true } },
        },
      }),
      agencyId
        ? this.prisma.agencyClient.findMany({
            where: { agencyId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, name: true, createdAt: true },
          })
        : Promise.resolve([]),
      agencyId
        ? this.prisma.agencyInvoice.findMany({
            where: { agencyId },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              status: true,
              updatedAt: true,
              client: { select: { name: true } },
              event: { select: { title: true } },
            },
          })
        : Promise.resolve([]),
      agencyId
        ? this.prisma.agencyTeamMember.findMany({
            where: { agencyId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              roleTitle: true,
              createdAt: true,
              user: { select: { fullName: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const activity = [
      ...recentClients.map((client) => ({
        id: `client-${client.id}`,
        title: `${client.name} signed on as a new client`,
        occurredAt: client.createdAt.toISOString(),
      })),
      ...recentInvoices.map((invoice) => ({
        id: `invoice-${invoice.id}`,
        title: this.invoiceActivityTitle(invoice),
        occurredAt: invoice.updatedAt.toISOString(),
      })),
      ...recentTeam.map((member) => ({
        id: `team-${member.id}`,
        title: `${member.user.fullName} joined the team as ${member.roleTitle}`,
        occurredAt: member.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 5);

    return {
      organizer: {
        fullName: user.fullName,
        agencyName: user.agencyProfile?.agencyName || 'Your Agency',
      },
      metrics: {
        totalEvents,
        eventsThisMonth,
        activeClients,
        upcomingEvents: upcomingCount,
        teamMembers,
      },
      upcomingEvents: upcomingEvents.map((event) => ({
        id: event.id,
        title: event.title,
        kind: event.agencyClient ? 'client' : 'own',
        ownerLabel: event.agencyClient?.name || user.agencyProfile?.agencyName || 'Your Agency',
        startDate: event.startDate.toISOString(),
        summary: this.eventSummary(event.description, event.status),
      })),
      activity,
    };
  }

  async getTeam(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        agencyProfile: { select: { id: true } },
      },
    });
    if (!user) throw new NotFoundException('Organizer not found');
    const venueOrganizer = user.role === UserRole.VENUE;

    const overview = await this.gate.getGateOverview(userId);
    const events = overview.events;
    const eventTitle = new Map(events.map((event) => [event.id, event.title]));
    const ownerEvent = overview.staff.find((member) => member.isOwner);

    const agencyAdmins =
      !venueOrganizer && user.agencyProfile
        ? await this.prisma.agencyTeamMember.findMany({
            where: { agencyId: user.agencyProfile.id },
            include: {
              user: { select: { id: true, fullName: true, email: true, phone: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];
    const venueAdminRecords = venueOrganizer ? await readOrganizerAdmins(this.prisma, user.id) : [];
    const venueAdminUsers = venueAdminRecords.length
      ? await this.prisma.user.findMany({
          where: { id: { in: venueAdminRecords.map((record) => record.userId) } },
          select: { id: true, fullName: true, email: true, phone: true },
        })
      : [];
    const venueAdminById = new Map(venueAdminUsers.map((member) => [member.id, member]));

    const gateStaff = overview.staff.filter((member) => !member.isOwner);
    const gateJoined = gateStaff.length
      ? await this.prisma.user.findMany({
          where: { id: { in: gateStaff.map((member) => member.id) } },
          select: { id: true, createdAt: true },
        })
      : [];
    const joinedAt = new Map(gateJoined.map((member) => [member.id, member.createdAt.toISOString()]));

    const members = [
      {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        role: venueOrganizer ? ('Venue Owner' as const) : ('Agency Owner' as const),
        kind: 'owner' as const,
        joinedAt: user.createdAt.toISOString(),
        assignment: ownerEvent?.currentAssignment ?? null,
        eventId: ownerEvent?.currentEventId ?? null,
        isYou: true,
      },
      ...agencyAdmins.map((member) => {
        const eventId = this.permissionEventId(member.permissions);
        return {
          id: member.user.id,
          name: member.user.fullName,
          email: member.user.email,
          phone: member.user.phone,
          role: 'Admin' as const,
          kind: 'admin' as const,
          joinedAt: member.createdAt.toISOString(),
          assignment: eventId ? eventTitle.get(eventId) ?? null : null,
          eventId,
          isYou: false,
        };
      }),
      ...venueAdminRecords.flatMap((record) => {
        const member = venueAdminById.get(record.userId);
        if (!member || member.id === user.id) return [];
        return [
          {
            id: member.id,
            name: member.fullName,
            email: member.email,
            phone: member.phone,
            role: 'Admin' as const,
            kind: 'admin' as const,
            joinedAt: record.joinedAt,
            assignment: record.eventId ? eventTitle.get(record.eventId) ?? null : null,
            eventId: record.eventId,
            isYou: false,
          },
        ];
      }),
      ...gateStaff.map((member) => ({
        id: member.id,
        name: member.fullName,
        email: member.email,
        phone: member.phone,
        role: 'Gate Staff' as const,
        kind: 'gate' as const,
        joinedAt: joinedAt.get(member.id) || new Date().toISOString(),
        assignment: member.currentAssignment,
        eventId: member.currentEventId,
        isYou: false,
      })),
    ];

    return {
      metrics: {
        owners: 1,
        admins: venueOrganizer ? venueAdminRecords.filter((record) => venueAdminById.has(record.userId)).length : agencyAdmins.length,
        gateStaff: gateStaff.length,
      },
      events,
      members,
    };
  }

  async inviteTeamMember(userId: string, dto: InviteTeamMemberDto) {
    const organizer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });
    if (!organizer) throw new NotFoundException('Organizer not found');

    if (dto.role === 'Gate Staff') {
      await this.gate.inviteStaff(
        {
          fullName: dto.fullName.trim(),
          email: dto.email.trim(),
          phone: dto.phone?.trim(),
          role: 'Gate Staff',
          eventId: dto.eventId || undefined,
          gateNumber: 'Gate 1',
        },
        userId,
      );
      return { role: dto.role };
    }

    if (organizer.role === UserRole.VENUE) {
      await this.inviteVenueAdmin(userId, organizer.email, dto);
      return { role: dto.role };
    }

    const agency = await this.ensureAgency(userId);
    const email = dto.email.toLowerCase().trim();
    const owner = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (owner?.email.toLowerCase() === email) {
      throw new BadRequestException('You are already the agency owner');
    }

    let member = await this.prisma.user.findUnique({ where: { email } });
    if (member?.role === UserRole.GATE) {
      throw new BadRequestException('This email belongs to a gate staff account. Invite them as Gate Staff.');
    }
    if (!member) {
      const temporaryPassword = randomBytes(6).toString('base64url');
      member = await this.prisma.user.create({
        data: {
          email,
          fullName: dto.fullName.trim(),
          phone: dto.phone?.trim() || null,
          passwordHash: await bcrypt.hash(temporaryPassword, 10),
          role: UserRole.GUEST,
        },
      });
    }

    await this.prisma.agencyTeamMember.upsert({
      where: { agencyId_userId: { agencyId: agency.id, userId: member.id } },
      update: {
        roleTitle: 'Admin',
        permissions: dto.eventId ? { eventId: dto.eventId } : {},
      },
      create: {
        agencyId: agency.id,
        userId: member.id,
        roleTitle: 'Admin',
        permissions: dto.eventId ? { eventId: dto.eventId } : {},
      },
    });
    return { role: dto.role };
  }

  async assignTeamMember(userId: string, dto: AssignTeamMemberDto) {
    const organizer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const event = await this.prisma.event.findFirst({
      where: { id: dto.eventId, organizerId: userId },
      select: { id: true, title: true },
    });
    if (!event) throw new NotFoundException('Event was not found');

    if (dto.kind === 'gate') {
      await this.gate.assignStaff({ staffId: dto.memberId, eventId: dto.eventId, gateNumber: 'Gate 1' }, userId);
      return { assignment: event.title, eventId: event.id };
    }

    if (organizer?.role === UserRole.VENUE) {
      const admins = await readOrganizerAdmins(this.prisma, userId);
      if (!admins.some((record) => record.userId === dto.memberId)) {
        throw new NotFoundException('Team member was not found');
      }
      await saveOrganizerAdmin(this.prisma, userId, dto.memberId, event.id);
      return { assignment: event.title, eventId: event.id };
    }

    const agency = await this.ensureAgency(userId);
    const member = await this.prisma.agencyTeamMember.findFirst({
      where: { agencyId: agency.id, userId: dto.memberId },
    });
    if (!member) throw new NotFoundException('Team member was not found');
    const current =
      member.permissions && typeof member.permissions === 'object' && !Array.isArray(member.permissions)
        ? member.permissions
        : {};
    await this.prisma.agencyTeamMember.update({
      where: { id: member.id },
      data: { permissions: { ...current, eventId: event.id } },
    });
    return { assignment: event.title, eventId: event.id };
  }

  private async inviteVenueAdmin(userId: string, ownerEmail: string, dto: InviteTeamMemberDto) {
    const email = dto.email.toLowerCase().trim();
    if (ownerEmail.toLowerCase() === email) {
      throw new BadRequestException('You are already the venue owner');
    }
    let member = await this.prisma.user.findUnique({ where: { email } });
    if (member?.role === UserRole.GATE) {
      throw new BadRequestException('This email belongs to a gate staff account. Invite them as Gate Staff.');
    }
    if (!member) {
      member = await this.prisma.user.create({
        data: {
          email,
          fullName: dto.fullName.trim(),
          phone: dto.phone?.trim() || null,
          passwordHash: await bcrypt.hash(randomBytes(6).toString('base64url'), 10),
          role: UserRole.GUEST,
        },
      });
    }
    await saveOrganizerAdmin(this.prisma, userId, member.id, dto.eventId || null);
  }

  private permissionEventId(value: Prisma.JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const eventId = (value as { eventId?: unknown }).eventId;
    return typeof eventId === 'string' && eventId ? eventId : null;
  }

  private async ensureAgency(userId: string) {
    const existing = await this.prisma.agencyProfile.findFirst({ where: { userId } });
    if (existing) return existing;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.agencyProfile.create({
      data: {
        userId,
        agencyName: `${user?.fullName || 'Production'} Agency`,
        billingEmail: user?.email || 'billing@agency.com',
      },
    });
  }

  async getReports(
    userId: string,
    query: { range?: string; from?: string; to?: string; eventId?: string; clientId?: string },
  ) {
    const now = new Date();
    const { cardStart, cardEnd, chartStart, chartEnd, periodLabel } = this.reportWindow(now, query);
    const agency = await this.prisma.agencyProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    const events = await this.prisma.event.findMany({
      where: {
        organizerId: userId,
        status: { notIn: [EventStatus.CANCELLED, EventStatus.ARCHIVED] },
        ...(query.eventId ? { id: query.eventId } : {}),
        ...(query.clientId ? { agencyClientId: query.clientId } : {}),
      },
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        agencyClient: { select: { id: true, name: true } },
        attendees: { select: { rsvpStatus: true, status: true, partySize: true } },
        orders: {
          where: { status: OrderStatus.PAID },
          select: { totalAmount: true, paidAt: true, createdAt: true, currency: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });
    const invoices = agency
      ? await this.prisma.agencyInvoice.findMany({
          where: {
            agencyId: agency.id,
            status: InvoiceStatus.PAID,
            ...(query.clientId ? { clientId: query.clientId } : {}),
            ...(query.eventId ? { eventId: query.eventId } : {}),
          },
          select: { amount: true, paidAt: true, issueDate: true, currency: true, eventId: true },
        })
      : [];
    const clients = agency
      ? await this.prisma.agencyClient.findMany({
          where: { agencyId: agency.id },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [];

    const inPeriod = (value: Date) => value >= cardStart && value <= cardEnd;
    const periodEvents = events.filter((event) => inPeriod(event.startDate));
    const months = this.reportMonths(chartStart, chartEnd);
    const monthOf = (value: Date) => `${value.getFullYear()}-${value.getMonth()}`;
    const bucket = (key: string) => months.find((month) => month.key === key);

    const performance = months.map((month) => ({ month: month.label, active: 0, completed: 0, created: 0 }));
    const rsvp = months.map((month) => ({ month: month.label, confirmed: 0, declined: 0, noResponse: 0, pending: 0 }));
    const attendance = months.map((month) => ({ month: month.label, attended: 0, confirmed: 0, invited: 0 }));
    const revenue = months.map((month) => ({ month: month.label, amount: 0 }));

    for (const event of events) {
      const created = bucket(monthOf(event.createdAt));
      if (created) {
        const row = performance.find((item) => item.month === created.label);
        if (row) row.created += 1;
      }
      const started = bucket(monthOf(event.startDate));
      if (started) {
        const row = performance.find((item) => item.month === started.label);
        if (row && (event.status === EventStatus.LIVE || event.status === EventStatus.PUBLISHED)) row.active += 1;
        if (row && event.status === EventStatus.COMPLETED) row.completed += 1;
        const rsvpRow = rsvp.find((item) => item.month === started.label);
        const attendanceRow = attendance.find((item) => item.month === started.label);
        for (const guest of event.attendees) {
          if (rsvpRow) {
            if (guest.rsvpStatus === RsvpStatus.CONFIRMED) rsvpRow.confirmed += 1;
            else if (guest.rsvpStatus === RsvpStatus.DECLINED) rsvpRow.declined += 1;
            else if (guest.rsvpStatus === RsvpStatus.TENTATIVE) rsvpRow.pending += 1;
            else rsvpRow.noResponse += 1;
          }
          if (attendanceRow) {
            attendanceRow.invited += Math.max(1, guest.partySize || 1);
            if (guest.rsvpStatus === RsvpStatus.CONFIRMED) attendanceRow.confirmed += Math.max(1, guest.partySize || 1);
            if (guest.status === AttendeeStatus.CHECKED_IN) attendanceRow.attended += Math.max(1, guest.partySize || 1);
          }
        }
      }
      for (const order of event.orders) {
        const paidAt = order.paidAt || order.createdAt;
        const paid = bucket(monthOf(paidAt));
        const row = paid ? revenue.find((item) => item.month === paid.label) : undefined;
        if (row) row.amount += order.totalAmount;
      }
    }
    const invoicedEvents = new Set(invoices.map((invoice) => invoice.eventId).filter(Boolean));
    for (const invoice of invoices) {
      const paidAt = invoice.paidAt || invoice.issueDate;
      const paid = bucket(monthOf(paidAt));
      const row = paid ? revenue.find((item) => item.month === paid.label) : undefined;
      if (!row) continue;
      if (invoice.eventId && events.some((event) => event.id === invoice.eventId && event.orders.length)) continue;
      row.amount += invoice.amount;
    }

    const guests = periodEvents.flatMap((event) => event.attendees);
    const invited = guests.reduce((sum, guest) => sum + Math.max(1, guest.partySize || 1), 0);
    const confirmed = guests
      .filter((guest) => guest.rsvpStatus === RsvpStatus.CONFIRMED)
      .reduce((sum, guest) => sum + Math.max(1, guest.partySize || 1), 0);
    const responded = guests.filter((guest) =>
      guest.rsvpStatus === RsvpStatus.CONFIRMED ||
      guest.rsvpStatus === RsvpStatus.DECLINED ||
      guest.rsvpStatus === RsvpStatus.TENTATIVE,
    ).length;
    const attended = guests
      .filter((guest) => guest.status === AttendeeStatus.CHECKED_IN)
      .reduce((sum, guest) => sum + Math.max(1, guest.partySize || 1), 0);
    const periodRevenue = periodEvents.reduce((sum, event) => {
      const orderTotal = event.orders
        .filter((order) => inPeriod(order.paidAt || order.createdAt))
        .reduce((total, order) => total + order.totalAmount, 0);
      const invoiceTotal = invoices
        .filter((invoice) => invoice.eventId === event.id && inPeriod(invoice.paidAt || invoice.issueDate))
        .reduce((total, invoice) => total + invoice.amount, 0);
      if (invoicedEvents.has(event.id) && orderTotal === 0) return sum + invoiceTotal;
      return sum + orderTotal + (orderTotal ? 0 : invoiceTotal);
    }, 0);
    const running = events.filter(
      (event) =>
        (event.status === EventStatus.LIVE || event.status === EventStatus.PUBLISHED) &&
        event.endDate >= now,
    ).length;
    const clientCounts = new Map<string, number>();
    for (const event of periodEvents) {
      const name = event.agencyClient?.name || 'My Agency';
      clientCounts.set(name, (clientCounts.get(name) || 0) + 1);
    }
    const typeCounts = new Map<string, number>();
    for (const event of periodEvents) {
      const type = this.reportEventType(event.category);
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }
    const typeTotal = periodEvents.length || 1;

    return {
      periodLabel,
      currency: events[0]?.orders[0]?.currency || invoices[0]?.currency || 'USD',
      filters: {
        events: events.map((event) => ({ id: event.id, title: event.title })),
        clients,
      },
      metrics: {
        totalEvents: periodEvents.length,
        activeEvents: running,
        totalGuests: invited,
        rsvpRate: guests.length ? Math.round((responded / guests.length) * 100) : 0,
        confirmedGuests: confirmed,
        eventsCompleted: periodEvents.filter((event) => event.status === EventStatus.COMPLETED).length,
        totalRevenue: Math.round(periodRevenue),
        avgGuests: periodEvents.length ? Math.round(invited / periodEvents.length) : 0,
        avgRevenue: periodEvents.length ? Math.round(periodRevenue / periodEvents.length) : 0,
        attendanceRate: invited ? Math.round((attended / invited) * 100) : 0,
      },
      performance,
      rsvp,
      attendance,
      byClient: [...clientCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      revenue,
      eventTypes: ['Corporate', 'Social', 'Conference', 'Wedding', 'Other'].map((name) => ({
        name,
        value: typeCounts.get(name) || 0,
        percent: Math.round(((typeCounts.get(name) || 0) / typeTotal) * 100),
      })),
    };
  }

  private reportWindow(
    now: Date,
    query: { range?: string; from?: string; to?: string },
  ) {
    const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    const range = query.range || 'this_month';
    let cardStart = startOfMonth(now);
    let cardEnd = endOfMonth(now);
    if (range === 'last_month') {
      const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      cardStart = startOfMonth(previous);
      cardEnd = endOfMonth(previous);
    } else if (range === 'last_3_months') {
      cardStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      cardEnd = endOfMonth(now);
    } else if (range === 'this_year') {
      cardStart = new Date(now.getFullYear(), 0, 1);
      cardEnd = endOfMonth(now);
    } else if (range === 'custom' && query.from && query.to) {
      const from = new Date(query.from);
      const to = new Date(query.to);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        cardStart = from;
        cardEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
      }
    }
    const chartStart = range === 'this_month' || range === 'last_month'
      ? startOfMonth(new Date(cardEnd.getFullYear(), cardEnd.getMonth() - 5, 1))
      : startOfMonth(cardStart);
    const label = cardStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return { cardStart, cardEnd, chartStart, chartEnd: cardEnd, periodLabel: label };
  }

  private reportMonths(start: Date, end: Date) {
    const months: Array<{ key: string; label: string }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last && months.length < 12) {
      months.push({
        key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
        label: cursor.toLocaleDateString('en-US', { month: 'short' }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }

  private reportEventType(category: string) {
    const value = category.toLowerCase();
    if (value.includes('wedding')) return 'Wedding';
    if (value.includes('conference')) return 'Conference';
    if (value.includes('corporate')) return 'Corporate';
    if (value.includes('gala') || value.includes('dinner') || value.includes('birthday') || value.includes('social')) {
      return 'Social';
    }
    return 'Other';
  }

  private eventSummary(description: string, status: EventStatus) {
    const text = description.replace(/\s+/g, ' ').trim();
    if (text.length > 12) {
      return text.length > 120 ? `${text.slice(0, 117).trim()}…` : text;
    }
    if (status === EventStatus.LIVE) return 'This event is live.';
    if (status === EventStatus.PUBLISHED) return 'Published and open for guest responses.';
    if (status === EventStatus.DRAFT) return 'This event is still being prepared.';
    return 'Event details are ready for review.';
  }

  private invoiceActivityTitle(invoice: {
    status: InvoiceStatus;
    client: { name: string };
    event: { title: string } | null;
  }) {
    const target = invoice.event?.title || invoice.client.name;
    if (invoice.status === InvoiceStatus.PAID) return `Invoice paid for ${target}`;
    if (invoice.status === InvoiceStatus.SENT) return `Invoice sent for ${target}`;
    if (invoice.status === InvoiceStatus.OVERDUE) return `Invoice overdue for ${target}`;
    return `Contract updated for ${target}`;
  }
}
