import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum DispatchChannel {
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
}

export class DispatchMessageDto {
  @ApiProperty()
  @IsUUID()
  eventId: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  attendeeIds?: string[];

  @ApiPropertyOptional({ enum: ['all', 'vip', 'unchecked_in', 'no_response'] })
  @IsString()
  @IsOptional()
  audience?: string;

  @ApiProperty({ enum: DispatchChannel, isArray: true })
  @IsArray()
  @IsEnum(DispatchChannel, { each: true })
  channels: DispatchChannel[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;
}
