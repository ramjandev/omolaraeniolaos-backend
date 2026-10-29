import { PrismaService } from '../../prisma/prisma.service';

export interface OrganizerAdminRecord {
  userId: string;
  eventId: string | null;
  joinedAt: string;
}

function adminsKey(userId: string) {
  return `ORGANIZER_ADMINS_${userId}`;
}

export async function readOrganizerAdmins(prisma: PrismaService, userId: string): Promise<OrganizerAdminRecord[]> {
  const row = await prisma.platformSetting.findUnique({ where: { key: adminsKey(userId) } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as { userId?: unknown; eventId?: unknown; joinedAt?: unknown };
      if (typeof record.userId !== 'string' || !record.userId) return [];
      return [
        {
          userId: record.userId,
          eventId: typeof record.eventId === 'string' && record.eventId ? record.eventId : null,
          joinedAt: typeof record.joinedAt === 'string' ? record.joinedAt : new Date().toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function saveOrganizerAdmin(
  prisma: PrismaService,
  organizerId: string,
  memberUserId: string,
  eventId?: string | null,
) {
  const records = await readOrganizerAdmins(prisma, organizerId);
  const existing = records.find((record) => record.userId === memberUserId);
  if (existing) {
    if (eventId !== undefined) existing.eventId = eventId || null;
  } else {
    records.push({
      userId: memberUserId,
      eventId: eventId || null,
      joinedAt: new Date().toISOString(),
    });
  }
  await prisma.platformSetting.upsert({
    where: { key: adminsKey(organizerId) },
    update: { value: JSON.stringify(records) },
    create: {
      key: adminsKey(organizerId),
      value: JSON.stringify(records),
      description: 'Admins invited by this organizer',
    },
  });
}
