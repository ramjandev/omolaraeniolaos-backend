import { ApiProperty } from '@nestjs/swagger';
import { CommunicationChannel } from '@prisma/client';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SaveMessageTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: ['WHATSAPP', 'SMS', 'EMAIL'] })
  @IsIn([CommunicationChannel.WHATSAPP, CommunicationChannel.SMS, CommunicationChannel.EMAIL])
  channel: CommunicationChannel;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}
