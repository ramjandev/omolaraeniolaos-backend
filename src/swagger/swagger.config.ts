export const SWAGGER_TAGS = [
  {
    name: '00 Public / Authentication',
    description:
      '**Roles: ALL (public + any logged-in user)** — Login, register (Individual / Agency / Venue), refresh, password reset, `/auth/me`.',
  },
  {
    name: '00 Public / Catalog & Checkout',
    description:
      '**Roles: PUBLIC + GUEST** — Browse live events, ticket tiers, and complete checkout / digital pass purchase.',
  },
  {
    name: '00 Public / Payments',
    description:
      '**Roles: PUBLIC + ORGANIZERS** — Flutterwave TEST checkout, verify, and webhook. Used at signup and ticket pay.',
  },
  {
    name: '00 Public / Webhooks',
    description:
      '**Roles: PROVIDERS ONLY** — Meta WhatsApp verify/inbound and Flutterwave webhook. Not called by the frontend.',
  },
  {
    name: '01 Super Admin / Dashboard',
    description:
      '**Role: ADMIN** — Platform KPIs, organizer mix, revenue by type, active events.',
  },
  {
    name: '01 Super Admin / Organizers',
    description:
      '**Role: ADMIN** — List and inspect Individual, Agency, and Venue organizers.',
  },
  {
    name: '01 Super Admin / Analytics',
    description:
      '**Role: ADMIN** — Growth, events created, RSVP channel mix, check-in volume.',
  },
  {
    name: '01 Super Admin / Revenue',
    description:
      '**Role: ADMIN** — GMV, monthly breakdown, transactions.',
  },
  {
    name: '01 Super Admin / Plans',
    description:
      '**Roles: ADMIN (write) · PUBLIC (read for signup)** — Membership plans per organizer type.',
  },
  {
    name: '01 Super Admin / Settings',
    description:
      '**Role: ADMIN** — WhatsApp, Flutterwave, speech flags, connection tests.',
  },
  {
    name: '02 Individual Organizer / Dashboard',
    description:
      '**Role: INDIVIDUAL** (Agency/Venue JWT also works — data scoped to that user) — Home metrics, events, attendees.',
  },
  {
    name: '02 Individual Organizer / Events',
    description:
      '**Role: INDIVIDUAL** — Event wizard, guest roster, invites, seating, live check-in. Agency/Venue may call the same routes for their own events.',
  },
  {
    name: '02 Individual Organizer / Gate Crew',
    description:
      '**Role: INDIVIDUAL** — Invite and assign GATE to turnstiles.',
  },
  {
    name: '03 Agency Organizer / Workspace',
    description:
      '**Role: AGENCY** — Corporate clients and B2B invoices. Events: use `02 Individual Organizer / Events` with the agency JWT.',
  },
  {
    name: '04 Venue Organizer / Workspace',
    description:
      '**Role: VENUE** — Halls, bookings calendar, banquet tables. Events: use `02 Individual Organizer / Events` with the venue JWT.',
  },
  {
    name: '05 Gate Staff / Scanner',
    description:
      '**Role: GATE** — QR verify, offline sync, shifts. Admin and organizers may also call these routes.',
  },
  {
    name: '06 Guest / RSVP & Pass',
    description:
      '**Role: GUEST (public pass token)** — Load pass, submit RSVP, voice RSVP. No JWT required.',
  },
  {
    name: '07 Shared Organizer / Events',
    description:
      '**Roles: INDIVIDUAL · AGENCY · VENUE** — Shared create/publish event + public catalog reads.',
  },
  {
    name: '07 Shared Organizer / Tickets',
    description:
      '**Roles: ORGANIZERS (write) · PUBLIC (read)** — Ticket tiers on an event.',
  },
  {
    name: '07 Shared Organizer / Communications',
    description:
      '**Roles: INDIVIDUAL · AGENCY · VENUE** — Coordinated WhatsApp / SMS / email dispatch and threads.',
  },
] as const;

export const SWAGGER_TAG_GROUPS = [
  {
    name: '00 · Public',
    tags: [
      '00 Public / Authentication',
      '00 Public / Catalog & Checkout',
      '00 Public / Payments',
      '00 Public / Webhooks',
    ],
  },
  {
    name: '01 · Super Admin',
    tags: [
      '01 Super Admin / Dashboard',
      '01 Super Admin / Organizers',
      '01 Super Admin / Analytics',
      '01 Super Admin / Revenue',
      '01 Super Admin / Plans',
      '01 Super Admin / Settings',
    ],
  },
  {
    name: '02 · Individual Organizer',
    tags: [
      '02 Individual Organizer / Dashboard',
      '02 Individual Organizer / Events',
      '02 Individual Organizer / Gate Crew',
    ],
  },
  {
    name: '03 · Agency Organizer',
    tags: ['03 Agency Organizer / Workspace'],
  },
  {
    name: '04 · Venue Organizer',
    tags: ['04 Venue Organizer / Workspace'],
  },
  {
    name: '05 · Gate Staff',
    tags: ['05 Gate Staff / Scanner'],
  },
  {
    name: '06 · Guest',
    tags: ['06 Guest / RSVP & Pass'],
  },
  {
    name: '07 · Shared Organizer',
    tags: [
      '07 Shared Organizer / Events',
      '07 Shared Organizer / Tickets',
      '07 Shared Organizer / Communications',
    ],
  },
];

export const SWAGGER_DESCRIPTION = `
McEniesVite Event OS - six-role API. Tag folders on the left are grouped by role.

Roles
- ADMIN: folder 01 Super Admin
- INDIVIDUAL: folder 02 Individual + 07 Shared
- AGENCY: folder 03 Agency + 07 Shared (and Individual event routes with the agency JWT)
- VENUE: folder 04 Venue + 07 Shared (and Individual event routes with the venue JWT)
- GATE: folder 05 Gate Staff
- GUEST: folder 06 Guest (public pass, no JWT)

Auth
1. POST /api/auth/login
2. Click Authorize and paste: Bearer accessToken
3. JSON envelope: { statusCode, success, message, data }

Default admin
- ADMIN: admin@mceniesvite.com (created on first start from ADMIN_EMAIL / ADMIN_PASSWORD)

Every other account is created through the register endpoints. IDs are cuid strings.
`;
