import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { TicketTierType } from '@prisma/client';

export class CreateTierDto {
  @ApiProperty({ example: 'VIP Executive Pass' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TicketTierType, example: TicketTierType.VIP })
  @IsEnum(TicketTierType)
  type: TicketTierType;

  @ApiProperty({ example: 65000, type: Number })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 200, type: Number })
  @IsInt()
  @IsPositive()
  capacity: number;

  @ApiProperty({ example: 'Priority access, VIP Lounge, Speakers Dinner', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['VIP Lounge', 'Speakers Dinner', 'Fast-Track Entry'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  perks?: string[];
}
