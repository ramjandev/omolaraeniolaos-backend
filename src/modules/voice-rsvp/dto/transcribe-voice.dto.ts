import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TranscribeVoiceDto {
  @ApiProperty({
    example: 'GkXfo59ChoEBQveBAULygQRC84EIQoKEdj...',
    description: 'Base64-encoded audio bytes (from WhatsApp audio note or browser microphone recording)',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  audioBase64: string;

  @ApiPropertyOptional({
    example: 'audio/ogg',
    description: 'MIME type of the audio (audio/ogg, audio/mp3, audio/wav, audio/webm)',
    type: String,
    default: 'audio/ogg',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({
    example: 'en-US',
    description: 'Expected language code (en-US, yo-NG, ig-NG, ha-NG, pcm-NG). Default auto-detects.',
    type: String,
  })
  @IsOptional()
  @IsString()
  languageCode?: string;

  @ApiPropertyOptional({
    example: 'evt_12345',
    description: 'Associated event ID if processing RSVP for an event',
    type: String,
  })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({
    example: 'att_67890',
    description: 'Attendee/Invitee UUID to automatically update their RSVP status upon recognition',
    type: String,
  })
  @IsOptional()
  @IsString()
  attendeeId?: string;
}
