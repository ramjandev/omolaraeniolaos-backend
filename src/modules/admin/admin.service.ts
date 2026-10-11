import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { UserRole, EventStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto, OrganizerType, BillingCycle } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { FilterOrganizersDto, FilterOrganizerType, FilterOrganizerStatus } from './dto/filter-organizers.dto';

export interface PlanItem {
  id: string;
  planName: string;
  price: string;
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
      price: '₦00',
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
      price: '₦35,000',
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
      price: '₦120,000',
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
      price: '₦250,000',
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

    const formattedEvents = events.map((ev) => {
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
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
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

    return event;
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
    const formattedPrice = typeof dto.price === 'number' 
      ? `₦${dto.price.toLocaleString()}` 
      : dto.price.startsWith('₦') 
      ? dto.price 
      : `₦${dto.price}`;

    const newPlan: PlanItem = {
      id: `plan_${dto.organizerType.toLowerCase()}_${Date.now()}`,
      planName: dto.planName,
      price: formattedPrice,
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
    let formattedPrice = existing.price;

    if (dto.price !== undefined) {
      formattedPrice = typeof dto.price === 'number'
        ? `₦${dto.price.toLocaleString()}`
        : dto.price.startsWith('₦')
        ? dto.price
        : `₦${dto.price}`;
    }

    const updatedPlan: PlanItem = {
      ...existing,
      planName: dto.planName ?? existing.planName,
      price: formattedPrice,
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
}
