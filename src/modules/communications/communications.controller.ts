import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { CommunicationsService } from './communications.service';
import { DispatchMessageDto } from './dto/dispatch.dto';
import { GuestRsvpDto } from './dto/guest-rsvp.dto';
import { SaveMessageTemplateDto } from './dto/message-template.dto';

@ApiTags('07 Shared Organizer / Communications')
@Controller('communications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.INDIVIDUAL, UserRole.AGENCY, UserRole.VENUE)
@ApiBearerAuth()
export class CommunicationsController {
  constructor(
    @Inject(CommunicationsService)
    private readonly communicationsService: CommunicationsService,
  ) {}

  @Get('health')
  @ResponseMessage('Communication channel health retrieved')
  @ApiOperation({
    summary: 'Sandbox-safe status of WhatsApp, SMS, and email providers',
    description: '**Roles:** INDIVIDUAL · AGENCY · VENUE · ADMIN',
  })
  getHealth() {
    return this.communicationsService.getChannelHealth();
  }

  @Get('events/:eventId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Event communications retrieved')
  list(@Param('eventId') eventId: string) {
    return this.communicationsService.listEventCommunications(eventId);
  }

  @Get('events/:eventId/templates')
  @ResponseMessage('Message templates retrieved')
  @ApiOperation({ summary: 'List saved message templates for an event' })
  listTemplates(@Param('eventId') eventId: string, @CurrentUser() user: CurrentUserDto) {
    return this.communicationsService.listTemplates(eventId, user);
  }

  @Post('events/:eventId/templates')
  @ResponseMessage('Message template saved')
  @ApiOperation({ summary: 'Create a message template for an event' })
  createTemplate(
    @Param('eventId') eventId: string,
    @Body() dto: SaveMessageTemplateDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.communicationsService.createTemplate(eventId, dto, user);
  }

  @Patch('events/:eventId/templates/:templateId')
  @ResponseMessage('Message template updated')
  @ApiOperation({ summary: 'Update a saved message template' })
  updateTemplate(
    @Param('eventId') eventId: string,
    @Param('templateId') templateId: string,
    @Body() dto: SaveMessageTemplateDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.communicationsService.updateTemplate(eventId, templateId, dto, user);
  }

  @Delete('events/:eventId/templates/:templateId')
  @ResponseMessage('Message template deleted')
  @ApiOperation({ summary: 'Delete a saved message template' })
  deleteTemplate(
    @Param('eventId') eventId: string,
    @Param('templateId') templateId: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.communicationsService.deleteTemplate(eventId, templateId, user);
  }

  @Get('events/:eventId/threads/:attendeeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Guest conversation retrieved')
  thread(
    @Param('eventId') eventId: string,
    @Param('attendeeId') attendeeId: string,
  ) {
    return this.communicationsService.listThread(eventId, attendeeId);
  }

  @Post('dispatch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Coordinated message dispatched')
  @ApiOperation({
    summary: 'Send one campaign across WhatsApp, SMS, and email together',
  })
  dispatch(@Body() dto: DispatchMessageDto) {
    return this.communicationsService.dispatchCampaign(dto);
  }
}

@ApiTags('06 Guest / RSVP & Pass')
@Controller('guest')
export class GuestRsvpController {
  constructor(
    @Inject(CommunicationsService)
    private readonly communicationsService: CommunicationsService,
  ) {}

  @Get('pass')
  @ResponseMessage('Guest pass retrieved')
  @ApiOperation({
    summary: 'Load guest digital pass by attendeeId, QR, or passToken',
    description: '**Role:** GUEST (public). No JWT. Used by the guest PWA.',
  })
  @ApiQuery({ name: 'attendeeId', required: false })
  @ApiQuery({ name: 'qrCode', required: false })
  @ApiQuery({ name: 'passToken', required: false })
  @ApiQuery({ name: 'phone', required: false })
  @ApiQuery({ name: 'eventId', required: false })
  getPass(
    @Query('attendeeId') attendeeId?: string,
    @Query('qrCode') qrCode?: string,
    @Query('passToken') passToken?: string,
    @Query('phone') phone?: string,
    @Query('eventId') eventId?: string,
  ) {
    return this.communicationsService.getGuestPass({
      attendeeId,
      qrCode,
      passToken,
      phone,
      eventId,
    });
  }

  @Post('rsvp')
  @ResponseMessage('Guest RSVP recorded')
  @ApiOperation({
    summary: 'Record guest RSVP from WhatsApp, SMS, email, or the guest PWA',
    description: '**Role:** GUEST (public). No JWT.',
  })
  rsvp(@Body() dto: GuestRsvpDto) {
    return this.communicationsService.recordGuestRsvp(dto);
  }
}

@ApiTags('00 Public / Webhooks')
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    @Inject(CommunicationsService)
    private readonly communicationsService: CommunicationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Meta WhatsApp Cloud API webhook verification' })
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
    if (mode === 'subscribe' && token === expected) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  @Post()
  @ApiOperation({ summary: 'Inbound WhatsApp messages for RSVP intent' })
  async inbound(@Body() payload: Record<string, unknown>, @Res() res: Response) {
    await this.communicationsService.handleWhatsAppInbound(payload);
    return res.status(200).json({ success: true });
  }
}
