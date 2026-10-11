import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiProperty({
    example: 'd893f12a-3e54-46ab-8012-789a456bc123',
    description: 'Unique Order UUID for initializing Flutterwave payment transaction',
    type: String,
  })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;
}
