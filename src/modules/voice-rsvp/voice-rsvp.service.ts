import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { AttendeeStatus, RsvpStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TranscribeVoiceDto } from './dto/transcribe-voice.dto';

export interface RsvpIntentResult {
  status: 'CONFIRMED' | 'DECLINED' | 'TENTATIVE';
  guestCount: number;
  dietaryOrNotes?: string;
  detectedLanguage?: string;
}

@Injectable()
export class VoiceRsvpService {
  private readonly logger = new Logger(VoiceRsvpService.name);

  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  private geminiKey() {
    return (process.env.GEMINI_API_KEY || '').trim();
  }

  private audioMime(mimeType: string) {
    const base = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (base === 'audio/mp4' || base === 'audio/m4a' || base === 'audio/x-m4a') return 'audio/mp4';
    if (base === 'audio/mpeg' || base === 'audio/mp3') return 'audio/mp3';
    if (base === 'audio/wav' || base === 'audio/x-wav' || base === 'audio/wave') return 'audio/wav';
    if (base === 'audio/ogg' || base === 'audio/opus') return 'audio/ogg';
    return 'audio/webm';
  }

  private languageHint(languageCode?: string) {
    const value = (languageCode || '').toLowerCase();
    if (value.startsWith('yo')) return 'yo-NG';
    if (value.startsWith('ig')) return 'ig-NG';
    if (value.startsWith('ha')) return 'ha-NG';
    if (value.startsWith('en')) return 'en-US';
    return '';
  }

  /**
   * Transcribe a short guest voice note with the Gemini free tier.
   */
  async transcribeAudio(
    audioBase64: string,
    mimeType: string = 'audio/webm',
    languageCode: string = 'en-US',
  ): Promise<{ transcript: string; confidence: number; languageDetected: string }> {
    if (!audioBase64 || audioBase64.trim().length === 0) {
      throw new BadRequestException('audioBase64 payload is empty');
    }

    const apiKey = this.geminiKey();
    if (!apiKey) {
      throw new BadRequestException('Voice transcription is not configured');
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, '');
    const audio = Buffer.from(cleanBase64, 'base64');
    if (!audio.length) {
      throw new BadRequestException('Audio recording is empty');
    }

    const mime = this.audioMime(mimeType);
    const hint = this.languageHint(languageCode);
    const transcript = await this.geminiTranscribe(apiKey, audio, mime, hint);
    if (!transcript) {
      throw new BadRequestException('No speech was detected in that recording');
    }

    return {
      transcript,
      confidence: 0,
      languageDetected: hint || languageCode || 'auto',
    };
  }

  private async geminiTranscribe(apiKey: string, audio: Buffer, mime: string, languageCode: string) {
    const uploaded = await this.uploadGeminiAudio(apiKey, audio, mime);
    const first = await this.requestTranscript(apiKey, uploaded.uri, uploaded.mime, languageCode);
    if (first.ok) return first.transcript;
    if (languageCode && /language/i.test(first.error)) {
      const retry = await this.requestTranscript(apiKey, uploaded.uri, uploaded.mime, '');
      if (retry.ok) return retry.transcript;
      throw new BadRequestException(retry.error || 'Voice transcription failed');
    }
    throw new BadRequestException(first.error || 'Voice transcription failed');
  }

