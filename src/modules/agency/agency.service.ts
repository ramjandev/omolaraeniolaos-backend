import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class AgencyService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getClients(userId?: string, role?: string) {
    if (role !== 'ADMIN' && userId) {
      const agency = await this.prisma.agencyProfile.findFirst({ where: { userId } });
      if (!agency) return [];
      return this.prisma.agencyClient.findMany({
        where: { agencyId: agency.id },
        include: {
          events: { select: { id: true, title: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.agencyClient.findMany({
      where: undefined,
      include: {
        events: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createClient(userId: string, dto: CreateClientDto) {
    let agency = await this.prisma.agencyProfile.findFirst({
      where: { userId },
    });

    if (!agency) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      agency = await this.prisma.agencyProfile.create({
        data: {
          userId,
          agencyName: `${user?.fullName || 'Production'} Agency`,
          billingEmail: user?.email || 'billing@agency.com',
        },
      });
    }

    return this.prisma.agencyClient.create({
      data: {
        ...dto,
        agencyId: agency.id,
      },
    });
  }

  async getInvoices(userId?: string, role?: string) {
    if (role !== 'ADMIN' && userId) {
      const agency = await this.prisma.agencyProfile.findFirst({ where: { userId } });
      if (!agency) return [];
      return this.prisma.agencyInvoice.findMany({
        where: { agencyId: agency.id },
        include: {
          client: { select: { name: true, contactEmail: true } },
          event: { select: { title: true } },
        },
        orderBy: { issueDate: 'desc' },
      });
    }

    return this.prisma.agencyInvoice.findMany({
      where: undefined,
      include: {
        client: { select: { name: true, contactEmail: true } },
        event: { select: { title: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }
}
