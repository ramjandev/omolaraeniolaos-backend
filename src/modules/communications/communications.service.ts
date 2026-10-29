import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Attendee,
  AttendeeStatus,
  CampaignStatus,
  CommunicationChannel,
  ConversationDirection,
  Event,
  MessageDeliveryStatus,
  RsvpStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DispatchChannel, DispatchMessageDto } from './dto/dispatch.dto';
import { GuestRsvpDto } from './dto/guest-rsvp.dto';

export type DeliveryStatus = 'sent' | 'failed' | 'sandbox_logged';

export interface ChannelDelivery {
  channel: DispatchChannel;
  status: DeliveryStatus;
  to: string;
  deliveredTo?: string;
  error?: string;
}

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(MailService) private readonly mailService?: MailService,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService,
  ) {}

  getChannelHealth() {
    const whatsapp = Boolean(this.env('WHATSAPP_ACCESS_TOKEN') && this.env('WHATSAPP_PHONE_NUMBER_ID'));
    const email = Boolean(this.env('RESEND_API_KEY'));
    const sms = this.smsReady();
    return {
      environment: this.env('NODE_ENV') || 'development',
      sandbox: this.env('NODE_ENV') !== 'production',
      channels: {
        WHATSAPP: whatsapp ? 'configured' : 'missing_credentials',
        EMAIL: email ? 'configured' : 'sandbox_log',
        SMS: sms ? 'configured' : 'sandbox_log',
      },
    };
  }

  async dispatchCampaign(dto: DispatchMessageDto) {
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) {
      throw new NotFoundException(`Event ${dto.eventId} not found`);
    }

    const attendees = await this.resolveAudience(dto);
    const deliveries: ChannelDelivery[] = [];

    for (const attendee of attendees) {
      const result = await this.dispatchToAttendee({
        event,
        attendee,
        channels: dto.channels,
        subject: dto.subject,
        content: this.personalize(dto.content, event, attendee),
      });
      deliveries.push(...result);
    }

    const sent = deliveries.filter((d) => d.status !== 'failed').length;
    const campaign = await this.prisma.guestCommunication.create({
      data: {
        eventId: event.id,
        channel: this.toPrismaChannel(dto.channels[0] || DispatchChannel.WHATSAPP),
        targetAudience: dto.audience || (dto.attendeeIds?.length ? 'selected' : 'all'),
        subject: dto.subject,
        content: dto.content,
        status: CampaignStatus.SENT,
        sentAt: new Date(),
        recipientsCount: attendees.length * dto.channels.length,
        deliveredCount: sent,
      },
    });

    await this.persistDeliveries(campaign.id, attendees, deliveries);

    return {
      eventId: event.id,
      campaignId: campaign.id,
      recipients: attendees.length,
      channels: dto.channels,
      deliveries,
    };
  }

  async dispatchInvite(eventId: string, guestId: string, preferredChannel?: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    const attendee = await this.prisma.attendee.findUnique({ where: { id: guestId } });
    if (!attendee) {
      throw new NotFoundException(`Guest ${guestId} not found`);
    }

    const channels = this.inviteChannels(attendee, preferredChannel);
    const passUrl = `${this.frontendUrl()}/guest/pass?qr=${encodeURIComponent(attendee.qrCode)}&eventId=${event.id}`;
    const rsvpUrl = `${this.frontendUrl()}/guest?attendeeId=${attendee.id}&eventId=${event.id}&qr=${encodeURIComponent(attendee.qrCode)}`;
    const subject = `You're invited: ${event.title}`;
    const content = [
      `Hello ${attendee.fullName},`,
      `You are invited to ${event.title}.`,
      `RSVP here: ${rsvpUrl}`,
      `Your digital pass: ${passUrl}`,
      `QR: ${attendee.qrCode}`,
    ].join('\n');

    const deliveries = await this.dispatchToAttendee({
      event,
      attendee,
      channels,
      subject,
      content,
    });

    const campaign = await this.prisma.guestCommunication.create({
      data: {
        eventId,
        channel: this.toPrismaChannel(channels[0]),
        targetAudience: attendee.email || attendee.phone || attendee.id,
        subject,
        content,
        status: CampaignStatus.SENT,
        sentAt: new Date(),
        recipientsCount: channels.length,
        deliveredCount: deliveries.filter((d) => d.status !== 'failed').length,
      },
    });

    await this.persistDeliveries(campaign.id, [attendee], deliveries);
    await this.prisma.conversationMessage.create({
      data: {
        eventId,
        attendeeId: attendee.id,
        campaignId: campaign.id,
        channel: this.toPrismaChannel(channels[0]),
        direction: ConversationDirection.OUTBOUND,
        body: content,
      },
    });
    await this.prisma.attendee.update({
      where: { id: attendee.id },
      data: {
        rsvpStatus:
          attendee.rsvpStatus === RsvpStatus.NOT_SENT
            ? RsvpStatus.AWAITING
            : attendee.rsvpStatus,
        inviteChannel: this.toPrismaChannel(channels[0]),
      },
    });

    return {
      guestId,
      channels,
      deliveries,
      rsvpUrl,
      passUrl,
    };
  }

  async dispatchReminder(eventId: string, guestId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    const attendee = await this.prisma.attendee.findUnique({ where: { id: guestId } });
    if (!attendee) {
      throw new NotFoundException(`Guest ${guestId} not found`);
    }

    const rsvpUrl = `${this.frontendUrl()}/guest?attendeeId=${attendee.id}&eventId=${event.id}`;
    return this.dispatchToAttendee({
      event,
      attendee,
      channels: this.inviteChannels(attendee),
      subject: `Reminder: ${event.title}`,
      content: `Hello ${attendee.fullName}, please confirm your RSVP for ${event.title}. ${rsvpUrl}`,
    });
  }

  async recordGuestRsvp(dto: GuestRsvpDto) {
    const attendee = await this.findAttendee(dto);
    if (!attendee) {
      throw new NotFoundException('Guest pass not found');
    }

    const rsvpStatus =
      dto.status === 'accepted'
        ? RsvpStatus.CONFIRMED
        : dto.status === 'declined'
          ? RsvpStatus.DECLINED
          : RsvpStatus.TENTATIVE;

    const status =
      dto.status === 'accepted'
        ? AttendeeStatus.ATTENDING
        : dto.status === 'declined'
          ? AttendeeStatus.CANCELLED
          : AttendeeStatus.PENDING;

    const updated = await this.prisma.attendee.update({
      where: { id: attendee.id },
      data: {
        status,
        rsvpStatus,
        partySize: dto.partySize ?? attendee.partySize,
        dietaryPreference: dto.dietary ?? attendee.dietaryPreference,
        language: dto.language ?? attendee.language,
        notes: dto.notes ?? attendee.notes,
      },
    });

    await this.prisma.conversationMessage.create({
      data: {
        eventId: updated.eventId,
        attendeeId: updated.id,
        channel: CommunicationChannel.WHATSAPP,
        direction: ConversationDirection.INBOUND,
        body: dto.notes || `RSVP ${dto.status}`,
      },
    });

    return {
      attendeeId: updated.id,
      eventId: updated.eventId,
      rsvp: dto.status,
      rsvpStatus: updated.rsvpStatus,
      partySize: updated.partySize,
      qrCode: updated.qrCode,
    };
  }

  async getGuestPass(query: {
    attendeeId?: string;
    qrCode?: string;
    phone?: string;
    eventId?: string;
    passToken?: string;
  }) {
    const attendee = await this.findAttendee(query);
    if (!attendee) {
      throw new NotFoundException('Guest pass not found');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: attendee.eventId },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        address: true,
        city: true,
        country: true,
        coverImageUrl: true,
        venueName: true,
      },
    });
    const seat = await this.prisma.tableAssignment.findUnique({
      where: { attendeeId: attendee.id },
      include: { zone: true },
    });
    let tableName = 'Not assigned';
    let seatLabel = '';
    if (seat) {
      try {
        const meta = JSON.parse(seat.zone.zoneName) as { name?: string };
        tableName = meta.name || seat.zone.zoneName;
      } catch {
        tableName = seat.zone.zoneName;
      }
      const start = seat.seatNumber || 1;
      const count = Math.max(1, attendee.partySize || 1);
      seatLabel = Array.from({ length: count }, (_, index) => (
        `T${seat.tableNumber}-${String(start + index).padStart(2, '0')}`
      )).join(', ');
    }

    return {
      attendeeId: attendee.id,
      eventId: attendee.eventId,
      fullName: attendee.fullName,
      email: attendee.email,
      phone: attendee.phone,
      qrCode: attendee.qrCode,
      passToken: attendee.passToken,
      rsvpStatus: attendee.rsvpStatus,
      status: attendee.status,
      partySize: attendee.partySize,
      dietaryPreference: attendee.dietaryPreference,
      language: attendee.language,
      guestType: attendee.guestType,
      notes: attendee.notes,
      tableName,
      seatLabel,
      event,
    };
  }

  async handleWhatsAppInbound(payload: Record<string, unknown>) {
    const messages = this.extractWhatsAppMessages(payload);
    const results = [];

    for (const message of messages) {
      const attendee = await this.findAttendee({ phone: message.from });
      if (!attendee) {
        results.push({ from: message.from, status: 'unknown_guest' });
        continue;
      }

      const intent = this.parseRsvpIntent(message.text);
      if (intent) {
        await this.recordGuestRsvp({
          attendeeId: attendee.id,
          status: intent,
          notes: message.text,
        });
        results.push({ from: message.from, attendeeId: attendee.id, rsvp: intent });
      } else {
        await this.prisma.conversationMessage.create({
          data: {
            eventId: attendee.eventId,
            attendeeId: attendee.id,
            channel: CommunicationChannel.WHATSAPP,
            direction: ConversationDirection.INBOUND,
            body: message.text,
          },
        });
        results.push({ from: message.from, attendeeId: attendee.id, status: 'noted' });
      }
    }

    return { processed: results.length, results };
  }

  async listEventCommunications(eventId: string) {
    return this.prisma.guestCommunication.findMany({
      where: { eventId },
      include: { deliveries: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listThread(eventId: string, attendeeId: string) {
    return this.prisma.conversationMessage.findMany({
      where: { eventId, attendeeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async persistDeliveries(
    campaignId: string,
    attendees: Attendee[],
    deliveries: ChannelDelivery[],
  ) {
    if (!attendees.length) return;
    const attendee = attendees.length === 1 ? attendees[0] : null;
    await this.prisma.communicationDelivery.createMany({
      data: deliveries.map((row, index) => ({
        campaignId,
        attendeeId: attendee?.id || attendees[Math.min(index, attendees.length - 1)].id,
        channel: this.toPrismaChannel(row.channel),
        toAddress: row.to,
        status:
          row.status === 'sent'
            ? MessageDeliveryStatus.SENT
            : row.status === 'sandbox_logged'
              ? MessageDeliveryStatus.SANDBOX_LOGGED
              : MessageDeliveryStatus.FAILED,
        error: row.error,
        sentAt: new Date(),
      })),
    });
  }

  private async dispatchToAttendee(input: {
    event: Event;
    attendee: Attendee;
    channels: DispatchChannel[];
    subject: string;
    content: string;
  }): Promise<ChannelDelivery[]> {
    const deliveries: ChannelDelivery[] = [];

    for (const channel of input.channels) {
      if (channel === DispatchChannel.WHATSAPP) {
        deliveries.push(await this.sendWhatsApp(input.attendee, input.content));
      } else if (channel === DispatchChannel.EMAIL) {
        deliveries.push(await this.sendEmail(input.attendee, input.subject, input.content));
      } else if (channel === DispatchChannel.SMS) {
        deliveries.push(await this.sendSms(input.attendee, input.content));
      }
    }

    return deliveries;
  }

  async sendGateNotice(input: {
    phone?: string | null;
    name: string;
    eventTitle: string;
    gateNumber: string;
    loginUrl: string;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; error?: string }> {
    const to = this.digits(input.phone || '');
    if (!to) {
      return { status: 'skipped', error: 'No phone number on this gate staff profile' };
    }

    const token = this.env('WHATSAPP_ACCESS_TOKEN');
    const phoneId = this.env('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) {
      return { status: 'skipped', error: 'WhatsApp is not configured' };
    }

    const templateName = this.env('WHATSAPP_TEMPLATE_NAME');
    const templateLang = this.env('WHATSAPP_TEMPLATE_LANGUAGE') || 'en';
    if (!templateName) {
      return { status: 'skipped', error: 'WhatsApp template name is not configured' };
    }

    const sentence = this.templateText(
      `${input.name}, you are assigned to ${input.eventTitle}. Your gate is ${input.gateNumber}. Sign in at ${input.loginUrl}`,
    );
    const slots = await this.templateBodySlots(templateName, templateLang);
    const values =
      slots <= 1
        ? [sentence]
        : [
            this.templateText(input.name),
            this.templateText(
              `You are assigned to ${input.eventTitle}. Gate: ${input.gateNumber}. Sign in at ${input.loginUrl}`,
            ),
          ];

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: 'body',
            parameters: Array.from({ length: slots }, (_, index) => ({
              type: 'text',
              text: values[index] || values[values.length - 1],
            })),
          },
        ],
      },
    };

    try {
      const response = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = this.readProviderError(await response.text());
        this.logger.warn(`WhatsApp gate notice failed: ${error}`);
        return { status: 'failed', error };
      }
      return { status: 'sent' };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'WhatsApp error';
      return { status: 'failed', error };
    }
  }

  private templateText(value: string) {
    return value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 900) || 'McEniesVite';
  }

  private templateSlotCache: number | null = null;

  private async templateBodySlots(name: string, language: string) {
    if (this.templateSlotCache != null) return this.templateSlotCache;
    const token = this.env('WHATSAPP_ACCESS_TOKEN');
    const wabaId = this.env('WHATSAPP_BUSINESS_ACCOUNT_ID');
    this.templateSlotCache = 1;
    if (!token || !wabaId) return this.templateSlotCache;

    try {
      const url = `https://graph.facebook.com/v25.0/${wabaId}/message_templates?name=${encodeURIComponent(name)}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return this.templateSlotCache;
      const json = (await response.json()) as {
        data?: Array<{ name?: string; language?: string; components?: Array<{ type?: string; text?: string }> }>;
      };
      const template =
        json.data?.find((item) => item.name === name && item.language === language) || json.data?.[0];
      const body = template?.components?.find((component) => component.type === 'BODY')?.text || '';
      const slots = body.match(/\{\{\d+\}\}/g)?.length ?? 1;
      this.templateSlotCache = Math.max(1, slots);
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'template lookup failed';
      this.logger.warn(`WhatsApp template lookup failed: ${error}`);
    }
    return this.templateSlotCache;
  }

  private readProviderError(raw: string) {
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: { message?: string } };
      return String(parsed?.error?.message || parsed?.message || raw).slice(0, 240);
    } catch {
      return raw.slice(0, 240);
    }
  }

  private async sendWhatsApp(attendee: Attendee, body: string): Promise<ChannelDelivery> {
    const to = this.digits(attendee.phone || '');
    if (!to) {
      return { channel: DispatchChannel.WHATSAPP, status: 'failed', to: '', error: 'No phone' };
    }

    const token = this.env('WHATSAPP_ACCESS_TOKEN');
    const phoneId = this.env('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) {
      this.logger.log(`[sandbox] WhatsApp to ${to}: ${body.slice(0, 80)}`);
      return { channel: DispatchChannel.WHATSAPP, status: 'sandbox_logged', to };
    }

    const templateName = this.env('WHATSAPP_TEMPLATE_NAME');
    const templateLang = this.env('WHATSAPP_TEMPLATE_LANGUAGE') || 'en';
    const notice = this.templateText(body);
    const slots = templateName ? await this.templateBodySlots(templateName, templateLang) : 1;
    const values =
      slots <= 1
        ? [notice]
        : [this.templateText(attendee.fullName), notice];

    const payload = templateName
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              {
                type: 'body',
                parameters: Array.from({ length: slots }, (_, index) => ({
                  type: 'text',
                  text: values[index] || values[values.length - 1],
                })),
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: notice, preview_url: true },
        };

    try {
      const response = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.text();
        this.logger.warn(`WhatsApp send failed: ${error}`);
        return { channel: DispatchChannel.WHATSAPP, status: 'failed', to, error };
      }
      return { channel: DispatchChannel.WHATSAPP, status: 'sent', to };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'WhatsApp error';
      return { channel: DispatchChannel.WHATSAPP, status: 'failed', to, error };
    }
  }

  private async sendEmail(attendee: Attendee, subject: string, body: string): Promise<ChannelDelivery> {
    const to = attendee.email;
    if (!to) {
      return { channel: DispatchChannel.EMAIL, status: 'failed', to: '', error: 'No email' };
    }

    const html = `<p style="font-family:Georgia,serif;line-height:1.5;white-space:pre-wrap">${body.replace(/\n/g, '<br/>')}</p>`;
    const result = this.mailService
      ? await this.mailService.sendEmail(to, subject, html)
      : { ok: false, error: 'Mail service unavailable' };
    return {
      channel: DispatchChannel.EMAIL,
      status: result.ok ? 'sent' : 'failed',
      to,
      deliveredTo: result.deliveredTo,
      error: result.ok ? undefined : result.error,
    };
  }

  private async sendSms(attendee: Attendee, body: string): Promise<ChannelDelivery> {
    const to = this.digits(attendee.phone || '');
    if (!to) {
      return { channel: DispatchChannel.SMS, status: 'failed', to: '', error: 'No phone' };
    }

    return this.sendTwilioSms(to, body);
  }

  private async sendTwilioSms(to: string, body: string): Promise<ChannelDelivery> {
    const sid = this.env('TWILIO_ACCOUNT_SID');
    const token = this.env('TWILIO_AUTH_TOKEN');
    const from = this.env('TWILIO_FROM_NUMBER');
    if (!sid || !token || !from) {
      this.logger.log(`[sandbox] Twilio SMS to ${to}: ${body.slice(0, 80)}`);
      return { channel: DispatchChannel.SMS, status: 'sandbox_logged', to };
    }

    const e164 = this.toE164(to);
    try {
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const params = new URLSearchParams({ To: e164, From: from, Body: body });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      if (!response.ok) {
        return { channel: DispatchChannel.SMS, status: 'failed', to: e164, error: await response.text() };
      }
      return { channel: DispatchChannel.SMS, status: 'sent', to: e164 };
    } catch (err: unknown) {
      return {
        channel: DispatchChannel.SMS,
        status: 'failed',
        to: e164,
        error: err instanceof Error ? err.message : 'Twilio error',
      };
    }
  }

  private async resolveAudience(dto: DispatchMessageDto) {
    if (dto.attendeeIds?.length) {
      return this.prisma.attendee.findMany({
        where: { id: { in: dto.attendeeIds }, eventId: dto.eventId },
      });
    }

    const where: { eventId: string; status?: AttendeeStatus } = { eventId: dto.eventId };
    if (dto.audience === 'unchecked_in') {
      where.status = AttendeeStatus.ATTENDING;
    }
    if (dto.audience === 'no_response') {
      where.status = AttendeeStatus.PENDING;
    }

    const attendees = await this.prisma.attendee.findMany({ where });
    if (dto.audience === 'vip') {
      return attendees.filter((row) => /vip/i.test(row.notes || ''));
    }
    return attendees;
  }

  private async findAttendee(dto: {
    attendeeId?: string;
    qrCode?: string;
    phone?: string;
    eventId?: string;
    passToken?: string;
  }) {
    if (dto.attendeeId) {
      return this.prisma.attendee.findUnique({ where: { id: dto.attendeeId } });
    }
    if (dto.passToken) {
      return this.prisma.attendee.findUnique({ where: { passToken: dto.passToken } });
    }
    if (dto.qrCode) {
      return this.prisma.attendee.findUnique({ where: { qrCode: dto.qrCode } });
    }
    if (dto.phone) {
      const digits = this.digits(dto.phone);
      const attendees = await this.prisma.attendee.findMany({
        where: dto.eventId ? { eventId: dto.eventId } : undefined,
        take: 200,
      });
      return attendees.find((row) => this.digits(row.phone || '') === digits) || null;
    }
    return null;
  }

  private inviteChannels(attendee: Attendee, preferred?: string): DispatchChannel[] {
    const channels: DispatchChannel[] = [];
    const mapped = preferred ? this.mapChannel(preferred) : null;
    if (mapped === DispatchChannel.SMS && attendee.phone) channels.push(DispatchChannel.SMS);
    else if (mapped === DispatchChannel.WHATSAPP && attendee.phone) channels.push(DispatchChannel.WHATSAPP);
    else if (mapped !== DispatchChannel.EMAIL && attendee.phone) channels.push(DispatchChannel.WHATSAPP);

    if (this.hasEmail(attendee.email)) channels.push(DispatchChannel.EMAIL);
    if (!channels.length) channels.push(attendee.phone ? DispatchChannel.WHATSAPP : DispatchChannel.EMAIL);
    return channels;
  }

  private hasEmail(value?: string | null) {
    return Boolean(value && value.includes('@'));
  }

  private availableChannels(attendee: Attendee): DispatchChannel[] {
    const channels: DispatchChannel[] = [];
    if (attendee.phone) {
      channels.push(DispatchChannel.WHATSAPP, DispatchChannel.SMS);
    }
    if (attendee.email) {
      channels.push(DispatchChannel.EMAIL);
    }
    return channels.length ? channels : [DispatchChannel.WHATSAPP];
  }

  private mapChannel(value: string): DispatchChannel | null {
    const key = value.trim().toUpperCase();
    if (key === 'WHATSAPP') return DispatchChannel.WHATSAPP;
    if (key === 'SMS') return DispatchChannel.SMS;
    if (key === 'EMAIL') return DispatchChannel.EMAIL;
    return null;
  }

  private toPrismaChannel(channel: DispatchChannel): CommunicationChannel {
    if (channel === DispatchChannel.SMS) return CommunicationChannel.SMS;
    if (channel === DispatchChannel.EMAIL) return CommunicationChannel.EMAIL;
    return CommunicationChannel.WHATSAPP;
  }

  private personalize(content: string, event: Event, attendee: Attendee) {
    return content
      .replaceAll('{name}', attendee.fullName)
      .replaceAll('{event}', event.title)
      .replaceAll('{qr}', attendee.qrCode);
  }

  private parseRsvpIntent(text: string): GuestRsvpDto['status'] | null {
    const value = text.toLowerCase();
    if (/\b(yes|attend|coming|accept|confirmed|mo|eh|ehn)\b/.test(value)) {
      return 'accepted';
    }
    if (/\b(no|decline|can't|cannot|not coming)\b/.test(value)) {
      return 'declined';
    }
    if (/\b(maybe|tentative|later)\b/.test(value)) {
      return 'tentative';
    }
    return null;
  }

  private extractWhatsAppMessages(payload: Record<string, unknown>) {
    const entries = (payload.entry as Array<Record<string, unknown>>) || [];
    const messages: Array<{ from: string; text: string }> = [];
    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) || [];
      for (const change of changes) {
        const value = (change.value as Record<string, unknown>) || {};
        const inbound = (value.messages as Array<Record<string, unknown>>) || [];
        for (const message of inbound) {
          const text = ((message.text as Record<string, unknown>)?.body as string) || '';
          messages.push({ from: String(message.from || ''), text });
        }
      }
    }
    return messages;
  }

  private smsReady() {
    return Boolean(
      this.env('TWILIO_ACCOUNT_SID') && this.env('TWILIO_AUTH_TOKEN') && this.env('TWILIO_FROM_NUMBER'),
    );
  }

  private digits(value: string) {
    const raw = value.replace(/\D/g, '');
    if (raw.startsWith('880') || raw.startsWith('234')) {
      return raw;
    }
    if (raw.startsWith('0') && raw.length === 11) {
      // BD mobiles are 01X…; NG mobiles are 07X / 08X / 09X.
      if (raw.startsWith('01')) {
        return `880${raw.slice(1)}`;
      }
      return `234${raw.slice(1)}`;
    }
    return raw;
  }

  private toE164(digits: string) {
    const raw = digits.replace(/\D/g, '');
    return raw.startsWith('+') ? digits : `+${raw}`;
  }

  private frontendUrl() {
    const configured = (this.env('FRONTEND_URL') || '').replace(/\/$/, '');
    if (!configured || configured.includes('localhost') || configured.includes('127.0.0.1')) {
      return 'https://omolaraeniolaos-frontend.vercel.app';
    }
    return configured;
  }

  private env(key: string) {
    return this.config?.get<string>(key) || process.env[key] || '';
  }
}
