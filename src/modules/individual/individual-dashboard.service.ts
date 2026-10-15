import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventStatus, AttendeeStatus, OrderStatus } from '@prisma/client';
import {
  IndividualDashboardResponseDto,
  IndividualUserDto,
  IndividualActiveEventDto,
  IndividualSetupChecklistDto,
  IndividualMetricsDto,
  IndividualRecentAttendeeDto,
  IndividualRecentOrderDto,
} from './dto/individual-dashboard.dto';

@Injectable()
export class IndividualDashboardService {
  private readonly logger = new Logger(IndividualDashboardService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Resolve relational User record for individual organizer
   */
  private async resolveUser(userId?: string): Promise<IndividualUserDto | null> {
    if (!userId) return null;
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (err: any) {
      this.logger.error(`Error resolving user from database: ${err.message}`);
      return null;
    }
  }

  /**
   * Main relational individual organizer dashboard overview
   */
  async getDashboardOverview(userId?: string): Promise<IndividualDashboardResponseDto> {
    const user = await this.resolveUser(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const targetUserId = user.id;

    // 1. Relational Active Event Query with relations
    let activeEvent: any = null;
    try {
      if (targetUserId) {
        activeEvent = await this.prisma.event.findFirst({
          where: { organizerId: targetUserId },
          orderBy: { createdAt: 'desc' },
          include: {
            ticketTiers: {
              select: {
                id: true,
                name: true,
                price: true,
                capacity: true,
                soldCount: true,
              },
            },
            tableZones: {
              select: {
                id: true,
                zoneName: true,
                tableCount: true,
                seatPerTable: true,
                totalCapacity: true,
              },
            },
            _count: {
              select: {
                attendees: true,
                orders: true,
                ticketTiers: true,
                tableZones: true,
              },
            },
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Error querying active event: ${err.message}`);
    }

    // 2. Relational Checklist Progress Computed from Database Columns
    const basicsCompleted = Boolean(activeEvent?.title && activeEvent?.startDate && activeEvent?.category);
    const detailsCompleted = Boolean(activeEvent?.description && (activeEvent?.venueName || activeEvent?.isVirtual));
    const guestsConfigured = Boolean((activeEvent?.ticketTiers?.length || 0) > 0 || (activeEvent?._count?.attendees || 0) > 0);
    const invitationsSent = Boolean((activeEvent?._count?.attendees || 0) > 0);
    const rsvpConfigured = Boolean((activeEvent?._count?.attendees || 0) > 0);
    const seatingConfigured = Boolean((activeEvent?.tableZones?.length || 0) > 0);

    const steps = [
      { stepNumber: 1, key: 'basics', title: 'Event Basic', isCompleted: basicsCompleted },
      { stepNumber: 2, key: 'details', title: 'Event Details', isCompleted: detailsCompleted },
      { stepNumber: 3, key: 'guests', title: 'Guests', isCompleted: guestsConfigured },
      { stepNumber: 4, key: 'invitation', title: 'Invitation', isCompleted: invitationsSent },
      { stepNumber: 5, key: 'rsvp', title: 'Set up RSVP', isCompleted: rsvpConfigured },
      { stepNumber: 6, key: 'seating', title: 'Seating & protocol', isCompleted: seatingConfigured },
    ];

    const completedCount = steps.filter((s) => s.isCompleted).length;
    const totalCount = steps.length;
    const completionPercentage = Math.round((completedCount / totalCount) * 100);

    const setupChecklist: IndividualSetupChecklistDto = {
      basicsCompleted,
      detailsCompleted,
      guestsConfigured,
      invitationsSent,
      rsvpConfigured,
      seatingConfigured,
      completedCount,
      totalCount,
      completionPercentage,
      steps,
    };

    // 3. Relational Metrics & Aggregations
    let totalEvents = 0;
    let draftEvents = 0;
    let liveEvents = 0;
    let completedEvents = 0;
    let totalCapacity = 0;
    let totalAttendees = 0;
    let confirmedAttendees = 0;
    let checkedInAttendees = 0;
    let totalRevenue = 0;

    try {
      const eventFilter = targetUserId ? { organizerId: targetUserId } : {};

      totalEvents = await this.prisma.event.count({ where: eventFilter });
      draftEvents = await this.prisma.event.count({
        where: { ...eventFilter, status: EventStatus.DRAFT },
      });
      liveEvents = await this.prisma.event.count({
        where: { ...eventFilter, status: { in: [EventStatus.LIVE, EventStatus.PUBLISHED] } },
      });
      completedEvents = await this.prisma.event.count({
        where: { ...eventFilter, status: EventStatus.COMPLETED },
      });

      const capacityAgg = await this.prisma.event.aggregate({
        where: eventFilter,
        _sum: { capacity: true },
      });
      totalCapacity = capacityAgg._sum.capacity || activeEvent?.capacity || 0;

      const attendeeWhere = activeEvent?.id
        ? { eventId: activeEvent.id }
        : targetUserId
        ? { event: { organizerId: targetUserId } }
        : {};

      totalAttendees = await this.prisma.attendee.count({ where: attendeeWhere });
      confirmedAttendees = await this.prisma.attendee.count({
        where: { ...attendeeWhere, status: AttendeeStatus.ATTENDING },
      });
      checkedInAttendees = await this.prisma.attendee.count({
        where: { ...attendeeWhere, status: AttendeeStatus.CHECKED_IN },
      });

      const orderAgg = await this.prisma.order.aggregate({
        where: {
          ...(activeEvent?.id ? { eventId: activeEvent.id } : targetUserId ? { event: { organizerId: targetUserId } } : {}),
          status: OrderStatus.PAID,
        },
        _sum: { totalAmount: true },
      });
      totalRevenue = orderAgg._sum.totalAmount || 0;
    } catch (err: any) {
      this.logger.error(`Error querying relational metrics: ${err.message}`);
    }

    const metrics: IndividualMetricsDto = {
      totalEvents,
      draftEvents,
      liveEvents,
      completedEvents,
      totalCapacity,
      totalAttendees,
      confirmedAttendees,
      checkedInAttendees,
      totalRevenue,
    };

    // 4. Relational Recent Attendees
    let recentAttendees: IndividualRecentAttendeeDto[] = [];
    try {
      const attendeeFilter = activeEvent?.id
        ? { eventId: activeEvent.id }
        : targetUserId
        ? { event: { organizerId: targetUserId } }
        : {};

      recentAttendees = await this.prisma.attendee.findMany({
        where: attendeeFilter,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          checkInTime: true,
          createdAt: true,
        },
      });
    } catch (err: any) {
      this.logger.error(`Error querying recent attendees: ${err.message}`);
    }

    // 5. Relational Recent Orders
    let recentOrders: IndividualRecentOrderDto[] = [];
    try {
      const orderFilter = activeEvent?.id
        ? { eventId: activeEvent.id }
        : targetUserId
        ? { event: { organizerId: targetUserId } }
        : {};

      recentOrders = await this.prisma.order.findMany({
        where: orderFilter,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          buyerName: true,
          buyerEmail: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (err: any) {
      this.logger.error(`Error querying recent orders: ${err.message}`);
    }

    return {
      user,
      activeEvent,
      setupChecklist,
      metrics,
      recentAttendees,
      recentOrders,
    };
  }

  /**
   * List all events for the individual organizer from relational database
   */
  async getEvents(userId?: string) {
    const user = await this.resolveUser(userId);
    const targetUserId = user?.id;

    return this.prisma.event.findMany({
      where: { organizerId: targetUserId ?? '' },
      include: {
        ticketTiers: true,
        tableZones: true,
        _count: {
          select: {
            attendees: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List attendees for the individual organizer's events from relational database
   */
  async getAttendees(userId?: string) {
    const user = await this.resolveUser(userId);
    const targetUserId = user?.id;

    return this.prisma.attendee.findMany({
      where: { event: { organizerId: targetUserId ?? '' } },
      include: {
        event: {
          select: {
            id: true,
            title: true,
          },
        },
        ticketTier: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Relational metrics only
   */
  async getMetrics(userId?: string): Promise<IndividualMetricsDto> {
    const overview = await this.getDashboardOverview(userId);
    return overview.metrics;
  }
}