  private async uploadGeminiAudio(apiKey: string, audio: Buffer, mime: string) {
    const response = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-Command': 'start, upload, finalize',
        'X-Goog-Upload-Header-Content-Length': String(audio.length),
        'X-Goog-Upload-Header-Content-Type': mime,
        'Content-Type': mime,
      },
      body: new Uint8Array(audio),
    });
    const raw = await response.text();
    if (!response.ok) {
      this.logger.warn(`Gemini file upload failed: ${raw.slice(0, 240)}`);
      throw new BadRequestException(this.readGeminiError(raw));
    }
    const parsed = this.readJson(raw) as { file?: { uri?: string; mimeType?: string }; uri?: string; mimeType?: string };
    const uri = parsed.file?.uri || parsed.uri;
    if (!uri) {
      throw new BadRequestException('Voice file was uploaded without a file address');
    }
    return { uri, mime: parsed.file?.mimeType || parsed.mimeType || mime };
  }

  private async requestTranscript(apiKey: string, uri: string, mime: string, languageCode: string) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3.5-transcribe',
        input: [{ type: 'audio', uri, mime_type: mime }],
        generation_config: {
          transcription_config: {
            language_codes: languageCode ? [languageCode] : [],
          },
        },
      }),
    });
    const raw = await response.text();
    if (!response.ok) {
      this.logger.warn(`Gemini transcription failed: ${raw.slice(0, 240)}`);
      return { ok: false as const, transcript: '', error: this.readGeminiError(raw) };
    }
    const transcript = this.readTranscript(this.readJson(raw)).trim();
    return { ok: true as const, transcript, error: '' };
  }

  private readJson(raw: string) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }

  private readTranscript(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as {
      output_text?: string;
      outputText?: string;
      outputs?: unknown;
      steps?: Array<{ type?: string; content?: unknown; text?: string }>;
    };
    if (typeof record.output_text === 'string' && record.output_text.trim()) return record.output_text;
    if (typeof record.outputText === 'string' && record.outputText.trim()) return record.outputText;

    const collect = (value: unknown, chunks: string[]) => {
      if (!value) return;
      if (typeof value === 'string') {
        chunks.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => collect(item, chunks));
        return;
      }
      if (typeof value === 'object') {
        const item = value as { text?: string; content?: unknown };
        if (typeof item.text === 'string') chunks.push(item.text);
        if (item.content) collect(item.content, chunks);
      }
    };

    const steps = Array.isArray(record.steps) ? record.steps : [];
    const spoken = steps.filter((step) => step.type === 'model_output');
    const chunks: string[] = [];
    collect(spoken.length ? spoken : record.outputs, chunks);
    return chunks.join(' ').replace(/\s+/g, ' ').trim();
  }

  private readGeminiError(raw: string) {
    const parsed = this.readJson(raw) as { error?: { message?: string }; message?: string };
    const message = parsed.error?.message || parsed.message || raw;
    return String(message).replace(/\s+/g, ' ').slice(0, 240);
  }

  /**
   * 2. Multilingual Natural Language RSVP Intent Extractor
   * Supports English, Yoruba, Igbo, Hausa, & Nigerian Pidgin
   */
  parseRsvpIntent(transcript: string): RsvpIntentResult {
    const text = transcript.toLowerCase();

    // Confirm signals (English, Yoruba, Igbo, Hausa, Pidgin)
    const confirmKeywords = [
      'attend', 'attending', 'coming', 'come', 'yes', 'honored', 'gladly',
      'count me in', 'pleasure', 'be there', 'looking forward',
      'mo ma wa', 'a ma wa', 'mo n bo', // Yoruba
      'aga m bia', 'anyi ga-abia', // Igbo
      'zan zo', 'za mu zo', // Hausa
      'i dey come', 'we dey come', 'i go dey there', 'surely', // Pidgin
    ];

    // Decline signals
    const declineKeywords = [
      'cannot', 'can not', "can't", "won't", 'sorry', 'regret', 'decline',
      'unable', 'unfortunately', 'traveling', 'busy', 'miss',
      'mi o le wa', 'ko le wa', // Yoruba
      'a gaghị m enwe ike', 'agaghị m abịa', // Igbo
      'ba zan iya zuwa ba', // Hausa
      'i no go fit', 'i no fit come', // Pidgin
    ];

    // Tentative signals
    const tentativeKeywords = ['maybe', 'not sure', 'might', 'tentative', 'try to'];

    let status: 'CONFIRMED' | 'DECLINED' | 'TENTATIVE' = 'CONFIRMED';

    if (declineKeywords.some((word) => text.includes(word))) {
      status = 'DECLINED';
    } else if (tentativeKeywords.some((word) => text.includes(word))) {
      status = 'TENTATIVE';
    } else if (confirmKeywords.some((word) => text.includes(word))) {
      status = 'CONFIRMED';
    }

    // Guest Count Extractor
    let guestCount = 1;
    if (
      text.includes('plus one') ||
      text.includes('+1') ||
      text.includes('my wife') ||
      text.includes('my husband') ||
      text.includes('my spouse') ||
      text.includes('my partner') ||
      text.includes('two of us') ||
      text.includes('2 people') ||
      text.includes('2 seats') ||
      text.includes('two seats')
    ) {
      guestCount = 2;
    } else if (
      text.includes('three of us') ||
      text.includes('3 people') ||
      text.includes('3 seats')
    ) {
      guestCount = 3;
    } else if (
      text.includes('four of us') ||
      text.includes('4 people') ||
      text.includes('4 seats')
    ) {
      guestCount = 4;
    }

    // Dietary & Special Requests Extractor
    const notes: string[] = [];
    if (text.includes('vegetarian')) notes.push('Vegetarian');
    if (text.includes('vegan')) notes.push('Vegan');
    if (text.includes('halal')) notes.push('Halal');
    if (text.includes('kosher')) notes.push('Kosher');
    if (text.includes('allergy') || text.includes('allergic')) notes.push('Dietary Allergy');
    if (text.includes('vip') || text.includes('front row')) notes.push('VIP Placement');

    return {
      status,
      guestCount,
      dietaryOrNotes: notes.length > 0 ? notes.join(', ') : undefined,
    };
  }

  /**
   * 3. End-to-End Voice RSVP Processing & Attendee Record Updating
   */
  async processVoiceRsvp(dto: TranscribeVoiceDto) {
    const { transcript, confidence, languageDetected } =
      await this.transcribeAudio(dto.audioBase64, dto.mimeType, dto.languageCode);

    const intent = this.parseRsvpIntent(transcript);

    let attendeeRecord: any = null;

    if (dto.attendeeId) {
      const attendee = await this.prisma.attendee.findUnique({
        where: { id: dto.attendeeId },
      });

      if (attendee) {
        let mappedStatus: AttendeeStatus = AttendeeStatus.ATTENDING;
        let mappedRsvp: RsvpStatus = RsvpStatus.CONFIRMED;
        if (intent.status === 'DECLINED') {
          mappedStatus = AttendeeStatus.CANCELLED;
          mappedRsvp = RsvpStatus.DECLINED;
        } else if (intent.status === 'TENTATIVE') {
          mappedStatus = AttendeeStatus.PENDING;
          mappedRsvp = RsvpStatus.TENTATIVE;
        }

        const updatedNotes = [
          attendee.notes,
          `Voice RSVP: "${transcript}"`,
          intent.dietaryOrNotes ? `Requests: ${intent.dietaryOrNotes}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        attendeeRecord = await this.prisma.attendee.update({
          where: { id: attendee.id },
          data: {
            status: mappedStatus,
            rsvpStatus: mappedRsvp,
            partySize: intent.guestCount,
            dietaryPreference: intent.dietaryOrNotes || attendee.dietaryPreference,
            notes: updatedNotes,
          },
        });
      }
    }

    return {
      transcribedText: transcript,
      confidence,
      languageDetected,
      rsvpStatus: intent.status,
      guestCount: intent.guestCount,
      dietaryOrNotes: intent.dietaryOrNotes,
      attendee: attendeeRecord,
    };
  }

  getSupportedLanguages() {
    return [
      { code: 'en-US', name: 'English (US & Global)', default: true },
      { code: 'en-NG', name: 'Nigerian English' },
      { code: 'yo-NG', name: 'Yoruba' },
      { code: 'ig-NG', name: 'Igbo' },
      { code: 'ha-NG', name: 'Hausa' },
      { code: 'pcm-NG', name: 'Nigerian Pidgin' },
    ];
  }
}
