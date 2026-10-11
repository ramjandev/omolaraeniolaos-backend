import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class AgencyService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getClients() {
    return this.prisma.agencyClient.findMany({
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

  async getInvoices() {
    return this.prisma.agencyInvoice.findMany({
      include: {
        client: { select: { name: true, contactEmail: true } },
        event: { select: { title: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }
}
