import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { BookingStatus, EventStatus, Prisma, SpaceStatus, SpaceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSpaceDto, UpdateSpaceDto } from './dto/create-space.dto';
import { SaveTableDto, SaveZoneDto } from './dto/seating.dto';
import { randomUUID } from 'crypto';

type SeatCategory = 'VIP' | 'Standard' | 'Accessible';
type SeatStatus = 'Reserved' | 'Available' | 'Unavailable';
type LayoutTable = { id: string; name: string; seats: number; seatType: SeatCategory; status: SeatStatus };
type ZoneLayout = { category: SeatCategory; tables: LayoutTable[] };

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  [SpaceType.BALLROOM]: 'Ballroom',
  [SpaceType.AUDITORIUM]: 'Auditorium',
  [SpaceType.TERRACE]: 'Terrace',
  [SpaceType.BOARDROOM]: 'Boardroom',
  [SpaceType.EXHIBITION_HALL]: 'Exhibition Hall',
  [SpaceType.BANQUET_HALL]: 'Banquet Hall',
  [SpaceType.ROOFTOP]: 'Rooftop',
};

type DashboardStatus = 'Confirmed' | 'Tentative' | 'Awaiting' | 'Cancelled';

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function bookingStatus(status: BookingStatus | EventStatus): DashboardStatus {
  if (status === BookingStatus.CANCELLED) return 'Cancelled';
  if (status === BookingStatus.PENDING || status === EventStatus.DRAFT) return 'Awaiting';
  return 'Confirmed';
}

const spaceInclude = {
  venue: { select: { address: true, city: true, country: true, propertyName: true } },
  bookings: {
    include: { event: { select: { title: true, category: true } } },
    orderBy: { startDate: 'asc' as const },
  },
  tableZones: { include: { assignments: true } },
} satisfies Prisma.VenueSpaceInclude;

type SpaceRow = Prisma.VenueSpaceGetPayload<{ include: typeof spaceInclude }> & {
  description: string | null;
  address: string | null;
};

function displayAddress(space: SpaceRow) {
  if (space.address?.trim()) return space.address.trim();
  return [space.venue.address, space.venue.city, space.venue.country].filter(Boolean).join(', ');
}

function spaceIsOccupied(space: SpaceRow, now = new Date()) {
  if (space.status === SpaceStatus.BOOKED) return true;
  return space.bookings.some((booking) => {
    if (booking.status === BookingStatus.CANCELLED) return false;
    return booking.startDate <= now && booking.endDate >= now;
  });
}

function spaceStatusLabel(space: SpaceRow) {
  if (space.status === SpaceStatus.MAINTENANCE) return 'Maintenance';
  if (space.status === SpaceStatus.CLOSED) return 'Closed';
  return spaceIsOccupied(space) ? 'Occupied' : 'Available';
}

function upcomingBookings(space: SpaceRow) {
  const today = startOfDay(new Date());
  return space.bookings
    .filter((booking) => booking.status !== BookingStatus.CANCELLED && booking.endDate >= today)
    .map((booking) => ({
      id: booking.id,
      event: booking.event?.title || booking.clientName,
      category: booking.event?.category || 'Event',
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      organizer: booking.clientName,
      guests: booking.totalGuests,
      status: bookingStatus(booking.status),
    }));
}

function toSpaceCard(space: SpaceRow) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const bookedDays = new Set(
    space.bookings
      .filter((booking) => {
        if (booking.status === BookingStatus.CANCELLED) return false;
        return booking.startDate.getFullYear() === now.getFullYear()
          && booking.startDate.getMonth() === now.getMonth();
      })
      .map((booking) => booking.startDate.getDate()),
  );
  const next = upcomingBookings(space)[0] ?? null;
  const configured = space.tableZones.reduce((sum, zone) => sum + zone.totalCapacity, 0);
  const reserved = space.tableZones.reduce((sum, zone) => sum + zone.assignments.length, 0);
  return {
    id: space.id,
    name: space.name,
    type: SPACE_TYPE_LABELS[space.type] || space.type,
    typeValue: space.type,
    capacity: space.capacity,
    address: displayAddress(space),
    description: space.description,
    imageUrl: space.imageUrl,
    amenities: space.amenities,
    status: spaceStatusLabel(space),
    statusValue: space.status,
    active: space.status !== SpaceStatus.CLOSED,
    spacesCount: space.tableZones.length || 1,
    utilization: Math.round((bookedDays.size / daysInMonth) * 100),
    nextBooking: next,
    seating: {
      configured,
      reserved,
      available: Math.max(configured - reserved, 0),
    },
  };
}

