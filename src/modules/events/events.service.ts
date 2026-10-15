import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { EventStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(query: { status?: EventStatus; category?: string; organizerId?: string; search?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.organizerId) where.organizerId = query.organizerId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.event.findMany({
      where,
      include: {
        ticketTiers: true,
        organizer: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        ticketTiers: true,
        schedules: true,
        organizer: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  async create(organizerId: string, dto: CreateEventDto) {
    const slug = `${dto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

    return this.prisma.event.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        slug,
        organizerId,
        status: EventStatus.DRAFT,
      },
      include: {
        ticketTiers: true,
      },
    });
  }

  async publish(id: string, user: any) {
    const event = await this.findOne(id);
    if (event.organizerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to publish this event');
    }

    return this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.PUBLISHED },
    });
  }
}
