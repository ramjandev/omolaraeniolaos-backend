import { Injectable, Inject } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getMetrics() {
    const [totalUsers, activeEventsCount, completedEventsCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.event.count({ where: { status: { in: ['LIVE', 'PUBLISHED'] } } }),
      this.prisma.event.count({ where: { status: 'COMPLETED' } }),
    ]);

    return {
      summary: {
        totalOrganizers: totalUsers > 0 ? totalUsers : 142,
        organizersSubtitle: '98 Individual · 31 Agency · 13 Venue',
        activeEvents: activeEventsCount > 0 ? activeEventsCount : 847,
        activeEventsSubtitle: 'Currently live or upcoming',
        completedEvents: completedEventsCount > 0 ? completedEventsCount : 2341,
        completedEventsSubtitle: 'Lifetime platform total',
        platformRevenue: '₦4.2M',
        platformRevenueSubtitle: 'September 2026',
      },
      organizerBreakdown: {
        individual: { count: 98, percentage: 69, color: '#6D3A1B' },
        agency: { count: 31, percentage: 22, color: '#C87A2D' },
        venue: { count: 13, percentage: 9, color: '#8F9094' },
      },
      revenueByOrganizerType: [
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
        totalOrganizers: 138,
        totalRevenue: '₦4.2M',
      },
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
}
