import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
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

@ApiTags('Payments & Flutterwave')
@Controller('payments')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Get('config')
  @ResponseMessage('Payment gateway configuration retrieved')
  @ApiOperation({
    summary: 'Retrieve Flutterwave public key and currency for frontend checkout initialization',
  })
  @ApiResponse({ status: 200, type: PaymentConfigDto })
  getConfig(): PaymentConfigDto {
    return this.paymentsService.getConfig();
  }

  @Post('create-checkout-session')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Flutterwave checkout session initialized successfully')
  @ApiOperation({
    summary: 'Generate hosted Flutterwave Checkout redirect URL for an order',
  })
  @ApiBody({ type: CreateCheckoutSessionDto })
  @ApiResponse({
    status: 200,
    description: 'Flutterwave hosted checkout URL and transaction reference created',
  })
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.paymentsService.createCheckoutSession(dto);
  }

  @Post('create-intent')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Flutterwave payment transaction initialized successfully')
  @ApiOperation({
    summary: 'Generate transaction parameters for inline Flutterwave checkout',
  })
  @ApiBody({ type: CreatePaymentIntentDto })
  @ApiResponse({
    status: 200,
    description: 'Transaction reference and public key returned for inline processing',
  })
  async createPaymentIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Payment status verified successfully')
  @ApiOperation({
    summary:
      'Query Flutterwave directly to confirm payment completion and activate order/tickets',
  })
  @ApiBody({ type: VerifyPaymentDto })
  @ApiResponse({
    status: 200,
    description: 'Verified order and activated digital tickets returned',
  })
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Webhook event acknowledged')
  @ApiOperation({
    summary: 'Flutterwave webhook receiver for asynchronous payment verification & order fulfillment',
  })
  async handleWebhook(
    @Body() event: any,
    @Headers('verif-hash') signature?: string,
  ) {
    return this.paymentsService.handleWebhook(event, signature);
  }
}
