import { Injectable, NotFoundException, ConflictException, Inject, HttpException } from '@nestjs/common';
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
        ticketTier: updated.ticketTier.name,
        gateTurnstile: dto.gateTurnstile || 'Gate A-1',
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
