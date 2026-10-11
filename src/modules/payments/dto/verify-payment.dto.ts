import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({
    example: 'cs_live_a1B2c3D4e5F6...',
    description: 'Stripe Checkout Session ID (cs_...) or PaymentIntent ID (pi_...) to verify',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  sessionIdOrIntentId: string;
}
