import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { ChatService } from './chat.service';
import { PostChatDto } from './dto/post-chat.dto';

@ApiTags('07 Shared Organizer / Communications')
@Controller('chat')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Get('threads/:eventId/:attendeeId')
  @ResponseMessage('Guest conversation retrieved')
  @ApiOperation({ summary: 'Live thread between an organizer and one guest' })
  list(@Param('eventId') eventId: string, @Param('attendeeId') attendeeId: string) {
    return this.chat.list(eventId, attendeeId);
  }

  @Post('messages')
  @UseGuards(OptionalJwtAuthGuard)
  @ResponseMessage('Message sent')
  @ApiOperation({ summary: 'Send a text, emoji, or media message on the live thread' })
  post(@Body() dto: PostChatDto, @CurrentUser() user?: { id: string; role: string }) {
    return this.chat.post(dto, user);
  }
}
