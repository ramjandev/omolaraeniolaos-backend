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
import { AuthService } from '../auth/auth.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly encryptionKey: string;
  private readonly secretHash: string;
  private readonly currency: string;
  private readonly frontendUrl: string;

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Optional() @Inject(ConfigService) private configService?: ConfigService,
    @Optional() @Inject(AuthService) private authService?: AuthService,
  ) {
    this.secretKey =
      this.configService?.get<string>('FLUTTERWAVE_SECRET_KEY') ||
      process.env.FLUTTERWAVE_SECRET_KEY ||
      '';
    this.publicKey =
      this.configService?.get<string>('FLUTTERWAVE_PUBLIC_KEY') ||
      process.env.FLUTTERWAVE_PUBLIC_KEY ||
      '';
    this.encryptionKey =
      this.configService?.get<string>('FLUTTERWAVE_ENCRYPTION_KEY') ||
      process.env.FLUTTERWAVE_ENCRYPTION_KEY ||
      '';
    this.secretHash =
      this.configService?.get<string>('FLUTTERWAVE_SECRET_HASH') ||
      process.env.FLUTTERWAVE_SECRET_HASH ||
      '';
    this.currency = 'NGN';
    this.frontendUrl =
      this.configService?.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
  }

  getConfig(): PaymentConfigDto {
    return {
      publicKey: this.publicKey,
      publishableKey: this.publicKey,
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
      `${this.frontendUrl}/orders/confirmation/${order.id}`;

    const payload = {
      tx_ref: order.orderNumber,
      amount: order.totalAmount,
      currency: this.currency,
      redirect_url: successUrl,
      customer: {
        email: order.buyerEmail,
        name: order.buyerName,
        phonenumber: order.buyerPhone || '',
      },
      customizations: {
        title: order.event.title,
        description: `Payment for Order #${order.orderNumber}`,
      },
      meta: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    };

    try {
      const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        this.logger.error(`Flutterwave checkout error: ${JSON.stringify(data)}`);
        throw new BadRequestException(
          data.message || 'Failed to initialize Flutterwave checkout session',
        );
      }

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          transactionRef: order.orderNumber,
          paymentGateway: PaymentGateway.FLUTTERWAVE,
        },
      });

      return {
        sessionId: order.orderNumber,
        checkoutUrl: data.data.link,
        reference: order.orderNumber,
        orderId: order.id,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Flutterwave connection error: ${err.message}`);
      throw new BadRequestException(`Flutterwave API error: ${err.message}`);
    }
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        event: { select: { id: true, title: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('This order has already been paid and processed');
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        transactionRef: order.orderNumber,
        paymentGateway: PaymentGateway.FLUTTERWAVE,
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.totalAmount,
      currency: this.currency,
      publicKey: this.publicKey,
      tx_ref: order.orderNumber,
      customer: {
        email: order.buyerEmail,
        name: order.buyerName,
        phone: order.buyerPhone || '',
      },
    };
  }

  async verifyPayment(dto: VerifyPaymentDto) {
    const rawId = (
      dto.transactionIdOrRef ||
      dto.tx_ref ||
      dto.transaction_id ||
      dto.sessionIdOrIntentId ||
      ''
    ).trim();

    if (!rawId) {
      throw new BadRequestException('Transaction reference or ID is required for verification');
    }

    let isPaid = false;
    let resolvedTxRef: string | null = null;

    try {
      // Determine if numeric ID or reference string
      const isNumeric = /^\d+$/.test(rawId);
      const url = isNumeric
        ? `https://api.flutterwave.com/v3/transactions/${rawId}/verify`
        : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(rawId)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      const resData = await response.json();

      if (response.ok && resData.status === 'success' && resData.data) {
        if (resData.data.status === 'successful') {
          isPaid = true;
          resolvedTxRef = resData.data.tx_ref;
        }
      } else {
        this.logger.warn(`Flutterwave verify returned: ${JSON.stringify(resData)}`);
      }
    } catch (err: any) {
      this.logger.error(`Flutterwave verification request error: ${err.message}`);
    }

    // Lookup order in database by tx_ref, orderNumber, or transactionRef
    const lookupRef = resolvedTxRef || rawId;
    let order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { orderNumber: lookupRef },
          { transactionRef: lookupRef },
          { id: lookupRef },
        ],
      },
      include: {
        items: { include: { ticketTier: true } },
        attendees: true,
        event: { select: { id: true, title: true, startDate: true, venueName: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with reference ${lookupRef} not found`);
    }

    if (isPaid && order.status !== OrderStatus.PAID) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order!.id },
          data: {
            status: OrderStatus.PAID,
            paidAt: new Date(),
            paymentGateway: PaymentGateway.FLUTTERWAVE,
          },
        });

        await tx.attendee.updateMany({
          where: { orderId: order!.id },
          data: { status: AttendeeStatus.ATTENDING },
        });

        for (const item of order!.items) {
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
      isPaid: order.status === OrderStatus.PAID || isPaid,
      totalAmount: order.totalAmount,
      currency: order.currency,
      attendees: order.attendees,
      event: order.event,
    };
  }

  async handleWebhook(event: any, signatureHeader?: string) {
    if (this.secretHash && signatureHeader && signatureHeader !== this.secretHash) {
      this.logger.warn('Flutterwave webhook signature mismatch');
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Received Flutterwave Webhook event: ${event?.event || 'payment'}`);

    if (event?.event === 'charge.completed' && event?.data?.status === 'successful') {
      const txRef = event.data.tx_ref;
      const metaType = event.data.meta?.type;
      if (metaType === 'ORGANIZER_PLAN_SUBSCRIPTION' && event.data.meta?.userId) {
        await this.authService?.reconcilePlanPayments(event.data.meta.userId);
      }
      const orderId = event.data.meta?.orderId;

      const order = await this.prisma.order.findFirst({
        where: {
          OR: [
            ...(orderId ? [{ id: orderId }] : []),
            ...(txRef ? [{ orderNumber: txRef }, { transactionRef: txRef }] : []),
          ],
        },
      });

      if (order && order.status !== OrderStatus.PAID) {
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.PAID,
              paidAt: new Date(),
              paymentGateway: PaymentGateway.FLUTTERWAVE,
            },
          });

          await tx.attendee.updateMany({
            where: { orderId: order.id },
            data: { status: AttendeeStatus.ATTENDING },
          });
        });
        this.logger.log(`Order ${order.id} fulfilled via Flutterwave webhook.`);
      }
    }

    return { status: 'success' };
  }
}
