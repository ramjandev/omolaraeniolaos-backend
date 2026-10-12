import './shim';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API Prefix
  app.setGlobalPrefix('api');

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global DTO Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global Response Transform Interceptor
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new TransformInterceptor(reflector));

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('McEniesVite Event Management OS API')
    .setDescription(
      `
### Enterprise NestJS Event Management Platform
Architecture for all 6 ecosystem roles:
- **Organizer (Individual)**: Multi-step registration, events catalog, ticket tier pricing, attendee management, and broadcasts.
- **Organizer (Agency)**: Workspace setup, corporate retainer accounts, production crew assignments, and B2B billing.
- **Organizer (Venue)**: Hospitality profile, spaces leasing, bookings calendar, and banquet table layouts.
- **Gate Staff**: High-concurrency QR scanner validation and shift logs.
- **Guest**: Attendee passes, session schedules, and profile.
- **Super Admin**: Ecosystem telemetry matching Figma dashboard (142 Organizers, 847 Events, ₦4.2M Revenue).

---

### 🔑 Demo Credentials (Password for ALL accounts: \`Password123!\`)

| # | Role | Email |
|---|------|-------|
| 1 | SUPER_ADMIN | admin@mceniesvite.com |
| 2 | ORGANIZER_INDIVIDUAL | individual@mceniesvite.com |
| 3 | ORGANIZER_AGENCY | agency@mceniesvite.com |
| 4 | ORGANIZER_VENUE | venue@mceniesvite.com |
| 5 | GATE_STAFF | gatestaff@mceniesvite.com |
| 6 | GUEST | guest@mceniesvite.com |
      `,
    )
    .setVersion('1.0.0')
    .addTag(
      'Individual - Dashboard',
      'Dashboard telemetry, setup checklist, and live guest activities for Individual Organizers',
    )
    .addTag(
      'Individual - Events',
      'Events lifecycle, 6-step setup, guest roster & RSVP, table seating blueprint, and live turnstile monitor for Individual Organizers',
    )
    .addTag(
      'Individual - Gate Management',
      'Dedicated Gate Staff management, assignment, and invitation for Individual Organizers',
    )
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'McEniesVite API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });

  // Secondary convenient route
  SwaggerModule.setup('docs', app, document);

  const PORT = Number(process.env.PORT) || 5000;

  await app.listen(PORT, '0.0.0.0');

  console.log(`=================================================`);
  console.log(`🚀 NestJS McEniesVite Platform Backend Running`);
  console.log(`📡 Base URL: http://localhost:${PORT}/api`);
  console.log(`📖 Swagger API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`=================================================`);
}

bootstrap();
