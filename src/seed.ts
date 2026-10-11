import { PrismaClient, UserRole, UserStatus, EventFormat, EventStatus, TicketTierType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding 6 core role accounts with password: Password123! ...');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  // 1. Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mceniesvite.com' },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.SUPER_ADMIN,
    },
    create: {
      email: 'admin@mceniesvite.com',
      passwordHash,
      fullName: 'Super Administrator',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          bio: 'Platform administrator with unrestricted global access.',
          company: 'McEniesVite Core Team',
        },
      },
    },
  });
  console.log(`✅ 1. SUPER_ADMIN: ${admin.email}`);

  // 2. Individual Organizer
  const individual = await prisma.user.upsert({
    where: { email: 'individual@mceniesvite.com' },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.ORGANIZER_INDIVIDUAL,
    },
    create: {
      email: 'individual@mceniesvite.com',
      passwordHash,
      fullName: 'James Obi (Individual Host)',
      phone: '+2348012345678',
      role: UserRole.ORGANIZER_INDIVIDUAL,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          bio: 'Independent curator & private gala host.',
          company: 'Lagos Private Galas',
        },
      },
    },
  });
  console.log(`✅ 2. ORGANIZER_INDIVIDUAL: ${individual.email}`);

  // 3. Agency Organizer
  const agencyUser = await prisma.user.upsert({
    where: { email: 'agency@mceniesvite.com' },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.ORGANIZER_AGENCY,
    },
    create: {
      email: 'agency@mceniesvite.com',
      passwordHash,
      fullName: 'Adebayo Ogunlesi (Agency Director)',
      phone: '+2348023456789',
      role: UserRole.ORGANIZER_AGENCY,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          bio: 'Full-service luxury event management and production agency.',
          company: 'Lumina Event Studio',
        },
      },
      agencyProfile: {
        create: {
          agencyName: 'Lumina Event Studio',
          billingEmail: 'agency@mceniesvite.com',
          headquarters: 'Victoria Island, Lagos, Nigeria',
          standardCommission: 15.0,
        },
      },
    },
  });
  console.log(`✅ 3. ORGANIZER_AGENCY: ${agencyUser.email}`);

  // 4. Venue Organizer
  const venueUser = await prisma.user.upsert({
    where: { email: 'venue@mceniesvite.com' },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.ORGANIZER_VENUE,
    },
    create: {
      email: 'venue@mceniesvite.com',
      passwordHash,
      fullName: 'Folake Adeleke (Venue Manager)',
      phone: '+2348034567890',
      role: UserRole.ORGANIZER_VENUE,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          bio: 'General Manager of The Monarch Event Centre & Grand Palaces.',
          company: 'The Monarch Event Centre',
        },
      },
      venueProfile: {
        create: {
          propertyName: 'The Monarch Event Centre',
          address: 'Plot 10, Lekki-Epe Expressway, Lekki Phase 1',
          city: 'Lagos',
          country: 'Nigeria',
          compoundCapacity: 2500,
          spaces: {
            create: [
              {
                name: 'Imperial Ballroom',
                capacity: 1500,
                squareMeters: 2250,
                dailyRate: 0,
                currency: 'NGN',
              },
            ],
          },
        },
      },
    },
  });
  console.log(`✅ 4. ORGANIZER_VENUE: ${venueUser.email}`);

  // 5. Gate Staff
  const gateStaff = await prisma.user.upsert({
    where: { email: 'gatestaff@mceniesvite.com' },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.GATE_STAFF,
    },
    create: {
      email: 'gatestaff@mceniesvite.com',
      passwordHash,
      fullName: 'Chidi Okonkwo (Gate Lead)',
      phone: '+2348045678901',
      role: UserRole.GATE_STAFF,
      status: UserStatus.ACTIVE,
      staffProfile: {
        create: {
          gateCode: 'GATE-A1',
        },
      },
    },
  });
  console.log(`✅ 5. GATE_STAFF: ${gateStaff.email}`);

  // 6. Guest
  const guest = await prisma.user.upsert({
    where: { email: 'guest@mceniesvite.com' },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.GUEST,
    },
    create: {
      email: 'guest@mceniesvite.com',
      passwordHash,
      fullName: 'Amara Nwosu (Attendee Guest)',
      phone: '+2348056789012',
      role: UserRole.GUEST,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          dietaryPreference: 'Halal',
        },
      },
    },
  });
  console.log(`✅ 6. GUEST: ${guest.email}`);

  // Also ensure alias 'organizer@mceniesvite.com' exists
  await prisma.user.upsert({
    where: { email: 'organizer@mceniesvite.com' },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.ORGANIZER_INDIVIDUAL,
    },
    create: {
      email: 'organizer@mceniesvite.com',
      passwordHash,
      fullName: 'Omolara Eniola',
      phone: '+2348019998888',
      role: UserRole.ORGANIZER_INDIVIDUAL,
      status: UserStatus.ACTIVE,
    },
  });

  console.log('\n🎉 Successfully seeded all 6 roles with password: Password123!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
