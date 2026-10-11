import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTierDto } from './dto/create-tier.dto';

@Injectable()
export class TicketsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findByEvent(eventId: string) {
    return this.prisma.ticketTier.findMany({
      where: { eventId },
      orderBy: { price: 'asc' },
    });
  }

  async create(eventId: string, dto: CreateTierDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.ticketTier.create({
      data: {
        ...dto,
        eventId,
        currency: event.currency,
        perks: dto.perks || [],
      },
    });
  }
}
