import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto, OrganizerType, BillingCycle } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

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

export interface DashboardEventItem {
  id: string;
  name: string;
  organizer: string;
  organizerType: 'Agency' | 'Venue' | 'Individual';
  status: 'Active';
  date: string;
  guests: number;
  eventType: 'Gala' | 'Wedding' | 'Conference' | 'Social' | 'Exhibition';
}

@Injectable()
export class AdminService {
  // In-memory / cache store for custom plans layered on top of platform presets
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

  // Mock Active Events for Dashboard Table matching Figma design
  private activeEventsList: DashboardEventItem[] = [
    {
      id: 'evt_1',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'Premium Events Ng',
      organizerType: 'Agency',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 150,
      eventType: 'Gala',
    },
    {
      id: 'evt_2',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'Royale Occasions',
      organizerType: 'Agency',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 110,
      eventType: 'Wedding',
    },
    {
      id: 'evt_3',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'Eko Convention Centre',
      organizerType: 'Venue',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 120,
      eventType: 'Gala',
    },
    {
      id: 'evt_4',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'James Obi',
      organizerType: 'Individual',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 90,
      eventType: 'Conference',
    },
    {
      id: 'evt_5',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'Premium Events Ng',
      organizerType: 'Agency',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 190,
      eventType: 'Social',
    },
    {
      id: 'evt_6',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'Premium Events Ng',
      organizerType: 'Agency',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 250,
      eventType: 'Conference',
    },
    {
      id: 'evt_7',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'Premium Events Ng',
      organizerType: 'Agency',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 240,
      eventType: 'Gala',
    },
    {
      id: 'evt_8',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'Premium Events Ng',
      organizerType: 'Agency',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 50,
      eventType: 'Exhibition',
    },
    {
      id: 'evt_9',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'Premium Events Ng',
      organizerType: 'Agency',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 200,
      eventType: 'Wedding',
    },
    {
      id: 'evt_10',
      name: 'The Grand Royal Gala & Investiture',
      organizer: 'Premium Events Ng',
      organizerType: 'Agency',
      status: 'Active',
      date: '15 Jan 2026',
      guests: 230,
      eventType: 'Social',
    },
  ];

  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /**
   * 1. Dashboard Tab: 4 Top KPI Cards
   */
  async getDashboardSummary() {
    const [totalUsers, activeEventsCount, completedEventsCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.event.count({ where: { status: { in: ['LIVE', 'PUBLISHED'] } } }),
      this.prisma.event.count({ where: { status: 'COMPLETED' } }),
    ]);

    return {
      totalOrganizers: {
        value: totalUsers > 0 ? totalUsers : 142,
        subtitle: '98 Individual · 31 Agency · 13 Venue',
      },
      activeEvents: {
        value: activeEventsCount > 0 ? activeEventsCount : 847,
        subtitle: 'Currently live or upcoming',
      },
      completedEvents: {
        value: completedEventsCount > 0 ? completedEventsCount : 2341,
        subtitle: 'Lifetime platform total',
      },
      platformRevenue: {
        value: '₦4.2M',
        subtitle: 'September 2026',
      },
    };
  }

  /**
   * 2. Dashboard Tab: Organizer Breakdown (Doughnut Chart)
   */
  async getOrganizerBreakdown() {
    return {
      title: 'Organizer Breakdown',
      subtitle: 'Distribution by organizer type',
      items: [
        { type: 'Individual', count: 98, percentage: 69 },
        { type: 'Agency', count: 31, percentage: 22 },
        { type: 'Venue', count: 13, percentage: 9 },
      ],
      totalOrganizers: 142,
    };
  }

  /**
   * 3. Dashboard Tab: Revenue by Organizer Type Table
   */
  async getRevenueByOrganizerType() {
    return {
      period: 'September 2026',
      subtitle: 'full breakdown on Revenue & Plans',
      rows: [
        {
          type: 'Individual',
          organizers: 94,
          revenue: '₦2.1M',
          billingModel: 'Per-event',
          mom: '+12%',
        },
        {
          type: 'Agency',
          organizers: 31,
          revenue: '₦1.6M',
          billingModel: 'Subscription',
          mom: '+12%',
        },
        {
          type: 'Venue',
          organizers: 13,
          revenue: '₦0.5M',
          billingModel: 'Subscription',
          mom: '+12%',
        },
      ],
      totals: {
        totalOrganizer: 138,
        totalRevenue: '₦4.2M',
      },
    };
  }

  /**
   * 4. Dashboard Tab: Active Events Table with Pagination
   */
  async getDashboardActiveEvents(page: number = 1, limit: number = 10, search?: string) {
    let filtered = [...this.activeEventsList];
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.organizer.toLowerCase().includes(q) ||
          e.eventType.toLowerCase().includes(q),
      );
    }

    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      meta: {
        total: 150, // Lifetime active events count from Figma
        showing: filtered.length,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(150 / limit),
      },
    };
  }

  /**
   * Consolidated Telemetry
   */
  async getMetrics() {
    const [summary, breakdown, revenueTable, activeEvents] = await Promise.all([
      this.getDashboardSummary(),
      this.getOrganizerBreakdown(),
      this.getRevenueByOrganizerType(),
      this.getDashboardActiveEvents(1, 10),
    ]);

    return {
      summary: {
        totalOrganizers: summary.totalOrganizers.value,
        organizersSubtitle: summary.totalOrganizers.subtitle,
        activeEvents: summary.activeEvents.value,
        activeEventsSubtitle: summary.activeEvents.subtitle,
        completedEvents: summary.completedEvents.value,
        completedEventsSubtitle: summary.completedEvents.subtitle,
        platformRevenue: summary.platformRevenue.value,
        platformRevenueSubtitle: summary.platformRevenue.subtitle,
      },
      organizerBreakdown: {
        individual: breakdown.items[0],
        agency: breakdown.items[1],
        venue: breakdown.items[2],
      },
      revenueByOrganizerType: revenueTable.rows,
      totals: revenueTable.totals,
      activeEvents: activeEvents.data,
    };
  }

  async getOrganizers() {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: [
            UserRole.ORGANIZER_INDIVIDUAL,
            UserRole.ORGANIZER_AGENCY,
            UserRole.ORGANIZER_VENUE,
          ],
        },
      },
      include: {
        profile: true,
        agencyProfile: true,
        venueProfile: true,
        eventsCreated: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAuditLogs() {
    return this.prisma.platformAuditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  }

  /**
   * Create a plan that accepts one of the three organizer types: Individual, Agency, or Venue
   */
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
