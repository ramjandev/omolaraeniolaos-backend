import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
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

    const updated = await this.prisma.attendee.update({
      where: { id: attendee.id },
      data: {
        status: AttendeeStatus.CHECKED_IN,
        checkInTime: new Date(),
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
}
