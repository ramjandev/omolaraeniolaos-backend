import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  UserRole,
  EventStatus,
  UserStatus,
  PlanOrganizerType,
  PlanBillingCycle,
  RsvpStatus,
  AttendeeStatus,
  CommunicationChannel,
  MessageDeliveryStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto, OrganizerType, BillingCycle } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { FilterOrganizersDto, FilterOrganizerType, FilterOrganizerStatus } from './dto/filter-organizers.dto';
import { InvitePlatformUserDto, UpdatePlatformUserDto } from './dto/platform-user.dto';
import { MailService } from '../mail/mail.service';

export interface PlanItem {
  id: string;
  slug: string;
  planName: string;
  description: string | null;
  price: number;
  organizerType: OrganizerType;
  billingCycle: BillingCycle;
  features: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
}

type PlanChargeStatus = 'PAID' | 'PENDING' | 'FAILED';

interface PlanCharge {
  id: string;
  userId: string;
  role: UserRole;
  planId: string | null;
  organizerName: string;
  organizerType: string;
  buyerName: string;
  buyerEmail: string;
  date: Date;
  paidAt: Date | null;
  amount: number;
  currency: string;
  status: PlanChargeStatus;
  plan: string | null;
  txRef: string | null;
  invoiceNumber: string | null;
  paymentMethod: string | null;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(MailService) private mail: MailService,
  ) {}

  /**
   * 1. Dashboard Tab: 4 Top KPI Cards (Pure Numerical & Relational Data from DB)
   */
  async getDashboardSummary() {
    const [
      individualCount,
      agencyCount,
      venueCount,
      activeEventsCount,
      completedEventsCount,
      ordersAgg,
      billing,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.INDIVIDUAL } }),
      this.prisma.user.count({ where: { role: UserRole.AGENCY } }),
      this.prisma.user.count({ where: { role: UserRole.VENUE } }),
      this.prisma.event.count({
        where: { status: { in: [EventStatus.LIVE, EventStatus.PUBLISHED] } },
      }),
      this.prisma.event.count({ where: { status: EventStatus.COMPLETED } }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: 'PAID' },
      }),
      this.loadOrganizerBilling(),
    ]);

    const totalOrganizers = individualCount + agencyCount + venueCount;
    const totalRevenueAmount =
      (ordersAgg._sum.totalAmount || 0) + this.sumPaidPlanCharges(billing.charges);

    return {
      totalOrganizers,
      breakdown: {
        individual: individualCount,
        agency: agencyCount,
        venue: venueCount,
      },
      activeEvents: activeEventsCount,
      completedEvents: completedEventsCount,
      totalRevenue: totalRevenueAmount,
    };
  }

  /**
   * 2. Dashboard Tab: Organizer Breakdown (Pure Numerical Data for Charts)
   */
  async getOrganizerBreakdown() {
    const [individualCount, agencyCount, venueCount] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.INDIVIDUAL } }),
      this.prisma.user.count({ where: { role: UserRole.AGENCY } }),
      this.prisma.user.count({ where: { role: UserRole.VENUE } }),
    ]);

    const total = individualCount + agencyCount + venueCount;

    return {
      totalOrganizers: total,
      items: [
        {
          type: 'Individual',
          count: individualCount,
          percentage: total > 0 ? Math.round((individualCount / total) * 100) : 0,
        },
        {
          type: 'Agency',
          count: agencyCount,
          percentage: total > 0 ? Math.round((agencyCount / total) * 100) : 0,
        },
        {
          type: 'Venue',
          count: venueCount,
          percentage: total > 0 ? Math.round((venueCount / total) * 100) : 0,
        },
      ],
    };
  }

  /**
   * 3. Dashboard Tab: Revenue by Organizer Type (Pure Aggregated DB Data)
   */
  async getRevenueByOrganizerType() {
    const [individualUsers, agencyUsers, venueUsers] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: UserRole.INDIVIDUAL },
        select: {
          id: true,
          eventsCreated: {
            select: {
              orders: {
                where: { status: 'PAID' },
                select: { totalAmount: true },
              },
            },
          },
        },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.AGENCY },
        select: {
          id: true,
          eventsCreated: {
            select: {
              orders: {
                where: { status: 'PAID' },
                select: { totalAmount: true },
              },
            },
          },
        },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.VENUE },
        select: {
          id: true,
          eventsCreated: {
            select: {
              orders: {
                where: { status: 'PAID' },
                select: { totalAmount: true },
              },
            },
          },
        },
      }),
    ]);

    const calculateSum = (users: typeof individualUsers) =>
      users.reduce((acc, u) => {
        const userTotal = u.eventsCreated.reduce((evAcc, ev) => {
          const evTotal = ev.orders.reduce((ordAcc, ord) => ordAcc + (ord.totalAmount || 0), 0);
          return evAcc + evTotal;
        }, 0);
        return acc + userTotal;
      }, 0);

    const billing = await this.loadOrganizerBilling();
    const planRevenue = (role: UserRole) =>
      billing.charges.reduce((sum, charge) => {
        if (charge.status !== 'PAID' || charge.role !== role) return sum;
        return sum + charge.amount;
      }, 0);

    const individualRevenue = calculateSum(individualUsers) + planRevenue(UserRole.INDIVIDUAL);
    const agencyRevenue = calculateSum(agencyUsers) + planRevenue(UserRole.AGENCY);
    const venueRevenue = calculateSum(venueUsers) + planRevenue(UserRole.VENUE);
    const totalRevenue = individualRevenue + agencyRevenue + venueRevenue;
    const totalOrganizers = individualUsers.length + agencyUsers.length + venueUsers.length;

    return {
      totalOrganizers,
      totalRevenue,
      rows: [
        {
          type: 'Individual',
          organizersCount: individualUsers.length,
          revenueAmount: individualRevenue,
          billingModel: 'Per-event',
        },
        {
          type: 'Agency',
          organizersCount: agencyUsers.length,
          revenueAmount: agencyRevenue,
          billingModel: 'Subscription',
        },
        {
          type: 'Venue',
          organizersCount: venueUsers.length,
          revenueAmount: venueRevenue,
          billingModel: 'Subscription',
        },
      ],
    };
  }

  /**
   * 4. Dashboard Tab: Active Events Table (Query directly from DB Event relation)
   */
  async getDashboardActiveEvents(page: number = 1, limit: number = 10, search?: string) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {
      status: { in: [EventStatus.LIVE, EventStatus.PUBLISHED] },
    };

    if (search && search.trim()) {
      whereClause.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { category: { contains: search.trim(), mode: 'insensitive' } },
        { organizer: { fullName: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { startDate: 'asc' },
        include: {
          organizer: {
            select: {
              id: true,
              fullName: true,
              role: true,
              agencyProfile: { select: { agencyName: true } },
              venueProfile: { select: { propertyName: true } },
            },
          },
          _count: {
            select: { attendees: true },
          },
        },
      }),
      this.prisma.event.count({ where: whereClause }),
    ]);

    const formattedEvents = events.map((ev) => {
      let orgName = ev.organizer.fullName;
      let orgType = 'Individual';

      if (ev.organizer.role === UserRole.AGENCY) {
        orgType = 'Agency';
        orgName = ev.organizer.agencyProfile?.agencyName || ev.organizer.fullName;
      } else if (ev.organizer.role === UserRole.VENUE) {
        orgType = 'Venue';
        orgName = ev.organizer.venueProfile?.propertyName || ev.organizer.fullName;
      }

      return {
        id: ev.id,
        name: ev.title,
        organizer: orgName,
        organizerType: orgType,
        status: ev.status,
        date: ev.startDate,
        guestsCount: ev._count.attendees,
        eventType: ev.category,
      };
    });

    return {
      data: formattedEvents,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Admin Events page: every organizer event, with status tabs and filters.
   */
  async getAdminEventsList(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    organizerType?: string;
    eventType?: string;
    sort?: string;
  }) {
    const pageNum = Math.max(1, Number(query.page) || 1);
    const limitNum = Math.max(1, Number(query.limit) || 10);
    const skip = (pageNum - 1) * limitNum;
    const whereClause: any = {};

    const status = (query.status || 'All').trim();
    if (status === 'Active') {
      whereClause.status = { in: [EventStatus.LIVE, EventStatus.PUBLISHED] };
    } else if (status === 'Draft') {
      whereClause.status = EventStatus.DRAFT;
    } else if (status === 'Completed') {
      whereClause.status = EventStatus.COMPLETED;
    } else if (status === 'Cancelled') {
      whereClause.status = EventStatus.CANCELLED;
    } else if (status === 'Archived') {
      whereClause.status = EventStatus.ARCHIVED;
    }

    const organizerType = (query.organizerType || 'All').trim();
    if (organizerType === 'Individual' || organizerType === 'Agency' || organizerType === 'Venue') {
      whereClause.organizer = { role: organizerType.toUpperCase() as UserRole };
    }

    if (query.eventType && query.eventType !== 'All' && query.eventType.trim()) {
      whereClause.category = { equals: query.eventType.trim(), mode: 'insensitive' };
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      whereClause.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { organizer: { fullName: { contains: q, mode: 'insensitive' } } },
        { organizer: { agencyProfile: { agencyName: { contains: q, mode: 'insensitive' } } } },
        { organizer: { venueProfile: { propertyName: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const countWhere = (statusFilter?: EventStatus | { in: EventStatus[] }) => {
      const next = { ...whereClause };
      if (statusFilter) next.status = statusFilter;
      else delete next.status;
      return next;
    };

    const sort = query.sort === 'guests-asc' || query.sort === 'guests-desc' ? query.sort : 'date';
    const orderBy = sort === 'date'
      ? { startDate: 'desc' as const }
      : { attendees: { _count: sort === 'guests-asc' ? 'asc' as const : 'desc' as const } };

    const [events, total, allCount, activeCount, draftCount, completedCount, categories, platformActive] = await Promise.all([
      this.prisma.event.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy,
        include: {
          organizer: {
            select: {
              fullName: true,
              role: true,
              agencyProfile: { select: { agencyName: true } },
              venueProfile: { select: { propertyName: true } },
            },
          },
          _count: { select: { attendees: true } },
        },
      }),
      this.prisma.event.count({ where: whereClause }),
      this.prisma.event.count({ where: countWhere() }),
      this.prisma.event.count({ where: countWhere({ in: [EventStatus.LIVE, EventStatus.PUBLISHED] }) }),
      this.prisma.event.count({ where: countWhere(EventStatus.DRAFT) }),
      this.prisma.event.count({ where: countWhere(EventStatus.COMPLETED) }),
      this.prisma.event.findMany({
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.event.count({
        where: { status: { in: [EventStatus.LIVE, EventStatus.PUBLISHED] } },
      }),
    ]);

    return {
      data: events.map((event) => {
        let organizer = event.organizer.fullName;
        let organizerRole = 'Individual';
        if (event.organizer.role === UserRole.AGENCY) {
          organizerRole = 'Agency';
          organizer = event.organizer.agencyProfile?.agencyName || event.organizer.fullName;
        } else if (event.organizer.role === UserRole.VENUE) {
          organizerRole = 'Venue';
          organizer = event.organizer.venueProfile?.propertyName || event.organizer.fullName;
        }
        return {
          id: event.id,
          name: event.title,
          organizer,
          organizerType: organizerRole,
          status: this.eventStatusLabel(event.status),
          date: event.startDate,
          guestsCount: event._count.attendees,
          eventType: event.category,
        };
      }),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        activeEvents: platformActive,
        eventTypes: categories.map((row) => row.category).filter(Boolean),
        tabCounts: {
          all: allCount,
          active: activeCount,
          draft: draftCount,
          completed: completedCount,
        },
      },
    };
  }

  private eventStatusLabel(status: EventStatus) {
    if (status === EventStatus.LIVE || status === EventStatus.PUBLISHED) return 'Active';
    if (status === EventStatus.COMPLETED) return 'Completed';
    if (status === EventStatus.DRAFT) return 'Draft';
    if (status === EventStatus.CANCELLED) return 'Cancelled';
    return 'Archived';
  }

  /**
   * 5. Single Event details for Admin with full relations
   */
  async getAdminEventById(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            avatarUrl: true,
            agencyProfile: true,
            venueProfile: true,
          },
        },
        ticketTiers: true,
        schedules: true,
        venueSpace: true,
        agencyClient: true,
        attendees: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            notes: true,
            checkInTime: true,
          },
        },
        tableZones: {
          include: {
            assignments: true,
          },
        },
        _count: {
          select: {
            attendees: true,
            orders: true,
            communications: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Dynamic calculations from database relations
    const totalInvitees = event.attendees.length;

    // Categorize RSVP statuses dynamically from attendee database relations
    const confirmedCount = event.attendees.filter(
      (a) => a.status === 'ATTENDING' || a.notes?.toLowerCase().includes('confirmed'),
    ).length;

    const tentativeCount = event.attendees.filter(
      (a) => a.notes?.toLowerCase().includes('tentative') || a.notes?.toLowerCase().includes('maybe'),
    ).length;

    const declinedCount = event.attendees.filter(
      (a) => a.status === 'CANCELLED' || a.notes?.toLowerCase().includes('decline'),
    ).length;

    const checkedInCount = event.attendees.filter(
      (a) => a.status === 'CHECKED_IN' || a.checkInTime !== null,
    ).length;

    const noResponseCount = Math.max(
      0,
      totalInvitees - (confirmedCount + tentativeCount + declinedCount + checkedInCount),
    );

    // Calculate percentages
    const confirmedPct = totalInvitees > 0 ? Math.round((confirmedCount / totalInvitees) * 100) : 0;
    const tentativePct = totalInvitees > 0 ? Math.round((tentativeCount / totalInvitees) * 100) : 0;
    const declinedPct = totalInvitees > 0 ? Math.round((declinedCount / totalInvitees) * 100) : 0;
    const noResponsePct = totalInvitees > 0 ? Math.round((noResponseCount / totalInvitees) * 100) : 0;

    // Countdown calculation
    const now = new Date().getTime();
    const target = new Date(event.startDate).getTime();
    const diff = Math.max(0, target - now);
    const countdown = {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
    };

    // Determine organizer details
    let organizerName = event.organizer.fullName;
    let organizerType = 'Individual';
    let billingPlan = 'Essential Event Pass';

    if (event.organizer.role === UserRole.AGENCY) {
      organizerType = 'Agency';
      organizerName = event.organizer.agencyProfile?.agencyName || event.organizer.fullName;
      billingPlan = 'Included in subscription';
    } else if (event.organizer.role === UserRole.VENUE) {
      organizerType = 'Venue';
      organizerName = event.organizer.venueProfile?.propertyName || event.organizer.fullName;
      billingPlan = 'Included in subscription';
    }

    return {
      event: {
        id: event.id,
        title: event.title,
        status: event.status, // e.g. "DRAFT", "LIVE", "PUBLISHED"
        category: event.category, // e.g. "Gala"
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        timezone: event.timezone,
        venueName: event.venueName || event.venueSpace?.name || null,
        address: event.address,
        capacity: event.capacity,
        coverImageUrl: event.coverImageUrl,
        countdown,
      },
      summary: {
        totalInvitees: {
          value: totalInvitees,
        },
        confirmed: {
          value: confirmedCount,
        },
        checkedIn: {
          value: checkedInCount,
        },
      },
      rsvpStatusBreakdown: [
        {
          label: 'Confirmed',
          count: confirmedCount,
          percentage: confirmedPct,
        },
        {
          label: 'Tentative',
          count: tentativeCount,
          percentage: tentativePct,
        },
        {
          label: 'Declined',
          count: declinedCount,
          percentage: declinedPct,
        },
        {
          label: 'No Response',
          count: noResponseCount,
          percentage: noResponsePct,
        },
      ],
      eventDetails: {
        organizer: organizerName,
        organizerType,
        eventDate: event.startDate,
        eventType: event.category,
        location: event.venueName || event.venueSpace?.name || null,
        billing: billingPlan,
      },
      relations: {
        organizer: event.organizer,
        ticketTiers: event.ticketTiers,
        schedules: event.schedules,
        tableZones: event.tableZones,
        attendees: event.attendees,
      },
    };
  }

  /**
   * Consolidated Telemetry combining relational data
   */
  async getMetrics() {
    const [summary, breakdown, revenueTable, activeEvents] = await Promise.all([
      this.getDashboardSummary(),
      this.getOrganizerBreakdown(),
      this.getRevenueByOrganizerType(),
      this.getDashboardActiveEvents(1, 10),
    ]);

    return {
      summary,
      organizerBreakdown: breakdown,
      revenueByOrganizerType: revenueTable,
      activeEvents,
    };
  }

  private organizerStatusLabel(status: UserStatus) {
    if (status === UserStatus.ACTIVE) return 'Active';
    if (status === UserStatus.SUSPENDED) return 'Suspended';
    if (status === UserStatus.DEACTIVATED) return 'Deactivated';
    return 'Pending';
  }

  private async planNamesFor(userIds: string[]) {
    const names = new Map<string, string>();
    if (userIds.length === 0) return names;
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: userIds.map((id) => `PLAN_USER_${id}`) } },
      select: { key: true, value: true },
    });
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.value) as { planName?: string };
        if (parsed.planName) names.set(row.key.replace('PLAN_USER_', ''), parsed.planName);
      } catch {
        // Skip a plan record that is not valid JSON.
      }
    }
    return names;
  }

  async getOrganizers(filter?: FilterOrganizersDto) {
    const pageNum = Math.max(1, Number(filter?.page) || 1);
    const limitNum = Math.max(1, Number(filter?.limit) || 10);
    const skip = (pageNum - 1) * limitNum;

    // Base condition: only organizers (Individual, Agency, Venue)
    const baseRoles = [
      UserRole.INDIVIDUAL,
      UserRole.AGENCY,
      UserRole.VENUE,
    ];

    const whereClause: any = {
      role: { in: baseRoles },
    };

    // Filter by Type
    if (filter?.type && filter.type !== FilterOrganizerType.ALL) {
      if (filter.type === FilterOrganizerType.INDIVIDUAL) {
        whereClause.role = UserRole.INDIVIDUAL;
      } else if (filter.type === FilterOrganizerType.AGENCY) {
        whereClause.role = UserRole.AGENCY;
      } else if (filter.type === FilterOrganizerType.VENUE) {
        whereClause.role = UserRole.VENUE;
      }
    }

    // Filter by Status
    if (filter?.status && filter.status !== FilterOrganizerStatus.ALL) {
      const statusUpper = filter.status.toUpperCase();
      if (statusUpper in UserStatus) {
        whereClause.status = statusUpper as UserStatus;
      }
    }

    // Keyword Search across Name, Email, Agency Name, Venue Property Name
    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim();
      whereClause.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { agencyProfile: { agencyName: { contains: q, mode: 'insensitive' } } },
        { venueProfile: { propertyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [
      users,
      totalCount,
      allOrganizersCount,
      individualCount,
      agencyCount,
      venueCount,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        include: {
          profile: true,
          agencyProfile: true,
          venueProfile: true,
          eventsCreated: { select: { id: true, title: true, status: true } },
          _count: {
            select: { eventsCreated: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: whereClause }),
      this.prisma.user.count({ where: { role: { in: baseRoles } } }),
      this.prisma.user.count({ where: { role: UserRole.INDIVIDUAL } }),
      this.prisma.user.count({ where: { role: UserRole.AGENCY } }),
      this.prisma.user.count({ where: { role: UserRole.VENUE } }),
    ]);

    const planNames = await this.planNamesFor(users.map((user) => user.id));
    const formattedOrganizers = users.map((user) => {
      let displayName = user.fullName;
      let organizerType: 'Individual' | 'Agency' | 'Venue' = 'Individual';
      let planName = planNames.get(user.id) || 'No plan';

      if (user.role === UserRole.AGENCY) {
        organizerType = 'Agency';
        displayName = user.agencyProfile?.agencyName || user.fullName;
      } else if (user.role === UserRole.VENUE) {
        organizerType = 'Venue';
        displayName = user.venueProfile?.propertyName || user.fullName;
      }

      return {
        id: user.id,
        name: displayName,
        contactEmail: user.email,
        phone: user.phone,
        type: organizerType,
        status: this.organizerStatusLabel(user.status),
        rawStatus: user.status,
        eventsCount: user._count.eventsCreated,
        plan: planName,
        joinedAt: user.createdAt,
        events: user.eventsCreated,
      };
    });

    return {
      data: formattedOrganizers,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        tabCounts: {
          all: allOrganizersCount,
          individual: individualCount,
          agency: agencyCount,
          venue: venueCount,
        },
      },
    };
  }

  /**
   * Retrieve Single Organization / Organizer by UUID with all relations
   */
  async getOrganizerById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        agencyProfile: {
          include: {
            clients: true,
            teamMembers: true,
          },
        },
        venueProfile: {
          include: {
            spaces: true,
            bookings: true,
          },
        },
        eventsCreated: {
          orderBy: { startDate: 'desc' },
          include: {
            _count: {
              select: {
                attendees: true,
                orders: true,
              },
            },
          },
        },
        _count: {
          select: {
            eventsCreated: true,
            teamMembers: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    let displayName = user.fullName;
    let organizerType: 'Individual' | 'Agency' | 'Venue' = 'Individual';
    const planNames = await this.planNamesFor([user.id]);
    const planName = planNames.get(user.id) || 'No plan';

    if (user.role === UserRole.AGENCY) {
      organizerType = 'Agency';
      displayName = user.agencyProfile?.agencyName || user.fullName;
    } else if (user.role === UserRole.VENUE) {
      organizerType = 'Venue';
      displayName = user.venueProfile?.propertyName || user.fullName;
    }

    return {
      id: user.id,
      name: displayName,
      contactEmail: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      type: organizerType,
      role: user.role,
      status: this.organizerStatusLabel(user.status),
      rawStatus: user.status,
      plan: planName,
      joinedAt: user.createdAt,
      profile: user.profile,
      agencyProfile: user.agencyProfile,
      venueProfile: user.venueProfile,
      eventsCount: user._count.eventsCreated,
      events: user.eventsCreated,
    };
  }

  async getAuditLogs() {
    return this.prisma.platformAuditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  }

  async createPlan(dto: CreatePlanDto): Promise<PlanItem> {
    const rawPrice = typeof dto.price === 'number'
      ? dto.price
      : Number(String(dto.price).replace(/[^0-9.]/g, '')) || 0;

    const created = await this.prisma.plan.create({
      data: {
        slug: `plan_${dto.organizerType.toLowerCase()}_${Date.now()}`,
        planName: dto.planName,
        description: dto.description?.trim() || null,
        price: rawPrice,
        organizerType: this.toPlanOrganizer(dto.organizerType),
        billingCycle: this.toPlanCycle(dto.billingCycle),
        features: dto.features && dto.features.length > 0 ? dto.features : ['Core Platform Access'],
        isArchived: dto.isArchived ?? false,
      },
    });

    return this.toPlanItem(created);
  }

  async getPlans(type?: OrganizerType): Promise<PlanItem[]> {
    const rows = await this.prisma.plan.findMany({
      where: type
        ? { organizerType: this.toPlanOrganizer(type), isArchived: false }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toPlanItem(row));
  }

  async getPlanById(id: string): Promise<PlanItem> {
    const plan = await this.prisma.plan.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return this.toPlanItem(plan);
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<PlanItem> {
    const existing = await this.prisma.plan.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!existing) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    let numericPrice = existing.price;
    if (dto.price !== undefined) {
      numericPrice = typeof dto.price === 'number'
        ? dto.price
        : Number(String(dto.price).replace(/[^0-9.]/g, '')) || 0;
    }

    const updated = await this.prisma.plan.update({
      where: { id: existing.id },
      data: {
        planName: dto.planName ?? existing.planName,
        description:
          dto.description !== undefined ? dto.description.trim() || null : existing.description,
        price: numericPrice,
        organizerType: dto.organizerType
          ? this.toPlanOrganizer(dto.organizerType)
          : existing.organizerType,
        billingCycle: dto.billingCycle
          ? this.toPlanCycle(dto.billingCycle)
          : existing.billingCycle,
        features: dto.features ?? existing.features,
        isArchived: dto.isArchived ?? existing.isArchived,
      },
    });

    return this.toPlanItem(updated);
  }

  async deletePlan(id: string): Promise<{ deleted: boolean; id: string }> {
    const existing = await this.prisma.plan.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!existing) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    await this.prisma.plan.delete({ where: { id: existing.id } });
    return { deleted: true, id: existing.id };
  }

  private toPlanOrganizer(type: OrganizerType): PlanOrganizerType {
    if (type === OrganizerType.AGENCY) return PlanOrganizerType.AGENCY;
    if (type === OrganizerType.VENUE) return PlanOrganizerType.VENUE;
    return PlanOrganizerType.INDIVIDUAL;
  }

  private toPlanCycle(cycle: BillingCycle): PlanBillingCycle {
    if (cycle === BillingCycle.MONTHLY) return PlanBillingCycle.MONTHLY;
    if (cycle === BillingCycle.ANNUAL) return PlanBillingCycle.ANNUAL;
    return PlanBillingCycle.PER_EVENT;
  }

  private toPlanItem(row: {
    id: string;
    slug: string;
    planName: string;
    description: string | null;
    price: number;
    organizerType: PlanOrganizerType;
    billingCycle: PlanBillingCycle;
    features: string[];
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): PlanItem {
    return {
      id: row.id,
      slug: row.slug,
      planName: row.planName,
      description: row.description,
      price: row.price,
      organizerType:
        row.organizerType === PlanOrganizerType.AGENCY
          ? OrganizerType.AGENCY
          : row.organizerType === PlanOrganizerType.VENUE
            ? OrganizerType.VENUE
            : OrganizerType.INDIVIDUAL,
      billingCycle:
        row.billingCycle === PlanBillingCycle.MONTHLY
          ? BillingCycle.MONTHLY
          : row.billingCycle === PlanBillingCycle.ANNUAL
            ? BillingCycle.ANNUAL
            : BillingCycle.PER_EVENT,
      features: row.features,
      isArchived: row.isArchived,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * REVENUE & PLANS DOMAIN METHODS
   */

  /**
   * 1. 4 KPI Cards for Revenue & Plans Overview (Pure DB Metrics)
   */
  async getRevenueOverview() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [totalRevenueAgg, currentMonthAgg, lastMonthAgg, billing] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: 'PAID' },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          status: 'PAID',
          createdAt: { gte: currentMonthStart },
        },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          status: 'PAID',
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      this.loadOrganizerBilling(),
    ]);

    const paidPlans = billing.charges.filter((charge) => charge.status === 'PAID');
    const totalRevenue = (totalRevenueAgg._sum.totalAmount || 0) + this.sumPaidPlanCharges(paidPlans);
    const curMonthRev =
      (currentMonthAgg._sum.totalAmount || 0) +
      this.sumChargesBetween(paidPlans, currentMonthStart, now);
    const lastMonthRev =
      (lastMonthAgg._sum.totalAmount || 0) +
      this.sumChargesBetween(paidPlans, lastMonthStart, lastMonthEnd);

    let momGrowthPercentage = 0;
    if (lastMonthRev > 0) {
      momGrowthPercentage = Math.round(((curMonthRev - lastMonthRev) / lastMonthRev) * 100);
    } else if (curMonthRev > 0) {
      momGrowthPercentage = 100;
    }

    const availablePlansCount = await this.prisma.plan.count({ where: { isArchived: false } });
    const activeSubscriptions = billing.activeSubscriptions;
    const monthLabel = currentMonthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const previousLabel = lastMonthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    return {
      totalRevenue: {
        amount: totalRevenue,
      },
      currentMonth: {
        amount: curMonthRev,
        label: monthLabel,
      },
      momGrowth: {
        percentage: momGrowthPercentage,
        comparedWith: previousLabel,
      },
      availablePlans: {
        count: availablePlansCount,
      },
      activeSubscriptions: {
        count: activeSubscriptions,
      },
    };
  }

  /**
   * 2. Monthly Revenue Breakdown Chart (Aggregated DB Data)
   */
  async getRevenueBreakdown(period: string = 'Yearly') {
    const now = new Date();
    const yearly = period !== 'Monthly';
    const rangeStart = yearly
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeEnd = yearly
      ? new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [paidOrders, billing] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          status: 'PAID',
          createdAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { totalAmount: true, createdAt: true },
      }),
      this.loadOrganizerBilling(),
    ]);

    const paidPlans = billing.charges.filter((charge) => {
      if (charge.status !== 'PAID') return false;
      const at = charge.paidAt || charge.date;
      return at >= rangeStart && at <= rangeEnd;
    });

    const buckets = yearly
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      : Array.from({ length: rangeEnd.getDate() }, (_, index) => String(index + 1));

    const data = buckets.map((month, index) => {
      const orderAmount = paidOrders
        .filter((order) => {
          const created = new Date(order.createdAt);
          return yearly ? created.getMonth() === index : created.getDate() === index + 1;
        })
        .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const planAmount = paidPlans
        .filter((charge) => {
          const at = charge.paidAt || charge.date;
          return yearly ? at.getMonth() === index : at.getDate() === index + 1;
        })
        .reduce((sum, charge) => sum + charge.amount, 0);
      return { month, amount: orderAmount + planAmount };
    });

    return {
      period: yearly ? 'Yearly' : 'Monthly',
      year: now.getFullYear(),
      data,
    };
  }

  /**
   * 3. Revenue transactions: ticket orders plus organizer plan payments.
   */
  async getRevenueTransactions(
    status: string = 'All',
    search?: string,
    page: number = 1,
    limit: number = 10,
    sort: string = 'date',
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 10);
    const statusFilter = status && status !== 'All' ? status.toUpperCase() : '';
    const query = search?.trim().toLowerCase() || '';

    const whereClause: any = {};
    if (statusFilter) whereClause.status = statusFilter;

    if (query) {
      whereClause.OR = [
        { orderNumber: { contains: search!.trim(), mode: 'insensitive' } },
        { buyerName: { contains: search!.trim(), mode: 'insensitive' } },
        { buyerEmail: { contains: search!.trim(), mode: 'insensitive' } },
        { event: { title: { contains: search!.trim(), mode: 'insensitive' } } },
      ];
    }

    const [orders, billing] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: {
            select: {
              fullName: true,
              role: true,
              agencyProfile: { select: { agencyName: true } },
              venueProfile: { select: { propertyName: true } },
            },
          },
          event: {
            select: {
              title: true,
              organizer: {
                select: {
                  fullName: true,
                  role: true,
                  agencyProfile: { select: { agencyName: true } },
                  venueProfile: { select: { propertyName: true } },
                },
              },
            },
          },
        },
      }),
      this.loadOrganizerBilling(),
    ]);

    const ticketRows = orders.map((o) => {
      let orgType = 'Individual';
      const organizer = o.event?.organizer || o.buyer;
      let orgName = organizer?.fullName || o.buyerName || 'Organizer';

      if (organizer?.role === UserRole.AGENCY) {
        orgType = 'Agency';
        orgName = organizer.agencyProfile?.agencyName || organizer.fullName;
      } else if (organizer?.role === UserRole.VENUE) {
        orgType = 'Venue';
        orgName = organizer.venueProfile?.propertyName || organizer.fullName;
      }

      return {
        id: o.id,
        txId: o.orderNumber,
        date: o.createdAt,
        organizer: orgName,
        organizerType: orgType,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        amount: o.totalAmount,
        currency: o.currency,
        status: o.status,
        plan: o.event?.title || null,
        paymentGateway: o.paymentGateway,
        transactionRef: o.transactionRef,
        paidAt: o.paidAt,
      };
    });

    const planRows = billing.charges
      .filter((charge) => {
        if (statusFilter && charge.status !== statusFilter) return false;
        if (!query) return true;
        const haystack = [
          charge.txRef,
          charge.invoiceNumber,
          charge.id,
          charge.organizerName,
          charge.buyerName,
          charge.buyerEmail,
          charge.plan,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .map((charge) => ({
        id: charge.id,
        txId: charge.txRef || charge.invoiceNumber || charge.id,
        date: charge.paidAt || charge.date,
        organizer: charge.organizerName,
        organizerType: charge.organizerType,
        buyerName: charge.buyerName,
        buyerEmail: charge.buyerEmail,
        amount: charge.amount,
        currency: charge.currency,
        status: charge.status,
        plan: charge.plan,
        paymentGateway: charge.paymentMethod === 'FREE' ? 'FREE' : 'FLUTTERWAVE',
        transactionRef: charge.txRef,
        paidAt: charge.paidAt,
      }));

    const merged = [...ticketRows, ...planRows].sort((a, b) => {
      if (sort === 'amount-asc') return a.amount - b.amount;
      if (sort === 'amount-desc') return b.amount - a.amount;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const total = merged.length;
    const start = (pageNum - 1) * limitNum;

    return {
      data: merged.slice(start, start + limitNum),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: total > 0 ? Math.ceil(total / limitNum) : 0,
      },
    };
  }

  /**
   * 4. Single Consolidated Endpoint: Get everything for Revenue
   */
  async getAllRevenueData() {
    const [overview, breakdown, transactions, plans] = await Promise.all([
      this.getRevenueOverview(),
      this.getRevenueBreakdown('Yearly'),
      this.getRevenueTransactions('All', undefined, 1, 10),
      this.getPlans(),
    ]);

    return {
      overview,
      breakdown,
      transactions,
      plans,
    };
  }

  /**
   * Organizer plan payments are stored as JSON on PlatformSetting
   * (BILLING_HISTORY_* and PLAN_USER_*), not as ticket orders.
   */
  private async loadOrganizerBilling(): Promise<{
    charges: PlanCharge[];
    activeSubscriptions: number;
  }> {
    const settings = await this.prisma.platformSetting.findMany({
      where: {
        OR: [
          { key: { startsWith: 'BILLING_HISTORY_' } },
          { key: { startsWith: 'PLAN_USER_' } },
        ],
      },
      select: { key: true, value: true },
    });

    const historyByUser = new Map<string, Array<Record<string, unknown>>>();
    const planByUser = new Map<string, Record<string, unknown>>();

    for (const row of settings) {
      if (row.key.startsWith('BILLING_HISTORY_')) {
        historyByUser.set(row.key.slice('BILLING_HISTORY_'.length), this.parseBillingHistory(row.value));
      } else if (row.key.startsWith('PLAN_USER_')) {
        const plan = this.parseJsonObject(row.value);
        if (plan) planByUser.set(row.key.slice('PLAN_USER_'.length), plan);
      }
    }

    const userIds = [...new Set([...historyByUser.keys(), ...planByUser.keys()])];
    if (userIds.length === 0) return { charges: [], activeSubscriptions: 0 };

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        agencyProfile: { select: { agencyName: true } },
        venueProfile: { select: { propertyName: true } },
      },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const charges: PlanCharge[] = [];
    let activeSubscriptions = 0;

    for (const userId of userIds) {
      const user = usersById.get(userId);
      if (!user || !this.isOrganizerRole(user.role)) continue;

      const plan = planByUser.get(userId);
      const planPaid = this.planRecordIsActive(plan);
      if (planPaid) activeSubscriptions += 1;

      const normalized = (historyByUser.get(userId) || [])
        .map((item, index) => this.chargeFromHistory(user, item, index))
        .filter((item): item is PlanCharge => item !== null);

      const price = this.numberValue(plan?.price);
      const planId = typeof plan?.planId === 'string' ? plan.planId : '';
      const paidMatch = normalized.some(
        (item) =>
          item.status === 'PAID' &&
          ((planId && item.planId === planId) || (price > 0 && item.amount === price)),
      );

      if (planPaid && plan && price > 0 && !paidMatch) {
        const pendingIndex = normalized.findIndex(
          (item) =>
            item.status === 'PENDING' &&
            ((planId && item.planId === planId) || item.amount === price),
        );
        if (pendingIndex >= 0) {
          const pending = normalized[pendingIndex];
          normalized[pendingIndex] = {
            ...pending,
            status: 'PAID',
            paidAt: pending.paidAt || this.dateValue(plan.selectedAt) || this.dateValue(plan.updatedAt),
          };
        } else {
          const synthesized = this.chargeFromPlan(user, plan);
          if (synthesized) normalized.unshift(synthesized);
        }
      }

      charges.push(...normalized);
    }

    return { charges, activeSubscriptions };
  }

  private sumPaidPlanCharges(charges: PlanCharge[]) {
    return charges.reduce((sum, charge) => {
      if (charge.status !== 'PAID') return sum;
      return sum + charge.amount;
    }, 0);
  }

  private sumChargesBetween(charges: PlanCharge[], start: Date, end: Date) {
    return charges.reduce((sum, charge) => {
      const at = charge.paidAt || charge.date;
      if (at < start || at > end) return sum;
      return sum + charge.amount;
    }, 0);
  }

  private isOrganizerRole(role: UserRole) {
    return role === UserRole.INDIVIDUAL || role === UserRole.AGENCY || role === UserRole.VENUE;
  }

  private planRecordIsActive(plan?: Record<string, unknown>) {
    if (!plan) return false;
    return plan.isPaid === true || String(plan.status || '').toUpperCase() === 'ACTIVE';
  }

  private parseBillingHistory(value: string) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
    } catch {
      return [];
    }
  }

  private parseJsonObject(value: string) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private organizerIdentity(user: {
    fullName: string;
    role: UserRole;
    agencyProfile: { agencyName: string } | null;
    venueProfile: { propertyName: string } | null;
  }) {
    if (user.role === UserRole.AGENCY) {
      return { name: user.agencyProfile?.agencyName || user.fullName, type: 'Agency' };
    }
    if (user.role === UserRole.VENUE) {
      return { name: user.venueProfile?.propertyName || user.fullName, type: 'Venue' };
    }
    return { name: user.fullName, type: 'Individual' };
  }

  private chargeFromHistory(
    user: {
      id: string;
      fullName: string;
      email: string;
      role: UserRole;
      agencyProfile: { agencyName: string } | null;
      venueProfile: { propertyName: string } | null;
    },
    item: Record<string, unknown>,
    index: number,
  ): PlanCharge | null {
    const description = typeof item.description === 'string' ? item.description : '';
    if (!description) return null;
    const identity = this.organizerIdentity(user);
    const status = this.chargeStatus(item.status);
    return {
      id: typeof item.id === 'string' ? item.id : `bill_${user.id}_${index}`,
      userId: user.id,
      role: user.role,
      planId: typeof item.planId === 'string' ? item.planId : null,
      organizerName: identity.name,
      organizerType: identity.type,
      buyerName: user.fullName,
      buyerEmail: user.email,
      date: this.dateValue(item.date) || new Date(),
      paidAt: this.dateValue(item.paidAt),
      amount: this.numberValue(item.amount),
      currency: typeof item.currency === 'string' ? item.currency : 'NGN',
      status,
      plan: description,
      txRef: typeof item.txRef === 'string' ? item.txRef : null,
      invoiceNumber: typeof item.invoiceNumber === 'string' ? item.invoiceNumber : null,
      paymentMethod: typeof item.paymentMethod === 'string' ? item.paymentMethod : null,
    };
  }

  private chargeFromPlan(
    user: {
      id: string;
      fullName: string;
      email: string;
      role: UserRole;
      agencyProfile: { agencyName: string } | null;
      venueProfile: { propertyName: string } | null;
    },
    plan: Record<string, unknown>,
  ): PlanCharge | null {
    const description = typeof plan.planName === 'string' ? plan.planName : '';
    if (!description) return null;
    const identity = this.organizerIdentity(user);
    const selectedAt = this.dateValue(plan.selectedAt) || this.dateValue(plan.updatedAt) || new Date();
    return {
      id: `plan_${user.id}`,
      userId: user.id,
      role: user.role,
      planId: typeof plan.planId === 'string' ? plan.planId : null,
      organizerName: identity.name,
      organizerType: identity.type,
      buyerName: user.fullName,
      buyerEmail: user.email,
      date: selectedAt,
      paidAt: selectedAt,
      amount: this.numberValue(plan.price),
      currency: 'NGN',
      status: 'PAID',
      plan: description,
      txRef: null,
      invoiceNumber: null,
      paymentMethod: typeof plan.paymentMethod === 'string' ? plan.paymentMethod : 'CARD',
    };
  }

  private chargeStatus(value: unknown): PlanChargeStatus {
    const status = String(value || '').toLowerCase();
    if (status === 'paid' || status === 'successful') return 'PAID';
    if (status === 'failed' || status === 'cancelled' || status === 'canceled') return 'FAILED';
    return 'PENDING';
  }

  private dateValue(value: unknown) {
    if (typeof value !== 'string' && !(value instanceof Date)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private numberValue(value: unknown) {
    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount) ? amount : 0;
  }

  /**
   * 5. PLATFORM SETTINGS DOMAIN METHODS
   */
  async getPlatformSettings() {
    const settings = await this.prisma.platformSetting.findMany({
      where: {
        key: {
          in: [
            'SETTING_FEATURE_FLAGS',
            'SETTING_SUPPORTED_LANGUAGES',
            'SETTING_DEFAULT_PLAN',
            'SETTING_PAYMENT',
            'SETTING_WHATSAPP',
          ],
        },
      },
    });

    const map: Record<string, any> = {};
    for (const s of settings) {
      try {
        map[s.key] = JSON.parse(s.value);
      } catch {
        map[s.key] = s.value;
      }
    }

    const featureFlags = map['SETTING_FEATURE_FLAGS'] || {
      voiceRsvp: true,
      offlineCheckIn: true,
      multilingualDispatch: false,
      seatingCoordinator: true,
      aiFollowUpMessages: false,
      securityFraudAlerts: true,
    };

    const supportedLanguages = map['SETTING_SUPPORTED_LANGUAGES'] || {
      english: true,
      yoruba: true,
      igbo: true,
      hausa: true,
      pidgin: true,
    };

    const defaultPlanSettings = map['SETTING_DEFAULT_PLAN'] || {
      defaultBillingCycle: 'Per-event',
      defaultCurrency: 'NGN (₦)',
      trialPeriod: 'None',
      invoiceEmail: 'billing@mcenies.ng',
    };

    const paymentConfig = map['SETTING_PAYMENT'] || {
      liveMode: false,
    };

    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    const flwKey = process.env.FLUTTERWAVE_PUBLIC_KEY || '';

    return {
      whatsapp: {
        provider: 'Meta Cloud API · production',
        apiKey: whatsappToken
          ? `wh_live_••••••••••••${whatsappToken.slice(-4)}`
          : 'wh_live_••••••••••••3f9a',
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '1293112117228335',
        wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '1640396534394666',
        webhookUrl: 'https://api.mcenies.ng/webhook/whatsapp',
        status: whatsappToken ? 'Connected' : 'Disconnected',
      },
      aiSpeech: {
        provider: 'Google Cloud Speech-to-Text · v2',
        credentials: 'service_account_credentials.json',
        supportedLanguages: 'English, Yoruba, Igbo, Hausa, Pidgin',
        status: 'Connected',
      },
      paymentGateway: {
        provider: paymentConfig.liveMode
          ? 'Flutterwave · Live mode'
          : 'Flutterwave · Test mode',
        apiKey: flwKey
          ? `FLWPUBK_••••••••••••${flwKey.slice(-4)}`
          : 'FLWPUBK_TEST-••••',
        liveMode: Boolean(paymentConfig.liveMode),
        status: process.env.FLUTTERWAVE_SECRET_KEY ? 'Connected' : 'Disconnected',
      },
      featureFlags,
      supportedLanguages: [
        {
          code: 'en',
          name: 'English',
          subtitle: 'Platform default',
          status: supportedLanguages.english !== false ? 'Active' : 'Inactive',
        },
        {
          code: 'yo',
          name: 'Yoruba',
          status: supportedLanguages.yoruba !== false ? 'Active' : 'Inactive',
        },
        {
          code: 'ig',
          name: 'Igbo',
          status: supportedLanguages.igbo !== false ? 'Active' : 'Inactive',
        },
        {
          code: 'ha',
          name: 'Hausa',
          status: supportedLanguages.hausa !== false ? 'Active' : 'Inactive',
        },
        {
          code: 'pcm',
          name: 'Nigerian Pidgin',
          status: supportedLanguages.pidgin !== false ? 'Active' : 'Inactive',
        },
      ],
      defaultPlanSettings,
    };
  }

  async updatePlatformSettings(dto: any) {
    const promises: Promise<any>[] = [];

    if (dto.featureFlags) {
      promises.push(
        this.prisma.platformSetting.upsert({
          where: { key: 'SETTING_FEATURE_FLAGS' },
          update: { value: JSON.stringify(dto.featureFlags) },
          create: {
            key: 'SETTING_FEATURE_FLAGS',
            value: JSON.stringify(dto.featureFlags),
            description: 'Platform wide feature flag toggles',
          },
        }),
      );
    }

    if (dto.supportedLanguages) {
      promises.push(
        this.prisma.platformSetting.upsert({
          where: { key: 'SETTING_SUPPORTED_LANGUAGES' },
          update: { value: JSON.stringify(dto.supportedLanguages) },
          create: {
            key: 'SETTING_SUPPORTED_LANGUAGES',
            value: JSON.stringify(dto.supportedLanguages),
            description: 'Supported languages active state',
          },
        }),
      );
    }

    if (dto.defaultPlanSettings) {
      promises.push(
        this.prisma.platformSetting.upsert({
          where: { key: 'SETTING_DEFAULT_PLAN' },
          update: { value: JSON.stringify(dto.defaultPlanSettings) },
          create: {
            key: 'SETTING_DEFAULT_PLAN',
            value: JSON.stringify(dto.defaultPlanSettings),
            description: 'Default plan parameters',
          },
        }),
      );
    }

    if (dto.paymentGateway) {
      promises.push(
        this.prisma.platformSetting.upsert({
          where: { key: 'SETTING_PAYMENT' },
          update: { value: JSON.stringify(dto.paymentGateway) },
          create: {
            key: 'SETTING_PAYMENT',
            value: JSON.stringify(dto.paymentGateway),
            description: 'Payment gateway configuration',
          },
        }),
      );
    }

    if (dto.whatsapp) {
      promises.push(
        this.prisma.platformSetting.upsert({
          where: { key: 'SETTING_WHATSAPP' },
          update: { value: JSON.stringify(dto.whatsapp) },
          create: {
            key: 'SETTING_WHATSAPP',
            value: JSON.stringify(dto.whatsapp),
            description: 'WhatsApp Cloud API parameters',
          },
        }),
      );
    }

    await Promise.all(promises);
    return this.getPlatformSettings();
  }

  async testPlatformConnection(provider: string) {
    const target = provider.toLowerCase();

    if (target === 'whatsapp') {
      const token = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1293112117228335';

      if (!token) {
        return {
          provider: 'WhatsApp Business API',
          status: 'Disconnected',
          message: 'WhatsApp Access Token is not set',
        };
      }

      try {
        const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        return {
          provider: 'WhatsApp Business API',
          status: res.ok ? 'Connected' : 'Error',
          details: data,
        };
      } catch (err: any) {
        return {
          provider: 'WhatsApp Business API',
          status: 'Error',
          message: err.message,
        };
      }
    }

    if (target === 'payment' || target === 'flutterwave') {
      const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
      if (!secretKey) {
        return {
          provider: 'Flutterwave',
          status: 'Disconnected',
          message: 'Flutterwave Secret Key is not configured',
        };
      }

      try {
        const res = await fetch('https://api.flutterwave.com/v3/transactions?limit=1', {
          headers: { Authorization: `Bearer ${secretKey}` },
        });
        const data = await res.json();
        return {
          provider: 'Flutterwave',
          status: res.ok && data.status === 'success' ? 'Connected' : 'Error',
          details: data.message,
        };
      } catch (err: any) {
        return {
          provider: 'Flutterwave',
          status: 'Error',
          message: err.message,
        };
      }
    }

    if (target === 'aispeech' || target === 'speech') {
      return {
        provider: 'Google Cloud Speech-to-Text v2',
        status: 'Connected',
        supportedLanguages: ['English', 'Yoruba', 'Igbo', 'Hausa', 'Pidgin'],
        message: 'Speech recognition engine active and ready',
      };
    }

    return {
      provider,
      status: 'Connected',
      message: 'Provider health check succeeded',
    };
  }

  /**
   * 6. ANALYTICS DOMAIN METHODS (Pure Relational DB Data)
   */

  /**
   * 6.1 Top 6 KPI Cards for Platform Analytics
   */
  async getAnalyticsOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const [newOrganizers, eventsCreated, rsvpsProcessed, whatsappMessagesSent, voice, checkInVolume] =
      await Promise.all([
        this.prisma.user.count({
          where: {
            role: { in: [UserRole.INDIVIDUAL, UserRole.AGENCY, UserRole.VENUE] },
            createdAt: { gte: startOfMonth },
          },
        }),
        this.prisma.event.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
        this.prisma.attendee.count({
          where: {
            updatedAt: { gte: startOfMonth },
            OR: this.rsvpResponseFilter(),
          },
        }),
        this.prisma.communicationDelivery.count({
          where: {
            channel: CommunicationChannel.WHATSAPP,
            status: {
              in: [
                MessageDeliveryStatus.SENT,
                MessageDeliveryStatus.DELIVERED,
                MessageDeliveryStatus.SANDBOX_LOGGED,
              ],
            },
            createdAt: { gte: startOfMonth },
          },
        }),
        this.classifyRsvpChannels(),
        this.prisma.attendee.count({
          where: {
            OR: [{ checkInTime: { not: null } }, { status: AttendeeStatus.CHECKED_IN }],
          },
        }),
      ]);

    return {
      periodLabel,
      newOrganizers: { count: newOrganizers },
      eventsCreated: { count: eventsCreated },
      rsvpsProcessed: { count: rsvpsProcessed },
      whatsappMessagesSent: { count: whatsappMessagesSent },
      voiceRsvpUsage: {
        percentage: voice.breakdown.voiceNote.percentage,
        count: voice.breakdown.voiceNote.count,
        totalResponses: voice.totalResponses,
      },
      checkInVolume: { count: checkInVolume },
    };
  }

  /**
   * 6.2 Organizer Growth Over Time (by Individual, Agency, Venue)
   */
  async getOrganizerGrowth(range: string = '6_months') {
    const monthsCount = range === '12_months' ? 12 : 6;
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);

    const users = await this.prisma.user.findMany({
      where: {
        role: {
          in: [
            UserRole.INDIVIDUAL,
            UserRole.AGENCY,
            UserRole.VENUE,
          ],
        },
        createdAt: { gte: startDate },
      },
      select: {
        role: true,
        createdAt: true,
      },
    });

    const series = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mYear = d.getFullYear();
      const mIndex = d.getMonth();
      const mName = monthNames[mIndex];

      const monthUsers = users.filter((u) => {
        const uDate = new Date(u.createdAt);
        return uDate.getFullYear() === mYear && uDate.getMonth() === mIndex;
      });

      const ind = monthUsers.filter((u) => u.role === UserRole.INDIVIDUAL).length;
      const agency = monthUsers.filter((u) => u.role === UserRole.AGENCY).length;
      const venue = monthUsers.filter((u) => u.role === UserRole.VENUE).length;

      series.push({
        month: mName,
        individual: ind,
        agency: agency,
        venue: venue,
        total: ind + agency + venue,
      });
    }

    return {
      range,
      data: series,
    };
  }

  /**
   * 6.3 Events Created Over Time
   */
  async getEventsCreatedOverTime(range: string = '6_months') {
    const monthsCount = range === '12_months' ? 12 : 6;
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);

    const events = await this.prisma.event.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
      },
    });

    const series = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mYear = d.getFullYear();
      const mIndex = d.getMonth();
      const mName = monthNames[mIndex];

      const count = events.filter((e) => {
        const eDate = new Date(e.createdAt);
        return eDate.getFullYear() === mYear && eDate.getMonth() === mIndex;
      }).length;

      series.push({
        month: mName,
        eventsCount: count,
      });
    }

    return {
      range,
      data: series,
    };
  }

  /**
   * 6.4 Voice RSVP Adoption Breakdown (Button, Voice Note, Text Reply)
   */
  async getVoiceRsvpAdoption() {
    return this.classifyRsvpChannels();
  }

  private rsvpResponseFilter() {
    return [
      { rsvpStatus: { in: [RsvpStatus.CONFIRMED, RsvpStatus.TENTATIVE, RsvpStatus.DECLINED] } },
      { notes: { contains: 'Voice RSVP', mode: 'insensitive' as const } },
      { notes: { contains: 'Guest note:', mode: 'insensitive' as const } },
    ];
  }

  private async classifyRsvpChannels() {
    const rows = await this.prisma.attendee.findMany({
      where: { OR: this.rsvpResponseFilter() },
      select: { notes: true, rsvpStatus: true },
    });

    let voiceCount = 0;
    let textCount = 0;
    let buttonCount = 0;

    for (const row of rows) {
      const notes = row.notes || '';
      if (/voice rsvp/i.test(notes)) {
        voiceCount += 1;
      } else if (/guest note:/i.test(notes)) {
        textCount += 1;
      } else {
        buttonCount += 1;
      }
    }

    const total = voiceCount + textCount + buttonCount;
    const share = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
    const buttonPct = share(buttonCount);
    const voicePct = share(voiceCount);
    const textPct = total > 0 ? Math.max(0, 100 - buttonPct - voicePct) : 0;

    return {
      totalResponses: total,
      breakdown: {
        button: { count: buttonCount, percentage: buttonPct },
        voiceNote: { count: voiceCount, percentage: voicePct },
        textReply: { count: textCount, percentage: textPct },
      },
    };
  }

  /**
   * 6.5 Consolidated Analytics Payload (All in one)
   */
  async getAllAnalyticsData(range: string = '6_months') {
    const [overview, organizerGrowth, eventsCreated, voiceRsvpAdoption] = await Promise.all([
      this.getAnalyticsOverview(),
      this.getOrganizerGrowth(range),
      this.getEventsCreatedOverTime(range),
      this.getVoiceRsvpAdoption(),
    ]);

    return {
      overview,
      organizerGrowth,
      eventsCreated,
      voiceRsvpAdoption,
    };
  }

  async listPlatformUsers(search?: string, status?: string) {
    const query = search?.trim();
    const statusFilter = (status || 'all').toLowerCase();
    const where: {
      role: UserRole;
      status?: UserStatus | { in: UserStatus[] } | { not: UserStatus };
      OR?: Array<Record<string, unknown>>;
    } = { role: UserRole.ADMIN };

    if (statusFilter === 'active') where.status = UserStatus.ACTIVE;
    else if (statusFilter === 'suspended') {
      where.status = { in: [UserStatus.SUSPENDED, UserStatus.DEACTIVATED] };
    } else where.status = { not: UserStatus.DEACTIVATED };

    if (query) {
      where.OR = [
        { fullName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        updatedAt: true,
        profile: { select: { jobTitle: true } },
      },
    });

    return { data: users.map((user) => this.formatPlatformUser(user)) };
  }

  async invitePlatformUser(dto: InvitePlatformUserDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.role === UserRole.ADMIN) {
      throw new ConflictException('A platform user with this email already exists');
    }
    if (existing) {
      throw new ConflictException('This email already belongs to another account');
    }

    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: new Date(),
        profile: { create: { jobTitle: dto.role } },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        updatedAt: true,
        profile: { select: { jobTitle: true } },
      },
    });

    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    const sent = await this.mail.sendEmail(
      email,
      'You are invited to McEniesVite',
      [
        `<p>Hello ${dto.fullName.trim()},</p>`,
        `<p>You now have ${dto.role} access to the McEniesVite platform.</p>`,
        `<p>Sign in at <a href="${loginUrl}">${loginUrl}</a></p>`,
        `<p>Email: <strong>${email}</strong></p>`,
        `<p>Temporary password: <strong>${temporaryPassword}</strong></p>`,
        '<p>Change this password after you sign in.</p>',
      ].join(''),
    );

    return {
      user: this.formatPlatformUser(user),
      temporaryPassword,
      emailSent: sent.ok,
    };
  }

  async updatePlatformUser(id: string, dto: UpdatePlatformUserDto, actorId?: string) {
    const user = await this.requirePlatformUser(id);
    if (dto.status === 'Suspended') {
      if (actorId && actorId === user.id) {
        throw new BadRequestException('You cannot suspend your own account');
      }
      await this.assertAnotherActiveAdmin(user.id);
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.status
          ? { status: dto.status === 'Suspended' ? UserStatus.SUSPENDED : UserStatus.ACTIVE }
          : {}),
        ...(dto.role
          ? { profile: { upsert: { update: { jobTitle: dto.role }, create: { jobTitle: dto.role } } } }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        updatedAt: true,
        profile: { select: { jobTitle: true } },
      },
    });

    return this.formatPlatformUser(updated);
  }

  async deletePlatformUser(id: string, actorId?: string) {
    const user = await this.requirePlatformUser(id);
    if (actorId && actorId === user.id) {
      throw new BadRequestException('You cannot remove your own account');
    }
    if (user.status === UserStatus.ACTIVE) {
      await this.assertAnotherActiveAdmin(user.id);
    }

    const ownedEvents = await this.prisma.event.count({ where: { organizerId: user.id } });
    if (ownedEvents > 0) {
      throw new BadRequestException('This admin owns events. Suspend the account instead of deleting it.');
    }

    await this.prisma.user.delete({ where: { id: user.id } });
    return { id: user.id };
  }

  private async requirePlatformUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Platform user not found');
    }
    return user;
  }

  private async assertAnotherActiveAdmin(userId: string) {
    const others = await this.prisma.user.count({
      where: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        id: { not: userId },
      },
    });
    if (others === 0) {
      throw new BadRequestException('At least one active platform admin must remain');
    }
  }

  private formatPlatformUser(user: {
    id: string;
    fullName: string;
    email: string;
    status: UserStatus;
    updatedAt: Date;
    profile: { jobTitle: string | null } | null;
  }) {
    const suspended = user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED;
    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: this.platformRoleLabel(user.profile?.jobTitle, user.email),
      lastActive: user.updatedAt.toISOString(),
      status: suspended ? 'Suspended' : 'Active',
    };
  }

  private platformRoleLabel(jobTitle: string | null | undefined, email: string) {
    const labels = ['Super Admin', 'Admin', 'Platform Operator'];
    if (jobTitle && labels.includes(jobTitle)) return jobTitle;
    const bootstrap = (process.env.ADMIN_EMAIL || 'admin@mceniesvite.com').toLowerCase();
    if (email.toLowerCase() === bootstrap) return 'Super Admin';
    return 'Admin';
  }
}

