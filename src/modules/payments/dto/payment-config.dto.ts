import { ApiProperty } from '@nestjs/swagger';

export class PaymentConfigDto {
  @ApiProperty({
    example: 'FLWPUBK_TEST-9b15c8562f89d0d12b459bc3740cd1c0-X',
    description: 'Flutterwave Public Key for frontend checkout initialization',
    type: String,
  })
  publicKey: string;

  @ApiProperty({
    example: 'FLWPUBK_TEST-9b15c8562f89d0d12b459bc3740cd1c0-X',
    description: 'Alias for backwards compatibility',
    type: String,
  })
  publishableKey: string;

  @ApiProperty({
    example: 'NGN',
    description: 'Default platform payment currency',
    type: String,
  })
  currency: string;
}
