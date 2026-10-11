import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentConfigDto } from './dto/payment-config.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Payments & Stripe')
@Controller('payments')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Get('config')
  @ResponseMessage('Payment gateway configuration retrieved')
  @ApiOperation({
    summary: 'Retrieve Stripe publishable key and default currency for frontend initialization',
  })
  @ApiResponse({ status: 200, type: PaymentConfigDto })
  getConfig(): PaymentConfigDto {
    return this.paymentsService.getConfig();
  }

  @Post('create-checkout-session')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Stripe checkout session initialized successfully')
  @ApiOperation({
    summary: 'Generate hosted Stripe Checkout redirect URL for an order',
  })
  @ApiBody({ type: CreateCheckoutSessionDto })
  @ApiResponse({
    status: 200,
    description: 'Stripe hosted checkout URL and session ID created',
  })
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.paymentsService.createCheckoutSession(dto);
  }

  @Post('create-intent')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Stripe PaymentIntent created successfully')
  @ApiOperation({
    summary:
      'Generate Stripe PaymentIntent with client secret for embedded frontend Stripe Elements',
  })
  @ApiBody({ type: CreatePaymentIntentDto })
  @ApiResponse({
    status: 200,
    description: 'Client secret returned for Stripe Elements card processing',
  })
  async createPaymentIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Payment status verified successfully')
  @ApiOperation({
    summary:
      'Query Stripe directly to confirm payment completion and activate order/tickets',
  })
  @ApiBody({ type: VerifyPaymentDto })
  @ApiResponse({
    status: 200,
    description: 'Verified order and generated digital tickets returned',
  })
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Webhook event acknowledged')
  @ApiOperation({
    summary: 'Stripe webhook receiver for asynchronous fulfillment',
  })
  async handleWebhook(@Body() event: any) {
    return this.paymentsService.handleWebhook(event);
  }
}
