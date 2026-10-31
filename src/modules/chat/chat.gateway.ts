import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface LiveChatMessage {
  id: string;
  eventId: string;
  attendeeId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  mediaUrl?: string | null;
  mediaKind?: string | null;
  fileName?: string | null;
  createdAt: string;
}

export function chatRoom(eventId: string, attendeeId: string) {
  return `event:${eventId}:guest:${attendeeId}`;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join')
  join(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { eventId?: string; attendeeId?: string },
  ) {
    if (!body?.eventId || !body?.attendeeId) return { ok: false };
    client.join(chatRoom(body.eventId, body.attendeeId));
    return { ok: true };
  }

  publish(message: LiveChatMessage) {
    this.server?.to(chatRoom(message.eventId, message.attendeeId)).emit('message', message);
  }
}
