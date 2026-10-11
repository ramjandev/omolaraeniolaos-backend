import { ApiProperty } from '@nestjs/swagger';

export class PaymentConfigDto {
  @ApiProperty({
    example: 'pk_live_51TzTmGP0rydDJne5eP6HF1EzWEvQqsnp3KFPohprLkbFHz50UBfaplRSotmx0RXjcxOc41A7KgbBjsUvGiXAbFeh007BApW9SL',
    description: 'Stripe Publishable Key for frontend SDK initialization',
    type: String,
  })
  publishableKey: string;

  @ApiProperty({
    example: 'usd',
    description: 'Default platform payment currency',
    type: String,
  })
  currency: string;
}
