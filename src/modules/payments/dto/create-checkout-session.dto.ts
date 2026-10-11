import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    example: 'd893f12a-3e54-46ab-8012-789a456bc123',
    description: 'Unique Order UUID to process payment for',
    type: String,
  })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/orders/success?session_id={CHECKOUT_SESSION_ID}',
    description: 'URL to redirect user on successful payment',
    type: String,
  })
  @IsString()
  @IsOptional()
  successUrl?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/orders/cancel',
    description: 'URL to redirect user if payment is cancelled',
    type: String,
  })
  @IsString()
  @IsOptional()
  cancelUrl?: string;
}
