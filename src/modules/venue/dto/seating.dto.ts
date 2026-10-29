import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class SaveZoneDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ['VIP', 'Standard', 'Accessible'] })
  @IsIn(['VIP', 'Standard', 'Accessible'])
  category: 'VIP' | 'Standard' | 'Accessible';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  spaceId: string;
}

export class SaveTableDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  seats: number;

  @ApiProperty({ enum: ['VIP', 'Standard', 'Accessible'] })
  @IsIn(['VIP', 'Standard', 'Accessible'])
  seatType: 'VIP' | 'Standard' | 'Accessible';

  @ApiProperty({ enum: ['Reserved', 'Available', 'Unavailable'] })
  @IsIn(['Reserved', 'Available', 'Unavailable'])
  status: 'Reserved' | 'Available' | 'Unavailable';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableId?: string;
}
