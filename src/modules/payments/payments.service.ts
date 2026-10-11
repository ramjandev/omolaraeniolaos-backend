import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, AttendeeStatus, PaymentGateway } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentConfigDto } from './dto/payment-config.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly secretKey: string;
  private readonly publishableKey: string;
  private readonly currency: string;
  private readonly frontendUrl: string;

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Optional() @Inject(ConfigService) private configService?: ConfigService,
  ) {
    this.secretKey =
      this.configService?.get<string>('STRIPE_SECRET_KEY') ||
      process.env.STRIPE_SECRET_KEY ||
      '';
    this.publishableKey =
      this.configService?.get<string>('STRIPE_PUBLISHABLE_KEY') ||
      process.env.STRIPE_PUBLISHABLE_KEY ||
      '';
    this.currency = (
      this.configService?.get<string>('STRIPE_CURRENCY') ||
      process.env.STRIPE_CURRENCY ||
      'usd'
    ).toLowerCase();
    this.frontendUrl =
      this.configService?.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
  }

  getConfig(): PaymentConfigDto {
    return {
      publishableKey: this.publishableKey,
      currency: this.currency,
    };
  }

  async createCheckoutSession(dto: CreateCheckoutSessionDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: { include: { ticketTier: true } },
        event: { select: { id: true, title: true, currency: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('This order has already been paid and processed');
    }

    const successUrl =
      dto.successUrl ||
      `${this.frontendUrl}/orders/confirmation/${order.id}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      dto.cancelUrl || `${this.frontendUrl}/events/${order.eventId}?cancelled=true`;

    const currency = (order.currency || this.currency || 'usd').toLowerCase();

    // Prepare URL-encoded form body for Stripe API
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('customer_email', order.buyerEmail);
    params.append('client_reference_id', order.id);
    params.append('metadata[orderId]', order.id);
    params.append('metadata[orderNumber]', order.orderNumber);

    order.items.forEach((item, index) => {
      const unitAmountInCents = Math.round(item.unitPrice * 100);
      params.append(`line_items[${index}][price_data][currency]`, currency);
      params.append(
        `line_items[${index}][price_data][unit_amount]`,
        unitAmountInCents.toString(),
      );
      params.append(
        `line_items[${index}][price_data][product_data][name]`,
        `${order.event.title} - ${item.ticketTier.name}`,
      );
      params.append(
        `line_items[${index}][quantity]`,
        item.quantity.toString(),
      );
    });

    try {
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(`Stripe checkout session creation failed: ${JSON.stringify(errorData)}`);
        throw new BadRequestException(
          errorData.error?.message || 'Failed to initialize Stripe checkout session',
        );
      }

      const session = await response.json();

      // Record transaction reference
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          transactionRef: session.id,
          paymentGateway: PaymentGateway.STRIPE,
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        currency: order.currency,
        sessionId: session.id,
        checkoutUrl: session.url,
        publishableKey: this.publishableKey,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Stripe connection error: ${err.message}`);
      throw new BadRequestException(`Stripe API error: ${err.message}`);
    }
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        event: { select: { title: true, currency: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('This order has already been paid');
    }

    const currency = (order.currency || this.currency || 'usd').toLowerCase();
    const amountInCents = Math.round(order.totalAmount * 100);

    const params = new URLSearchParams();
    params.append('amount', amountInCents.toString());
    params.append('currency', currency);
    params.append('receipt_email', order.buyerEmail);
    params.append('metadata[orderId]', order.id);
    params.append('metadata[orderNumber]', order.orderNumber);
    params.append('description', `Order ${order.orderNumber} for ${order.event.title}`);
    params.append('automatic_payment_methods[enabled]', 'true');

    try {
      const response = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new BadRequestException(
          errorData.error?.message || 'Failed to create Stripe PaymentIntent',
        );
      }

      const intent = await response.json();

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          transactionRef: intent.id,
          paymentGateway: PaymentGateway.STRIPE,
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
        currency: order.currency,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        publishableKey: this.publishableKey,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException(`Stripe PaymentIntent error: ${err.message}`);
    }
  }

  async verifyPayment(dto: VerifyPaymentDto) {
    const id = dto.sessionIdOrIntentId.trim();
    let orderId: string | null = null;
    let isPaid = false;

    // Check if ID is a Checkout Session (cs_...) or PaymentIntent (pi_...)
    const endpoint = id.startsWith('cs_')
      ? `https://api.stripe.com/v1/checkout/sessions/${id}`
      : `https://api.stripe.com/v1/payment_intents/${id}`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      if (!response.ok) {
        throw new BadRequestException('Could not verify transaction with Stripe');
      }

      const data = await response.json();
      orderId = data.metadata?.orderId || data.client_reference_id;

      if (id.startsWith('cs_')) {
        isPaid = data.payment_status === 'paid';
      } else {
        isPaid = data.status === 'succeeded';
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Stripe verification failed: ${err.message}`);
    }

    if (!orderId) {
      // Attempt lookup by transactionRef in database
      const orderMatch = await this.prisma.order.findUnique({
        where: { transactionRef: id },
      });
      if (orderMatch) orderId = orderMatch.id;
    }

    if (!orderId) {
      throw new NotFoundException('Could not resolve an associated order for this transaction');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { ticketTier: true } },
        attendees: true,
        event: { select: { id: true, title: true, startDate: true, venueName: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Associated order not found');
    }

    if (isPaid && order.status !== OrderStatus.PAID) {
      // Mark order as PAID and activate attendees
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAID,
            paidAt: new Date(),
          },
        });

        await tx.attendee.updateMany({
          where: { orderId: order.id },
          data: { status: AttendeeStatus.ATTENDING },
        });

        for (const item of order.items) {
          await tx.ticketTier.update({
            where: { id: item.ticketTierId },
            data: { soldCount: { increment: item.quantity } },
          });
        }
      });

      order.status = OrderStatus.PAID;
      order.paidAt = new Date();
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      isPaid,
      totalAmount: order.totalAmount,
      currency: order.currency,
      attendees: order.attendees,
      event: order.event,
    };
  }

  async handleWebhook(event: any) {
    this.logger.log(`Received Stripe Webhook event: ${event.type}`);

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'payment_intent.succeeded'
    ) {
      const dataObject = event.data.object;
      const orderId = dataObject.metadata?.orderId || dataObject.client_reference_id;

      if (orderId) {
        await this.prisma.$transaction(async (tx) => {
          await tx.order.updateMany({
            where: { id: orderId, status: OrderStatus.PENDING },
            data: {
              status: OrderStatus.PAID,
              paidAt: new Date(),
            },
          });

          await tx.attendee.updateMany({
            where: { orderId },
            data: { status: AttendeeStatus.ATTENDING },
          });
        });
        this.logger.log(`Order ${orderId} successfully verified & fulfilled via Stripe webhook.`);
      }
    }

    return { received: true };
  }
}
