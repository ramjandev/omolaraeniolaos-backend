import { Injectable, Inject } from '@nestjs/common';
import { SpaceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';

@Injectable()
export class VenueService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getSpaces(userId?: string) {
    const venue = userId
      ? await this.prisma.venueProfile.findFirst({ where: { userId } })
      : null;

    return this.prisma.venueSpace.findMany({
      where: venue ? { venueId: venue.id } : undefined,
      include: {
        venue: { select: { propertyName: true, city: true, country: true } },
      },
      orderBy: { capacity: 'desc' },
    });
  }

  async createSpace(userId: string, dto: CreateSpaceDto) {
    let venue = await this.prisma.venueProfile.findFirst({
      where: { userId },
    });

    if (!venue) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      venue = await this.prisma.venueProfile.create({
        data: {
          userId,
          propertyName: `${user?.fullName || 'Convention'} Centre`,
          address: 'Plot 10 Victoria Island',
          city: 'Lagos',
          country: 'Nigeria',
        },
      });
    }

    return this.prisma.venueSpace.create({
      data: {
        ...dto,
        venueId: venue.id,
        status: SpaceStatus.AVAILABLE,
        amenities: dto.amenities || [],
      },
    });
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

  async getTables(userId?: string) {
    const venue = userId
      ? await this.prisma.venueProfile.findFirst({ where: { userId } })
      : null;

    return this.prisma.tableZone.findMany({
      where: venue ? { space: { venueId: venue.id } } : undefined,
      include: {
        space: { select: { name: true } },
        assignments: true,
      },
    });
  }
}
