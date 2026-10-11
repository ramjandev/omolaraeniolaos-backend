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
Architecture for all 6 ecosystem roles.

📄 **Official Credentials Document:** [Google Docs Reference](https://docs.google.com/document/d/1RhHT8c7qz3l7zh96C8yNxbmgeH9aD1DpCPYUfzcpy5E/edit?tab=t.0)

---

### 1. Demo Account Credentials
The following demo accounts are available for testing the different user roles within the McEniesVite Event Management Platform:

* **Account 1: Super Administrator**
  * **User Role:** \`SUPER_ADMIN\`
  * **Email:** [admin@mceniesvite.com](mailto:admin@mceniesvite.com)
  * **Password:** \`Password123!\`

* **Account 2: Individual Organizer**
  * **User Role:** \`ORGANIZER_INDIVIDUAL\`
  * **Email:** [individual@mceniesvite.com](mailto:individual@mceniesvite.com)
  * **Password:** \`Password123!\`

* **Account 3: Agency Organizer**
  * **User Role:** \`ORGANIZER_AGENCY\`
  * **Email:** [agency@mceniesvite.com](mailto:agency@mceniesvite.com)
  * **Password:** \`Password123!\`

* **Account 4: Venue Organizer**
  * **User Role:** \`ORGANIZER_VENUE\`
  * **Email:** [venue@mceniesvite.com](mailto:venue@mceniesvite.com)
  * **Password:** \`Password123!\`

* **Account 5: Gate Staff**
  * **User Role:** \`GATE_STAFF\`
  * **Email:** [gatestaff@mceniesvite.com](mailto:gatestaff@mceniesvite.com)
  * **Password:** \`Password123!\`

* **Account 6: Guest / Attendee**
  * **User Role:** \`GUEST\`
  * **Email:** [guest@mceniesvite.com](mailto:guest@mceniesvite.com)
  * **Password:** \`Password123!\`

* **Additional Login Option — Individual Organizer**
  * **Email:** [organizer@mceniesvite.com](mailto:organizer@mceniesvite.com)
  * **Password:** \`Password123!\`
  * **User Role:** \`ORGANIZER_INDIVIDUAL\`

> **Note:** All accounts use the same demo password (\`Password123!\`) and are intended for authorized client demonstrations and testing only.
      `,
    )
    .setVersion('1.0.0')
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
