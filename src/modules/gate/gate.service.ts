import { Injectable, NotFoundException, ConflictException, Inject, HttpException, BadRequestException } from '@nestjs/common';
import { AttendeeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScanDto } from './dto/scan.dto';

@Injectable()
export class GateService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async verify(dto: ScanDto) {
    const attendee = await this.prisma.attendee.findUnique({
      where: { qrCode: dto.qrCode },
      include: {
        ticketTier: true,
        event: { select: { id: true, title: true, status: true } },
      },
    });

    if (!attendee) {
      throw new NotFoundException({
        result: 'INVALID',
        message: 'Invalid Ticket QR code. No matching registration found.',
      });
    }

    if (attendee.status === AttendeeStatus.CHECKED_IN) {
      await this.prisma.gateScanLog.create({
        data: {
          attendeeId: attendee.id,
          staffId: dto.staffId,
          scanResult: 'DUPLICATE',
          gateTurnstile: dto.gateTurnstile || 'Gate A-1',
        },
      });
      await this.prisma.checkInException.create({
        data: {
          eventId: attendee.eventId,
          attendeeId: attendee.id,
          reason: 'Duplicate Pass Scanned',
          turnstile: dto.gateTurnstile || 'Gate A-1',
        },
      });
      await this.prisma.attendee.update({
        where: { id: attendee.id },
        data: { isFlagged: true },
      });

      throw new ConflictException({
        result: 'DUPLICATE',
        message: `Already Checked In at ${attendee.checkInTime?.toLocaleTimeString() || 'earlier'}!`,
        attendee: {
          fullName: attendee.fullName,
          ticketTier: attendee.ticketTier.name,
          checkInTime: attendee.checkInTime,
        },
      });
    }

    const scannedAt = dto.scannedAt ? new Date(dto.scannedAt) : new Date();

    const updated = await this.prisma.attendee.update({
      where: { id: attendee.id },
      data: {
        status: AttendeeStatus.CHECKED_IN,
        checkInTime: scannedAt,
        checkedInBy: dto.staffId || 'Turnstile Scanner',
      },
      include: { ticketTier: true },
    });

    await this.prisma.gateScanLog.create({
      data: {
        attendeeId: attendee.id,
        staffId: dto.staffId,
        scanResult: 'VALID',
        gateTurnstile: dto.gateTurnstile || 'Gate A-1',
      },
    });

    return {
      result: 'VALID',
      message: `Access Granted. Welcome to ${attendee.event.title}!`,
      attendee: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        guestType: updated.guestType || updated.ticketTier?.name || 'General',
        partySize: updated.partySize,
        rsvpStatus: updated.rsvpStatus,
        ticketTier: updated.ticketTier?.name,
        gateTurnstile: dto.gateTurnstile || 'Gate 1',
        checkedInAt: updated.checkInTime,
      },
    };
  }

  async getShifts() {
    return this.prisma.gateStaffShift.findMany({
      where: { isActive: true },
      include: {
        staff: { include: { user: { select: { fullName: true, email: true } } } },
        event: { select: { title: true } },
      },
    });
  }

  /**
   * Assigned events, recent scans, and profile for the signed-in gate staff member.
   */
  async getWorkspace(userId?: string) {
    if (!userId) {
      throw new BadRequestException('Sign in as gate staff');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });
    if (!user) {
      throw new NotFoundException('Gate staff was not found');
    }

    const profileId = user.staffProfile?.id;
    const shifts = profileId
      ? await this.prisma.gateStaffShift.findMany({
          where: { staffId: profileId, isActive: true },
          include: {
            event: {
              include: {
                organizer: { select: { fullName: true } },
                attendees: { select: { status: true } },
              },
            },
          },
          orderBy: { shiftStart: 'desc' },
        })
      : [];

    const scans = profileId
      ? await this.prisma.gateScanLog.findMany({
          where: { staffId: profileId },
          include: {
            attendee: { select: { fullName: true, partySize: true, eventId: true, status: true } },
          },
          orderBy: { scannedAt: 'desc' },
          take: 80,
        })
      : [];

    return {
      staff: {
        id: user.id,
        profileId: profileId ?? null,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
      events: shifts.map((shift) => {
        const guests = shift.event.attendees;
        const now = Date.now();
        const ended = shift.event.endDate.getTime() < now;
        const live = shift.event.status === 'LIVE';
        return {
          id: shift.event.id,
          title: shift.event.title,
          startDate: shift.event.startDate.toISOString(),
          gate: shift.gateNumber,
          organizer: shift.event.organizer?.fullName || 'Organizer',
          status: ended ? 'Ended' : live ? 'Live' : 'Upcoming',
          expected: guests.length,
          checkedIn: guests.filter((guest) => guest.status === AttendeeStatus.CHECKED_IN).length,
        };
      }),
      scans: scans.map((scan) => ({
        id: scan.id,
        name: scan.attendee.fullName,
        partySize: scan.attendee.partySize,
        eventId: scan.attendee.eventId,
        gate: scan.gateTurnstile,
        scannedAt: scan.scannedAt.toISOString(),
        status: scan.scanResult,
      })),
    };
  }

  async searchGuests(userId: string | undefined, eventId: string, query: string) {
    const workspace = await this.getWorkspace(userId);
    const assigned = workspace.events.some((event) => event.id === eventId);
    if (!assigned) {
      throw new BadRequestException('You are not assigned to this event');
    }
    const term = query.trim();
    const guests = await this.prisma.attendee.findMany({
      where: {
        eventId,
        ...(term
          ? {
              OR: [
                { fullName: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term } },
                { email: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { ticketTier: { select: { name: true } } },
      orderBy: { fullName: 'asc' },
      take: 20,
    });
    return guests.map((guest) => ({
      id: guest.id,
      name: guest.fullName,
      guestType: guest.guestType || guest.ticketTier?.name || 'General',
      partySize: guest.partySize,
      rsvpStatus: guest.rsvpStatus,
      checkInStatus: guest.status === AttendeeStatus.CHECKED_IN ? 'Checked In' : 'Not Checked In',
      qrCode: guest.qrCode,
    }));
  }

  async syncOfflineScans(scans: ScanDto[]) {
    const results = [];
    for (const scan of scans) {
      try {
        const data = await this.verify(scan);
        await this.prisma.offlineScan.upsert({
          where: { clientScanId: scan.clientScanId || `${scan.qrCode}-${scan.scannedAt}` },
          update: { result: 'VALID', syncedAt: new Date() },
          create: {
            clientScanId: scan.clientScanId || `${scan.qrCode}-${Date.now()}`,
            qrCode: scan.qrCode,
            gateTurnstile: scan.gateTurnstile || 'A-1',
            capturedAt: scan.scannedAt ? new Date(scan.scannedAt) : new Date(),
            result: 'VALID',
          },
        });
        results.push({ clientScanId: scan.clientScanId, ok: true, data });
      } catch (error: unknown) {
        const status = error instanceof HttpException ? error.getStatus() : 400;
        const message =
          error instanceof Error ? error.message : 'Scan could not be synced';
        results.push({
          clientScanId: scan.clientScanId,
          ok: status === 409,
          duplicate: status === 409,
          error: message,
        });
      }
    }
    return { synced: results.length, results };
  }

  async samplePass() {
    if ((process.env.NODE_ENV || 'development') === 'production') {
      return { available: false };
    }
    const attendee = await this.prisma.attendee.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        qrCode: true,
        status: true,
        event: { select: { title: true } },
      },
    });
    return { available: Boolean(attendee), attendee };
  }
}
