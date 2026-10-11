import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';
import { PaymentGateway } from '@prisma/client';

export class OrderItemDto {
  @ApiProperty({ example: 'b94e77cb-8c65-4f32-8419-724578b776be' })
  @IsUUID()
  ticketTierId: string;

  @ApiProperty({ example: 2, type: Number })
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class CheckoutDto {
  @ApiProperty({ example: 'f87a31b4-71bc-445a-933e-0012fceb7593' })
  @IsUUID()
  eventId: string;

  @ApiProperty({ example: 'James Obi' })
  @IsString()
  @IsNotEmpty()
  buyerName: string;

  @ApiProperty({ example: 'james.obi@example.com' })
  @IsEmail()
  buyerEmail: string;

  @ApiProperty({ example: '+234 802 345 6789', required: false })
  @IsString()
  @IsOptional()
  buyerPhone?: string;

  @ApiProperty({ enum: PaymentGateway, example: PaymentGateway.PAYSTACK })
  @IsEnum(PaymentGateway)
  paymentGateway: PaymentGateway;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
