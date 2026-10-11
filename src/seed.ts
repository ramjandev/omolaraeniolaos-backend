import { PrismaClient, UserRole, EventFormat, EventStatus, TicketTierType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Super Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mceniesvite.com' },
    update: {},
    create: {
      email: 'admin@mceniesvite.com',
      passwordHash: '$2a$10$wN1rF2c0wE4bKkP.seedhash',
      fullName: 'Super Admin Operator',
      role: UserRole.SUPER_ADMIN,
    },
  });

  // 2. Create Individual Organizer
  const individualOrganizer = await prisma.user.upsert({
    where: { email: 'james.obi@events.com' },
    update: {},
    create: {
      email: 'james.obi@events.com',
      passwordHash: '$2a$10$wN1rF2c0wE4bKkP.seedhash',
      fullName: 'James Obi',
      role: UserRole.ORGANIZER_INDIVIDUAL,
      profile: {
        create: {
          bio: 'Independent event curator & tech summit organizer in West Africa.',
          company: 'Lagos Tech Pulse',
        },
      },
    },
  });

  // 3. Create Sample Event
  const techSummit = await prisma.event.upsert({
    where: { slug: 'lagos-tech-summit-2026' },
    update: {},
    create: {
      organizerId: individualOrganizer.id,
      title: 'Lagos Tech Summit 2026',
      slug: 'lagos-tech-summit-2026',
      description: 'The premier annual gathering of African builders, founders, and investors.',
      category: 'Technology & Startups',
      format: EventFormat.IN_PERSON,
      status: EventStatus.LIVE,
      startDate: new Date('2026-10-24T09:00:00Z'),
      endDate: new Date('2026-10-25T18:00:00Z'),
      venueName: 'Landmark Centre, Victoria Island',
      address: 'Water Corporation Drive',
      city: 'Lagos',
      country: 'Nigeria',
      capacity: 1200,
      currency: 'NGN',
      ticketTiers: {
        create: [
          {
            name: 'Standard Pass',
            type: TicketTierType.GENERAL,
            price: 15000,
            currency: 'NGN',
            capacity: 800,
            soldCount: 540,
            perks: ['Keynote Sessions', 'Exhibition Hall Access', 'Conference Bag'],
          },
          {
            name: 'VIP Executive Pass',
            type: TicketTierType.VIP,
            price: 65000,
            currency: 'NGN',
            capacity: 200,
            soldCount: 165,
            perks: ['VIP Lounge', 'Speakers Dinner', 'Fast-Track Gate Entry', 'Priority Seating'],
          },
        ],
      },
    },
  });

  console.log(`✅ Seeded event: ${techSummit.title} (ID: ${techSummit.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
