import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { VoiceRsvpService } from './voice-rsvp.service';
import { TranscribeVoiceDto } from './dto/transcribe-voice.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('06 Guest / RSVP & Pass')
@Controller('voice-rsvp')
export class VoiceRsvpController {
  constructor(@Inject(VoiceRsvpService) private readonly voiceRsvpService: VoiceRsvpService) {}

  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Audio transcribed successfully')
  @ApiOperation({
    summary:
      'Transcribe guest audio note via Google Cloud Speech-to-Text v2 (supports English, Yoruba, Igbo, Hausa, Pidgin)',
  })
  @ApiBody({ type: TranscribeVoiceDto })
  @ApiResponse({
    status: 200,
    description: 'Transcribed text and confidence returned',
  })
  async transcribe(@Body() dto: TranscribeVoiceDto) {
    return this.voiceRsvpService.transcribeAudio(
      dto.audioBase64,
      dto.mimeType,
      dto.languageCode,
    );
  }

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Voice RSVP processed and recorded successfully')
  @ApiOperation({
    summary:
      'Transcribe audio voice note, extract RSVP intent (Confirmed/Declined/Tentative), guest count, dietary notes, and update attendee in database',
  })
  @ApiBody({ type: TranscribeVoiceDto })
  @ApiResponse({
    status: 200,
    description: 'Complete voice RSVP analysis and attendee update returned',
  })
  async processVoiceRsvp(@Body() dto: TranscribeVoiceDto) {
    return this.voiceRsvpService.processVoiceRsvp(dto);
  }

  @Get('languages')
  @ResponseMessage('Supported voice RSVP languages retrieved')
  @ApiOperation({
    summary: 'List supported speech recognition languages and locale codes',
  })
  @ApiResponse({ status: 200, description: 'Supported languages array returned' })
  getSupportedLanguages() {
    return this.voiceRsvpService.getSupportedLanguages();
  }
}
