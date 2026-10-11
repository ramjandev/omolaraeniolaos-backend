import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PayPlanDto {
  @ApiProperty({
    example: 'plan_agency_1',
    description: 'Plan ID to purchase or subscribe to (e.g. plan_ind_2, plan_agency_1, plan_venue_1)',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/dashboard?plan_success=true',
    description: 'Custom redirect URL after Flutterwave payment completion',
  })
  @IsOptional()
  @IsString()
  redirectUrl?: string;
}
