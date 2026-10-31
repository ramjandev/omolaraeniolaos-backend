import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CommunicationChannel, ConversationDirection, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PostChatDto } from './dto/post-chat.dto';
import { ChatGateway, LiveChatMessage } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChatGateway) private readonly gateway: ChatGateway,
  ) {}

  async list(eventId: string, attendeeId: string) {
    await this.assertThread(eventId, attendeeId);
    const rows = await this.prisma.conversationMessage.findMany({
      where: { eventId, attendeeId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.present(row));
  }

  async post(
    dto: PostChatDto,
    user?: { id: string; role: string } | null,
  ): Promise<LiveChatMessage> {
    const text = (dto.body || '').trim();
    const mediaUrl = (dto.mediaUrl || '').trim();
    if (!text && !mediaUrl) {
      throw new BadRequestException('Type a message or attach a file');
    }
    await this.assertThread(dto.eventId, dto.attendeeId);

    let direction: ConversationDirection = ConversationDirection.INBOUND;
    if (dto.from === 'organizer') {
      if (!user?.id) throw new UnauthorizedException('Sign in to message this guest');
      const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
      if (!event) throw new NotFoundException('Event not found');
      if (user.role !== UserRole.ADMIN && event.organizerId !== user.id) {
        throw new ForbiddenException('You cannot message this guest');
      }
      direction = ConversationDirection.OUTBOUND;
    }

    const saved = await this.prisma.conversationMessage.create({
      data: {
        eventId: dto.eventId,
        attendeeId: dto.attendeeId,
        channel: CommunicationChannel.WHATSAPP,
        direction,
        body: text,
        mediaUrl: mediaUrl || null,
        mediaKind: dto.mediaKind || null,
        fileName: dto.fileName || null,
      },
    });
    const message = this.present(saved);
    this.gateway.publish(message);
    return message;
  }

  private async assertThread(eventId: string, attendeeId: string) {
    const attendee = await this.prisma.attendee.findFirst({
      where: { id: attendeeId, eventId },
      select: { id: true },
    });
    if (!attendee) throw new NotFoundException('This guest is not on the event');
  }

  private present(row: {
    id: string;
    eventId: string;
    attendeeId: string;
    direction: ConversationDirection;
    body: string;
    mediaUrl: string | null;
    mediaKind: string | null;
    fileName: string | null;
    createdAt: Date;
  }): LiveChatMessage {
    return {
      id: row.id,
      eventId: row.eventId,
      attendeeId: row.attendeeId,
      direction: row.direction,
      body: row.body,
      mediaUrl: row.mediaUrl,
      mediaKind: row.mediaKind,
      fileName: row.fileName,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
