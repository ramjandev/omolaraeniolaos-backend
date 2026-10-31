import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PostChatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  attendeeId: string;

  @ApiProperty({ enum: ['guest', 'organizer'] })
  @IsIn(['guest', 'organizer'])
  from: 'guest' | 'organizer';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mediaKind?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fileName?: string;
}
