import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiPropertyOptional({
    example: 'ORD-1728392182',
    description: 'Flutterwave Transaction Reference (tx_ref) or Transaction ID to verify',
    type: String,
  })
  @IsOptional()
  @IsString()
  transactionIdOrRef?: string;

  @ApiPropertyOptional({
    example: 'FLW-TXN-12345',
    description: 'Backwards-compatible transaction ID',
    type: String,
  })
  @IsOptional()
  @IsString()
  sessionIdOrIntentId?: string;

  @ApiPropertyOptional({
    example: 'ORD-1728392182',
    description: 'Flutterwave redirect query tx_ref',
    type: String,
  })
  @IsOptional()
  @IsString()
  tx_ref?: string;

  @ApiPropertyOptional({
    example: '4938210',
    description: 'Flutterwave numeric transaction ID from redirect URL',
    type: String,
  })
  @IsOptional()
  @IsString()
  transaction_id?: string;
}
