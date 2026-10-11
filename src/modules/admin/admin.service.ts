import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { UserRole, EventStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto, OrganizerType, BillingCycle } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { FilterOrganizersDto, FilterOrganizerType, FilterOrganizerStatus } from './dto/filter-organizers.dto';

export interface PlanItem {
  id: string;
  planName: string;
  price: number;
  organizerType: OrganizerType;
  billingCycle: BillingCycle;
  features: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
}

@Injectable()
export class AdminService {
  private plansStore: PlanItem[] = [
    {
      id: 'plan_ind_1',
      planName: 'Essential Event Pass',
      price: 0,
      organizerType: OrganizerType.INDIVIDUAL,
      billingCycle: BillingCycle.PER_EVENT,
      features: [
        'Up to 150 Guest RSVP passes',
        'Direct WhatsApp RSVP link dispatch',
        'Standard QR Gate Check-in Pass',
        'Real-time attendance tracking',
        '30-day post-event analytics',
      ],
      isArchived: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'plan_ind_2',
      planName: 'Grand Celebration Pass',
      price: 35000,
      organizerType: OrganizerType.INDIVIDUAL,
      billingCycle: BillingCycle.PER_EVENT,
      features: [
        'Up to 600 Guest passes & VIP tagging',
        'Automated Multilingual WhatsApp dispatch',
        'Security gate fraud prevention alerts',
        'Table & Seating arrangement coordinator',
        'Zero-data-loss upgrade path to Agency',
      ],
      isArchived: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'plan_agency_1',
      planName: 'Agency Pro Pass',
      price: 120000,
      organizerType: OrganizerType.AGENCY,
      billingCycle: BillingCycle.MONTHLY,
      features: [
        'Unlimited active events & clients',
        'Full team role permissions (Manager, Staff)',
        'Custom white-label WhatsApp branding',
        'Multi-gate live sync and turnstile scanner ops',
        'Dedicated VIP guest concierge & voice notes',
      ],
      isArchived: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'plan_venue_1',
      planName: 'Venue Enterprise Pass',
      price: 250000,
      organizerType: OrganizerType.VENUE,
      billingCycle: BillingCycle.MONTHLY,
      features: [
        'Multi-space and hall booking calendar',
        'Automated guest safety capacity controls',
        'Turnstile & Gate hardware scanner integration',
        'Real-time catering & dietary preference telemetry',
        'Dedicated account manager & 24/7 hotline',
      ],
      isArchived: false,
      createdAt: new Date().toISOString(),
    },
  ];

  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

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
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_INDIVIDUAL } }),
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_AGENCY } }),
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_VENUE } }),
      this.prisma.event.count({
        where: { status: { in: [EventStatus.LIVE, EventStatus.PUBLISHED] } },
      }),
      this.prisma.event.count({ where: { status: EventStatus.COMPLETED } }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: 'PAID' },
      }),
    ]);

    const totalOrganizers = individualCount + agencyCount + venueCount;
    const totalRevenueAmount = ordersAgg._sum.totalAmount || 0;

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
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_INDIVIDUAL } }),
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_AGENCY } }),
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_VENUE } }),
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
        where: { role: UserRole.ORGANIZER_INDIVIDUAL },
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
        where: { role: UserRole.ORGANIZER_AGENCY },
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
        where: { role: UserRole.ORGANIZER_VENUE },
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

    const individualRevenue = calculateSum(individualUsers);
    const agencyRevenue = calculateSum(agencyUsers);
    const venueRevenue = calculateSum(venueUsers);
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

    let finalEvents = events;
    let finalTotal = total;

    // If database table currently has 0 active events, automatically seed initial events so the dashboard is immediately populated
    if (finalTotal === 0 && (!search || !search.trim())) {
      let organizer = await this.prisma.user.findFirst({
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

      if (!organizer) {
        organizer = await this.prisma.user.create({
          data: {
            email: 'organizer.demo@mceniesvite.com',
            fullName: 'Premium Events Ng',
            passwordHash: '$2a$10$xyz...',
            role: UserRole.ORGANIZER_AGENCY,
            agencyProfile: {
              create: {
                agencyName: 'Premium Events Ng',
                billingEmail: 'billing@premiumevents.ng',
              },
            },
          },
        });
      }

      const sampleEvents = [
        {
          title: 'The Grand Royal Gala & Investiture',
          slug: `grand-royal-gala-${Date.now()}-1`,
          description: 'A prestigious royal celebration with dinner and red carpet.',
          category: 'Gala',
          status: EventStatus.LIVE,
          startDate: new Date('2026-10-24T14:00:00Z'),
          endDate: new Date('2026-10-24T23:00:00Z'),
          venueName: 'The Monarch Event Centre',
          capacity: 600,
          organizerId: organizer.id,
        },
        {
          title: 'Imperial Wedding Ceremony',
          slug: `imperial-wedding-${Date.now()}-2`,
          description: 'Celebration of love with families and distinguished dignitaries.',
          category: 'Wedding',
          status: EventStatus.PUBLISHED,
          startDate: new Date('2026-11-15T12:00:00Z'),
          endDate: new Date('2026-11-15T20:00:00Z'),
          venueName: 'Landmark Centre Hall 1',
          capacity: 450,
          organizerId: organizer.id,
        },
        {
          title: 'Tech Summit & Expo Africa 2026',
          slug: `tech-summit-${Date.now()}-3`,
          description: 'Pan-African tech gathering and innovation summit.',
          category: 'Conference',
          status: EventStatus.LIVE,
          startDate: new Date('2026-11-20T09:00:00Z'),
          endDate: new Date('2026-11-22T18:00:00Z'),
          venueName: 'Eko Convention Centre',
          capacity: 1500,
          organizerId: organizer.id,
        },
        {
          title: 'Lagos Cultural Banquet & Fashion Exhibition',
          slug: `lagos-cultural-banquet-${Date.now()}-4`,
          description: 'Showcasing contemporary African arts and heritage.',
          category: 'Social',
          status: EventStatus.PUBLISHED,
          startDate: new Date('2026-12-01T17:00:00Z'),
          endDate: new Date('2026-12-01T23:00:00Z'),
          venueName: 'Civic Centre Victoria Island',
          capacity: 350,
          organizerId: organizer.id,
        },
        {
          title: 'Annual Enterprise Leadership Conference',
          slug: `enterprise-leadership-${Date.now()}-5`,
          description: 'Executive summit for industry leaders.',
          category: 'Conference',
          status: EventStatus.LIVE,
          startDate: new Date('2026-12-10T08:30:00Z'),
          endDate: new Date('2026-12-10T17:00:00Z'),
          venueName: 'Federal Palace Hotel',
          capacity: 500,
          organizerId: organizer.id,
        },
      ];

      for (const ev of sampleEvents) {
        await this.prisma.event.create({ data: ev });
      }

      // Re-fetch created records
      finalEvents = await this.prisma.event.findMany({
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
      });
      finalTotal = await this.prisma.event.count({ where: whereClause });
    }

    const formattedEvents = finalEvents.map((ev) => {
      let orgName = ev.organizer.fullName;
      let orgType = 'Individual';

      if (ev.organizer.role === UserRole.ORGANIZER_AGENCY) {
        orgType = 'Agency';
        orgName = ev.organizer.agencyProfile?.agencyName || ev.organizer.fullName;
      } else if (ev.organizer.role === UserRole.ORGANIZER_VENUE) {
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
        total: finalTotal,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(finalTotal / limitNum),
      },
    };
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

    if (event.organizer.role === UserRole.ORGANIZER_AGENCY) {
      organizerType = 'Agency';
      organizerName = event.organizer.agencyProfile?.agencyName || event.organizer.fullName;
      billingPlan = 'Included in subscription';
    } else if (event.organizer.role === UserRole.ORGANIZER_VENUE) {
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

  async getOrganizers(filter?: FilterOrganizersDto) {
    const pageNum = Math.max(1, Number(filter?.page) || 1);
    const limitNum = Math.max(1, Number(filter?.limit) || 10);
    const skip = (pageNum - 1) * limitNum;

    // Base condition: only organizers (Individual, Agency, Venue)
    const baseRoles = [
      UserRole.ORGANIZER_INDIVIDUAL,
      UserRole.ORGANIZER_AGENCY,
      UserRole.ORGANIZER_VENUE,
    ];

    const whereClause: any = {
      role: { in: baseRoles },
    };

    // Filter by Type
    if (filter?.type && filter.type !== FilterOrganizerType.ALL) {
      if (filter.type === FilterOrganizerType.INDIVIDUAL) {
        whereClause.role = UserRole.ORGANIZER_INDIVIDUAL;
      } else if (filter.type === FilterOrganizerType.AGENCY) {
        whereClause.role = UserRole.ORGANIZER_AGENCY;
      } else if (filter.type === FilterOrganizerType.VENUE) {
        whereClause.role = UserRole.ORGANIZER_VENUE;
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
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_INDIVIDUAL } }),
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_AGENCY } }),
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_VENUE } }),
    ]);

    const formattedOrganizers = users.map((user) => {
      let displayName = user.fullName;
      let organizerType: 'Individual' | 'Agency' | 'Venue' = 'Individual';
      let planName = 'Essential Event Pass';

      if (user.role === UserRole.ORGANIZER_AGENCY) {
        organizerType = 'Agency';
        displayName = user.agencyProfile?.agencyName || user.fullName;
        planName = 'Pro Subscription';
      } else if (user.role === UserRole.ORGANIZER_VENUE) {
        organizerType = 'Venue';
        displayName = user.venueProfile?.propertyName || user.fullName;
        planName = 'Venue Subscription';
      }

      return {
        id: user.id,
        name: displayName,
        contactEmail: user.email,
        phone: user.phone,
        type: organizerType,
        status: user.status === UserStatus.ACTIVE ? 'Active' : user.status === UserStatus.SUSPENDED ? 'Suspended' : 'Pending',
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
    let planName = 'Essential Event Pass';

    if (user.role === UserRole.ORGANIZER_AGENCY) {
      organizerType = 'Agency';
      displayName = user.agencyProfile?.agencyName || user.fullName;
      planName = 'Pro Subscription';
    } else if (user.role === UserRole.ORGANIZER_VENUE) {
      organizerType = 'Venue';
      displayName = user.venueProfile?.propertyName || user.fullName;
      planName = 'Venue Subscription';
    }

    return {
      id: user.id,
      name: displayName,
      contactEmail: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      type: organizerType,
      role: user.role,
      status: user.status === UserStatus.ACTIVE ? 'Active' : user.status === UserStatus.SUSPENDED ? 'Suspended' : 'Pending',
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

    const newPlan: PlanItem = {
      id: `plan_${dto.organizerType.toLowerCase()}_${Date.now()}`,
      planName: dto.planName,
      price: rawPrice,
      organizerType: dto.organizerType,
      billingCycle: dto.billingCycle,
      features: dto.features && dto.features.length > 0 ? dto.features : ['Core Platform Access'],
      isArchived: dto.isArchived ?? false,
      createdAt: new Date().toISOString(),
    };

    this.plansStore.unshift(newPlan);

    try {
      await this.prisma.platformSetting.upsert({
        where: { key: `PLAN_${newPlan.id}` },
        update: { value: JSON.stringify(newPlan) },
        create: {
          key: `PLAN_${newPlan.id}`,
          value: JSON.stringify(newPlan),
          description: `Plan created for ${dto.organizerType}`,
        },
      });
    } catch {}

    return newPlan;
  }

  async getPlans(type?: OrganizerType): Promise<PlanItem[]> {
    if (type) {
      return this.plansStore.filter(
        (p) => p.organizerType.toLowerCase() === type.toLowerCase() && !p.isArchived,
      );
    }
    return this.plansStore;
  }

  async getPlanById(id: string): Promise<PlanItem> {
    const plan = this.plansStore.find((p) => p.id === id);
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<PlanItem> {
    const planIndex = this.plansStore.findIndex((p) => p.id === id);
    if (planIndex === -1) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    const existing = this.plansStore[planIndex];
    let numericPrice = existing.price;

    if (dto.price !== undefined) {
      numericPrice = typeof dto.price === 'number'
        ? dto.price
        : Number(String(dto.price).replace(/[^0-9.]/g, '')) || 0;
    }

    const updatedPlan: PlanItem = {
      ...existing,
      planName: dto.planName ?? existing.planName,
      price: numericPrice,
      organizerType: dto.organizerType ?? existing.organizerType,
      billingCycle: dto.billingCycle ?? existing.billingCycle,
      features: dto.features ?? existing.features,
      isArchived: dto.isArchived ?? existing.isArchived,
      updatedAt: new Date().toISOString(),
    };

    this.plansStore[planIndex] = updatedPlan;

    try {
      await this.prisma.platformSetting.upsert({
        where: { key: `PLAN_${updatedPlan.id}` },
        update: { value: JSON.stringify(updatedPlan) },
        create: {
          key: `PLAN_${updatedPlan.id}`,
          value: JSON.stringify(updatedPlan),
          description: `Plan updated for ${updatedPlan.organizerType}`,
        },
      });
    } catch {}

    return updatedPlan;
  }

  async deletePlan(id: string): Promise<{ deleted: boolean; id: string }> {
    const planIndex = this.plansStore.findIndex((p) => p.id === id);
    if (planIndex === -1) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    this.plansStore.splice(planIndex, 1);

    try {
      await this.prisma.platformSetting.delete({
        where: { key: `PLAN_${id}` },
      });
    } catch {}

    return { deleted: true, id };
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

    const [
      totalRevenueAgg,
      currentMonthAgg,
      lastMonthAgg,
      agencyCount,
      venueCount,
    ] = await Promise.all([
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
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_AGENCY } }),
      this.prisma.user.count({ where: { role: UserRole.ORGANIZER_VENUE } }),
    ]);

    const totalRevenue = totalRevenueAgg._sum.totalAmount || 0;
    const curMonthRev = currentMonthAgg._sum.totalAmount || 0;
    const lastMonthRev = lastMonthAgg._sum.totalAmount || 0;

    let momGrowthPercentage = 0;
    if (lastMonthRev > 0) {
      momGrowthPercentage = Math.round(((curMonthRev - lastMonthRev) / lastMonthRev) * 100);
    } else if (curMonthRev > 0) {
      momGrowthPercentage = 100;
    }

    const availablePlansCount = this.plansStore.filter((p) => !p.isArchived).length;
    const activeSubscriptions = agencyCount + venueCount;

    return {
      totalRevenue: {
        amount: totalRevenue,
      },
      momGrowth: {
        percentage: momGrowthPercentage,
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
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    const paidOrders = await this.prisma.order.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = monthNames.map((month, index) => {
      const monthOrders = paidOrders.filter((o) => new Date(o.createdAt).getMonth() === index);
      const amount = monthOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      return {
        month,
        amount,
      };
    });

    return {
      period,
      year: currentYear,
      data: monthlyData,
    };
  }

  /**
   * 3. Revenue Transactions Table with filtering & pagination (Real DB Orders)
   */
  async getRevenueTransactions(
    status: string = 'All',
    search?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (status && status !== 'All') {
      whereClause.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { buyerName: { contains: q, mode: 'insensitive' } },
        { buyerEmail: { contains: q, mode: 'insensitive' } },
        { event: { title: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [orders, totalOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        skip,
        take: limitNum,
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
      this.prisma.order.count({ where: whereClause }),
    ]);

    const transactionData = orders.map((o) => {
      let orgType = 'Individual';
      const organizer = o.event?.organizer || o.buyer;
      let orgName = organizer?.fullName || o.buyerName || 'Organizer';

      if (organizer?.role === UserRole.ORGANIZER_AGENCY) {
        orgType = 'Agency';
        orgName = organizer.agencyProfile?.agencyName || organizer.fullName;
      } else if (organizer?.role === UserRole.ORGANIZER_VENUE) {
        orgType = 'Venue';
        orgName = organizer.venueProfile?.propertyName || organizer.fullName;
      }

      return {
        id: o.id,
        txId: o.orderNumber,
        date: o.createdAt,
        organizer: orgName,
        organizerType: orgType,
        amount: o.totalAmount,
        currency: o.currency,
        status: o.status,
        plan: o.event?.title || null,
      };
    });

    return {
      data: transactionData,
      meta: {
        total: totalOrders,
        page: pageNum,
        limit: limitNum,
        totalPages: totalOrders > 0 ? Math.ceil(totalOrders / limitNum) : 0,
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
}
