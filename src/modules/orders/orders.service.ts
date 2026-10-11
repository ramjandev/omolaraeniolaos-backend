import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { OrderStatus, AttendeeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';

@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async checkout(dto: CheckoutDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      include: { ticketTiers: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    let totalAmount = 0;
    const orderItemsData: any[] = [];
    const attendeesToCreate: any[] = [];

    for (const item of dto.items) {
      const tier = event.ticketTiers.find((t) => t.id === item.ticketTierId);
      if (!tier) {
        throw new BadRequestException(`Ticket tier ${item.ticketTierId} is invalid for this event`);
      }

      if (tier.soldCount + item.quantity > tier.capacity) {
        throw new BadRequestException(`Ticket tier "${tier.name}" is sold out or has insufficient capacity`);
      }

      const subtotal = tier.price * item.quantity;
      totalAmount += subtotal;

      orderItemsData.push({
        ticketTierId: tier.id,
        quantity: item.quantity,
        unitPrice: tier.price,
        subtotal,
      });

      for (let i = 0; i < item.quantity; i++) {
        const qrHash = `MC-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        attendeesToCreate.push({
          eventId: dto.eventId,
          ticketTierId: tier.id,
          fullName: dto.buyerName,
          email: dto.buyerEmail,
          phone: dto.buyerPhone,
          qrCode: qrHash,
          status: AttendeeStatus.ATTENDING,
        });
      }
    }

    const platformFee = Math.round(totalAmount * 0.05); // 5% platform take-rate
    const netAmount = totalAmount - platformFee;
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const transactionRef = `TXN-${crypto.randomBytes(8).toString('hex')}`;

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          eventId: dto.eventId,
          buyerName: dto.buyerName,
          buyerEmail: dto.buyerEmail,
          buyerPhone: dto.buyerPhone,
          totalAmount,
          platformFee,
          netAmount,
          currency: event.currency,
          status: OrderStatus.PAID,
          paymentGateway: dto.paymentGateway,
          transactionRef,
          paidAt: new Date(),
          items: {
            create: orderItemsData,
          },
        },
      });

      for (const item of dto.items) {
        await tx.ticketTier.update({
          where: { id: item.ticketTierId },
          data: { soldCount: { increment: item.quantity } },
        });
      }

      await tx.attendee.createMany({
        data: attendeesToCreate.map((att) => ({
          ...att,
          orderId: order.id,
        })),
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: { include: { ticketTier: true } },
          attendees: true,
          event: { select: { title: true, startDate: true, venueName: true } },
        },
      });
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { ticketTier: true } },
        attendees: true,
        event: { select: { title: true, startDate: true, venueName: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