function toSpaceDetail(space: SpaceRow) {
  return {
    ...toSpaceCard(space),
    areas: space.tableZones.map((zone) => ({
      id: zone.id,
      name: zone.zoneName,
      tables: zone.tableCount,
      seats: zone.totalCapacity,
    })),
    bookings: upcomingBookings(space),
  };
}

function emptySpaceMetrics() {
  return { totalVenues: 0, venuesChange: null, totalSpaces: 0, available: 0, occupied: 0 };
}

function spaceMetrics(spaces: SpaceRow[]) {
  const cards = spaces.map(toSpaceCard);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const createdThisMonth = spaces.filter((space) => space.createdAt >= monthStart).length;
  const createdLastMonth = spaces.filter(
    (space) => space.createdAt >= previousStart && space.createdAt < monthStart,
  ).length;
  const zones = spaces.reduce((sum, space) => sum + space.tableZones.length, 0);
  return {
    totalVenues: spaces.length,
    venuesChange: percentChange(createdThisMonth, createdLastMonth),
    totalSpaces: zones || spaces.length,
    available: cards.filter((space) => space.status === 'Available').length,
    occupied: cards.filter((space) => space.status === 'Occupied').length,
  };
}

@Injectable()
export class VenueService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getSpaces(userId?: string) {
    if (!userId) {
      return { metrics: emptySpaceMetrics(), spaces: [] };
    }
    const venue = await this.ensureOwnedVenue(userId, false);
    if (!venue) {
      return { metrics: emptySpaceMetrics(), spaces: [] };
    }
    const spaces = await this.loadSpaces(venue.id);
    return { metrics: spaceMetrics(spaces), spaces: spaces.map(toSpaceCard) };
  }

  async getSpace(userId: string, spaceId: string) {
    const space = await this.findOwnedSpace(userId, spaceId);
    return toSpaceDetail(space);
  }

  async createSpace(userId: string, dto: CreateSpaceDto) {
    const venue = await this.ensureOwnedVenue(userId, true, dto.address);
    if (!venue) throw new NotFoundException('Venue profile could not be created');
    const created = await this.prisma.venueSpace.create({
      data: {
        venueId: venue.id,
        name: dto.name.trim(),
        type: dto.type,
        capacity: dto.capacity ?? 100,
        squareMeters: 1,
        dailyRate: 0,
        currency: 'NGN',
        status: dto.status ?? SpaceStatus.AVAILABLE,
        imageUrl: dto.imageUrl || null,
        amenities: dto.amenities ?? [],
      },
    });
    await this.writeSpaceText(created.id, dto.description, dto.address);
    return this.getSpace(userId, created.id);
  }

  async updateSpace(userId: string, spaceId: string, dto: UpdateSpaceDto) {
    await this.findOwnedSpace(userId, spaceId);
    await this.prisma.venueSpace.update({
      where: { id: spaceId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
        ...(dto.amenities !== undefined ? { amenities: dto.amenities } : {}),
      },
    });
    if (dto.description !== undefined || dto.address !== undefined) {
      await this.writeSpaceText(spaceId, dto.description, dto.address, true);
    }
    return this.getSpace(userId, spaceId);
  }

  private async ensureOwnedVenue(userId: string, create: boolean, address?: string) {
    const existing = await this.prisma.venueProfile.findFirst({ where: { userId } });
    if (existing || !create) return existing;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.venueProfile.create({
      data: {
        userId,
        propertyName: `${user?.fullName || 'Venue'}`,
        address: address?.trim() || 'Address not set',
        city: '',
        country: '',
      },
    });
  }

  private async findOwnedSpace(userId: string, spaceId: string) {
    const space = await this.prisma.venueSpace.findFirst({
      where: { id: spaceId, venue: { userId } },
      include: spaceInclude,
    });
    if (!space) throw new NotFoundException('Venue space not found');
    const text = await this.readSpaceText([space.id]);
    return { ...space, description: text[space.id]?.description ?? null, address: text[space.id]?.address ?? null };
  }

  private async loadSpaces(venueId: string) {
    const spaces = await this.prisma.venueSpace.findMany({
      where: { venueId },
      include: spaceInclude,
      orderBy: { createdAt: 'desc' },
    });
    const text = await this.readSpaceText(spaces.map((space) => space.id));
    return spaces.map((space) => ({
      ...space,
      description: text[space.id]?.description ?? null,
      address: text[space.id]?.address ?? null,
    }));
  }

  private async readSpaceText(ids: string[]) {
    const map: Record<string, { description: string | null; address: string | null }> = {};
    if (!ids.length) return map;
    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: string; description: string | null; address: string | null }>>`
        SELECT id, description, address FROM "VenueSpace" WHERE id IN (${Prisma.join(ids)})
      `;
      rows.forEach((row) => {
        map[row.id] = { description: row.description, address: row.address };
      });
    } catch {
      return map;
    }
    return map;
  }

  private async writeSpaceText(id: string, description?: string, address?: string, partial = false) {
    try {
      if (partial) {
        if (description !== undefined) {
          await this.prisma.$executeRaw`UPDATE "VenueSpace" SET description = ${description || null} WHERE id = ${id}`;
        }
        if (address !== undefined) {
          await this.prisma.$executeRaw`UPDATE "VenueSpace" SET address = ${address || null} WHERE id = ${id}`;
        }
        return;
      }
      await this.prisma.$executeRaw`
        UPDATE "VenueSpace"
        SET description = ${description || null}, address = ${address || null}
        WHERE id = ${id}
      `;
    } catch {
      // Columns are added by the schema push. The space itself is already saved.
    }
  }

  async getBookings(userId?: string) {
    const venue = userId
      ? await this.prisma.venueProfile.findFirst({ where: { userId } })
      : null;

    return this.prisma.venueBooking.findMany({
      where: venue ? { venueId: venue.id } : undefined,
      include: {
        space: { select: { name: true, type: true } },
        event: { select: { title: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async getDashboard(userId: string) {
    const now = new Date();
    const today = startOfDay(now);
    const next30 = addDays(today, 30);
    const previous30Start = addDays(today, -30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    const venue = await this.prisma.venueProfile.findFirst({
      where: { userId },
      include: {
        spaces: { orderBy: { capacity: 'desc' } },
        bookings: {
          include: {
            space: { select: { id: true, name: true } },
            event: {
              select: {
                title: true,
                category: true,
                organizer: { select: { fullName: true } },
              },
            },
          },
          orderBy: { startDate: 'asc' },
        },
      },
    });

    const spaceIds = venue?.spaces.map((space) => space.id) ?? [];
    const bookedEventIds = new Set(
      (venue?.bookings ?? []).map((booking) => booking.eventId).filter((id): id is string => Boolean(id)),
    );
    const hostedEvents = spaceIds.length
      ? await this.prisma.event.findMany({
          where: {
            venueSpaceId: { in: spaceIds },
            id: { notIn: [...bookedEventIds] },
            status: { not: EventStatus.ARCHIVED },
          },
          include: {
            venueSpace: { select: { id: true, name: true } },
            organizer: { select: { fullName: true } },
            _count: { select: { attendees: true } },
          },
          orderBy: { startDate: 'asc' },
        })
      : [];

    const bookings = [
      ...(venue?.bookings ?? []).map((booking) => ({
        id: booking.id,
        event: booking.event?.title || booking.clientName,
        category: booking.event?.category || 'Event',
        spaceId: booking.spaceId,
        space: booking.space.name,
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
        organizer: booking.clientName || booking.event?.organizer.fullName || 'Organizer',
        guests: booking.totalGuests,
        status: bookingStatus(booking.status),
      })),
      ...hostedEvents.map((event) => ({
        id: event.id,
        event: event.title,
        category: event.category || 'Event',
        spaceId: event.venueSpaceId,
        space: event.venueSpace?.name || event.venueName || 'Venue',
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        organizer: event.organizer.fullName,
        guests: event._count.attendees || event.capacity,
        status: bookingStatus(event.status),
      })),
    ].sort((a, b) => a.startDate.localeCompare(b.startDate));

    const active = bookings.filter((booking) => booking.status !== 'Cancelled');
    const startsIn = (booking: { startDate: string }, from: Date, to: Date) => {
      const start = new Date(booking.startDate);
      return start >= from && start < to;
    };
    const upcoming = active.filter((booking) => startsIn(booking, today, next30));
    const previousUpcoming = active.filter((booking) => startsIn(booking, previous30Start, today));
    const todayCount = active.filter((booking) => startsIn(booking, today, addDays(today, 1))).length;

    const occupiedSpaceIds = new Set(
      active
        .filter((booking) => {
          const start = new Date(booking.startDate);
          const end = new Date(booking.endDate);
          return start <= now && end >= now;
        })
        .map((booking) => booking.spaceId)
        .filter((id): id is string => Boolean(id)),
    );

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const spaces = (venue?.spaces ?? []).map((space) => {
      const spaceBookings = active.filter((booking) => booking.spaceId === space.id);
      const bookedDays = new Set(
        spaceBookings
          .filter((booking) => {
            const start = new Date(booking.startDate);
            return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth();
          })
          .map((booking) => new Date(booking.startDate).getDate()),
      );
      const nextBooking = spaceBookings.find((booking) => new Date(booking.endDate) >= today);
      const occupied = occupiedSpaceIds.has(space.id) || space.status === SpaceStatus.BOOKED;
      return {
        id: space.id,
        name: space.name,
        capacity: space.capacity,
        status: occupied ? 'Occupied' : space.status === SpaceStatus.AVAILABLE ? 'Available' : 'Unavailable',
        utilization: Math.round((bookedDays.size / daysInMonth) * 100),
        nextBooking: nextBooking
          ? { date: nextBooking.startDate, time: nextBooking.startDate }
          : null,
      };
    });

    const available = spaces.filter((space) => space.status === 'Available').length;
    const createdThisMonth = (venue?.spaces ?? []).filter((space) => space.createdAt >= monthStart).length;
    const createdLastMonth = (venue?.spaces ?? []).filter(
      (space) => space.createdAt >= previousMonthStart && space.createdAt < monthStart,
    ).length;

    const months = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(chartStart.getFullYear(), chartStart.getMonth() + index, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return {
        label: start.toLocaleDateString('en-US', { month: 'short' }),
        count: active.filter((booking) => startsIn(booking, start, end)).length,
      };
    });
    const growth = percentChange(months[5]?.count ?? 0, months[4]?.count ?? 0);
    const utilization = spaces.map((space) => ({ name: space.name, percent: space.utilization }));
    const averageUtilization = utilization.length
      ? Math.round(utilization.reduce((sum, space) => sum + space.percent, 0) / utilization.length)
      : 0;

    return {
      organizer: {
        fullName: user?.fullName || '',
        propertyName: venue?.propertyName || null,
      },
      metrics: {
        totalSpaces: spaces.length,
        spacesChange: percentChange(createdThisMonth, createdLastMonth),
        upcoming: upcoming.length,
        upcomingChange: percentChange(upcoming.length, previousUpcoming.length),
        today: todayCount,
        available,
      },
      bookings,
      spaces,
      performance: {
        months,
        growth,
        utilization,
        averageUtilization,
      },
    };
  }

  async getReports(userId: string, query: { range?: string; spaceId?: string }) {
    const span = query.range === '12' ? 12 : query.range === '6' ? 6 : 3;
    const now = new Date();
    const today = startOfDay(now);
    const periodEnd = addDays(today, 1);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - (span - 1), 1);
    const previousEnd = periodStart;
    const previousStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - span, 1);
    const next30 = addDays(today, 30);
    const previous30Start = addDays(today, -30);

    const venue = await this.prisma.venueProfile.findFirst({
      where: { userId },
      include: {
        spaces: { orderBy: { name: 'asc' } },
        bookings: {
          include: {
            space: { select: { id: true, name: true } },
            event: { select: { title: true, category: true } },
          },
        },
      },
    });
    const spaces = (venue?.spaces ?? []).filter((space) => !query.spaceId || space.id === query.spaceId);
    const spaceIds = spaces.map((space) => space.id);
    const bookedEventIds = new Set(
      (venue?.bookings ?? []).map((booking) => booking.eventId).filter((id): id is string => Boolean(id)),
    );
    const hostedEvents = spaceIds.length
      ? await this.prisma.event.findMany({
          where: {
            venueSpaceId: { in: spaceIds },
            id: { notIn: [...bookedEventIds] },
            status: { not: EventStatus.ARCHIVED },
          },
          include: {
            venueSpace: { select: { id: true, name: true } },
            _count: { select: { attendees: true } },
          },
        })
      : [];

    const rows = [
      ...(venue?.bookings ?? [])
        .filter((booking) => !query.spaceId || booking.spaceId === query.spaceId)
        .map((booking) => ({
          spaceId: booking.spaceId,
          space: booking.space.name,
          category: booking.event?.category || 'Event',
          start: booking.startDate,
          end: booking.endDate,
          guests: booking.totalGuests,
          status: bookingStatus(booking.status),
        })),
      ...hostedEvents.map((event) => ({
        spaceId: event.venueSpaceId || '',
        space: event.venueSpace?.name || event.venueName || 'Venue',
        category: event.category || 'Event',
        start: event.startDate,
        end: event.endDate,
        guests: event._count.attendees || event.capacity,
        status: bookingStatus(event.status),
      })),
    ];
    const active = rows.filter((row) => row.status !== 'Cancelled');
    const inWindow = (row: { start: Date }, from: Date, to: Date) => row.start >= from && row.start < to;
    const current = active.filter((row) => inWindow(row, periodStart, periodEnd));
    const previous = active.filter((row) => inWindow(row, previousStart, previousEnd));
    const confirmedGuests = (list: typeof current) =>
      list.filter((row) => row.status === 'Confirmed').reduce((sum, row) => sum + row.guests, 0);

    const monthBuckets = Array.from({ length: span }, (_, index) => {
      const start = new Date(periodStart.getFullYear(), periodStart.getMonth() + index, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { label: start.toLocaleDateString('en-US', { month: 'short' }), start, end };
    });
    const daysInPeriod = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000));
    const daysInPrevious = Math.max(1, Math.round((previousEnd.getTime() - previousStart.getTime()) / 86400000));
    const bookedDayCount = (list: typeof current, spaceId: string, from: Date, to: Date) => {
      const days = new Set<string>();
      for (const row of list) {
        if (row.spaceId !== spaceId) continue;
        const cursor = startOfDay(row.start > from ? row.start : from);
        const last = startOfDay(row.end < to ? row.end : addDays(to, -1));
        while (cursor <= last) {
          days.add(cursor.toISOString().slice(0, 10));
          cursor.setDate(cursor.getDate() + 1);
          if (days.size > 400) break;
        }
      }
      return days.size;
    };
    const utilizationFor = (list: typeof current, from: Date, to: Date, dayCount: number) => {
      if (!spaces.length) return 0;
      const average =
        spaces.reduce((sum, space) => sum + bookedDayCount(list, space.id, from, to) / dayCount, 0) / spaces.length;
      return Math.round(average * 100);
    };

    const venueBars = spaces
      .map((space) => {
        const spaceRows = current.filter((row) => row.spaceId === space.id);
        return {
          id: space.id,
          name: space.name,
          bookings: spaceRows.length,
          guests: spaceRows.filter((row) => row.status === 'Confirmed').reduce((sum, row) => sum + row.guests, 0),
          utilization: Math.round((bookedDayCount(current, space.id, periodStart, periodEnd) / daysInPeriod) * 100),
          upcoming: spaceRows.filter((row) => inWindow(row, today, next30)).length,
        };
      })
      .sort((a, b) => b.utilization - a.utilization || b.bookings - a.bookings);

    const topVenues = [...venueBars].sort((a, b) => b.guests - a.guests).slice(0, 5);
    const guestVolume = monthBuckets.map((month) => {
      const point: Record<string, string | number> = { month: month.label };
      for (const venueBar of topVenues) {
        point[venueBar.name] = current
          .filter(
            (row) =>
              row.spaceId === venueBar.id &&
              row.status === 'Confirmed' &&
              inWindow(row, month.start, month.end),
          )
          .reduce((sum, row) => sum + row.guests, 0);
      }
      return point;
    });

    const categories = new Map<string, { bookings: number; guests: number }>();
    for (const row of current) {
      const item = categories.get(row.category) ?? { bookings: 0, guests: 0 };
      item.bookings += 1;
      if (row.status === 'Confirmed') item.guests += row.guests;
      categories.set(row.category, item);
    }
    const categoryTotal = current.length || 1;

    return {
      periodLabel: `Last ${span} months`,
      spaces: (venue?.spaces ?? []).map((space) => ({ id: space.id, name: space.name })),
      metrics: {
        totalBookings: current.length,
        bookingsChange: percentChange(current.length, previous.length),
        upcoming: active.filter((row) => inWindow(row, today, next30)).length,
        upcomingChange: percentChange(
          active.filter((row) => inWindow(row, today, next30)).length,
          active.filter((row) => inWindow(row, previous30Start, today)).length,
        ),
        utilization: utilizationFor(current, periodStart, periodEnd, daysInPeriod),
        utilizationChange: percentChange(
          utilizationFor(current, periodStart, periodEnd, daysInPeriod),
          utilizationFor(previous, previousStart, previousEnd, daysInPrevious),
        ),
        guests: confirmedGuests(current),
        guestsChange: percentChange(confirmedGuests(current), confirmedGuests(previous)),
      },
      bookingsOverTime: monthBuckets.map((month) => ({
        month: month.label,
        count: current.filter((row) => inWindow(row, month.start, month.end)).length,
      })),
      guestSeries: topVenues.map((venueBar) => venueBar.name),
      guestVolume,
      utilization: venueBars,
      breakdown: [...categories.entries()]
        .map(([name, item]) => ({
          name,
          bookings: item.bookings,
          guests: item.guests,
          share: Math.round((item.bookings / categoryTotal) * 100),
        }))
        .sort((a, b) => b.bookings - a.bookings),
    };
  }

  async getTables(userId?: string, spaceId?: string) {
    if (!userId) return emptySeating();
    const spaces = await this.prisma.venueSpace.findMany({
      where: { venue: { userId } },
      include: { venue: { select: { address: true, city: true, country: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const text = await this.readSpaceText(spaces.map((space) => space.id));
    const selected = spaces.find((space) => space.id === spaceId) ?? spaces[0] ?? null;
    if (!selected) return emptySeating();
    const zones = await this.prisma.tableZone.findMany({
      where: { spaceId: selected.id },
      orderBy: { createdAt: 'asc' },
    });
    const layouts = await this.readLayouts(zones.map((zone) => zone.id));
    const mapped = zones.map((zone) => this.toZoneCard(zone, layouts[zone.id]));
    const totals = seatingTotals(mapped);
    const address = text[selected.id]?.address
      || [selected.venue.address, selected.venue.city, selected.venue.country].filter(Boolean).join(', ');
    return {
      hall: { id: selected.id, name: selected.name, address },
      spaces: spaces.map((space) => ({ id: space.id, name: space.name })),
      ...totals,
      zones: mapped,
    };
  }

  async saveZone(userId: string, dto: SaveZoneDto, zoneId?: string) {
    const space = await this.prisma.venueSpace.findFirst({
      where: { id: dto.spaceId, venue: { userId } },
      select: { id: true },
    });
    if (!space) throw new NotFoundException('Venue space not found');
    if (!zoneId) {
      const created = await this.prisma.tableZone.create({
        data: {
          spaceId: space.id,
          zoneName: dto.name.trim(),
          tableCount: 0,
          seatPerTable: 0,
          totalCapacity: 0,
        },
      });
      await this.writeLayout(created.id, { category: dto.category, tables: [] });
    } else {
      const zone = await this.ownedZone(userId, zoneId);
      const layout = await this.readLayouts([zone.id]);
      const current = layout[zone.id] ?? { category: dto.category, tables: [] };
      await this.prisma.tableZone.update({
        where: { id: zone.id },
        data: { zoneName: dto.name.trim(), spaceId: space.id },
      });
      await this.writeLayout(zone.id, { ...current, category: dto.category });
    }
    return this.getTables(userId, space.id);
  }

  async deleteZone(userId: string, zoneId: string) {
    const zone = await this.ownedZone(userId, zoneId);
    await this.prisma.tableZone.delete({ where: { id: zone.id } });
    return this.getTables(userId, zone.spaceId ?? undefined);
  }

  async saveTable(userId: string, zoneId: string, dto: SaveTableDto) {
    const zone = await this.ownedZone(userId, zoneId);
    const layouts = await this.readLayouts([zone.id]);
    const layout = layouts[zone.id] ?? { category: 'Standard' as SeatCategory, tables: [] };
    const table: LayoutTable = {
      id: dto.tableId || randomUUID(),
      name: dto.name.trim(),
      seats: dto.seats,
      seatType: dto.seatType,
      status: dto.status,
    };
    const tables = dto.tableId
      ? layout.tables.map((item) => (item.id === dto.tableId ? table : item))
      : [...layout.tables, table];
    if (dto.tableId && !layout.tables.some((item) => item.id === dto.tableId)) {
      throw new NotFoundException('Table not found');
    }
    await this.persistLayout(zone.id, { ...layout, tables });
    return this.getTables(userId, zone.spaceId ?? undefined);
  }

  async deleteTable(userId: string, zoneId: string, tableId: string) {
    const zone = await this.ownedZone(userId, zoneId);
    const layouts = await this.readLayouts([zone.id]);
    const layout = layouts[zone.id] ?? { category: 'Standard' as SeatCategory, tables: [] };
    await this.persistLayout(zone.id, {
      ...layout,
      tables: layout.tables.filter((table) => table.id !== tableId),
    });
    return this.getTables(userId, zone.spaceId ?? undefined);
  }

  private async ownedZone(userId: string, zoneId: string) {
    const zone = await this.prisma.tableZone.findFirst({
      where: { id: zoneId, space: { venue: { userId } } },
    });
    if (!zone) throw new NotFoundException('Seating zone not found');
    return zone;
  }

  private async readLayouts(ids: string[]) {
    const map: Record<string, ZoneLayout> = {};
    if (!ids.length) return map;
    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: string; layout: string | null }>>`
        SELECT id, layout FROM "TableZone" WHERE id IN (${Prisma.join(ids)})
      `;
      rows.forEach((row) => {
        if (!row.layout) return;
        try {
          map[row.id] = JSON.parse(row.layout) as ZoneLayout;
        } catch {
          map[row.id] = { category: 'Standard', tables: [] };
        }
      });
    } catch {
      return map;
    }
    return map;
  }

  private async writeLayout(id: string, layout: ZoneLayout) {
    const value = JSON.stringify(layout);
    await this.prisma.$executeRaw`UPDATE "TableZone" SET layout = ${value} WHERE id = ${id}`;
  }

  private async persistLayout(id: string, layout: ZoneLayout) {
    const seats = layout.tables.reduce((sum, table) => sum + table.seats, 0);
    await this.prisma.tableZone.update({
      where: { id },
      data: {
        tableCount: layout.tables.length,
        seatPerTable: layout.tables[0]?.seats ?? 0,
        totalCapacity: seats,
      },
    });
    await this.writeLayout(id, layout);
  }

  private toZoneCard(zone: { id: string; zoneName: string; spaceId: string | null }, layout?: ZoneLayout) {
    const tables = layout?.tables ?? [];
    const totalSeats = tables.reduce((sum, table) => sum + table.seats, 0);
    const availableSeats = tables.filter((table) => table.status === 'Available').reduce((sum, table) => sum + table.seats, 0);
    return {
      id: zone.id,
      spaceId: zone.spaceId,
      name: zone.zoneName,
      category: layout?.category ?? 'Standard',
      tableCount: tables.length,
      totalSeats,
      availableSeats,
      tables: tables.map((table) => ({
        id: table.id,
        tableNumber: table.name,
        seats: table.seats,
        category: table.seatType,
        status: table.status,
      })),
    };
  }
}

function emptySeating() {
  return {
    hall: null,
    spaces: [] as Array<{ id: string; name: string }>,
    totalSeats: 0,
    availableSeats: 0,
    reservedSeats: 0,
    unavailableSeats: 0,
    zones: [],
  };
}

function seatingTotals(zones: Array<{ tables: Array<{ seats: number; status: SeatStatus }> }>) {
  const tables = zones.flatMap((zone) => zone.tables);
  const sum = (status: SeatStatus) => tables.filter((table) => table.status === status).reduce((total, table) => total + table.seats, 0);
  return {
    totalSeats: tables.reduce((total, table) => total + table.seats, 0),
    availableSeats: sum('Available'),
    reservedSeats: sum('Reserved'),
    unavailableSeats: sum('Unavailable'),
  };
}
