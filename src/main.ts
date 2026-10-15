import './shim';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import {
  SWAGGER_DESCRIPTION,
  SWAGGER_TAG_GROUPS,
  SWAGGER_TAGS,
} from './swagger/swagger.config';

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
  const swaggerBuilder = new DocumentBuilder()
    .setTitle('McEniesVite Event OS API')
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion('1.1.0')
    .addBearerAuth();

  for (const tag of SWAGGER_TAGS) {
    swaggerBuilder.addTag(tag.name, tag.description);
  }

  const swaggerConfig = swaggerBuilder.build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  (document as { 'x-tagGroups'?: typeof SWAGGER_TAG_GROUPS })['x-tagGroups'] =
    SWAGGER_TAG_GROUPS;

  const swaggerUi = {
    customSiteTitle: 'McEniesVite API - six roles',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  };

  SwaggerModule.setup('api/docs', app, document, swaggerUi);
  SwaggerModule.setup('docs', app, document, swaggerUi);

  const PORT = Number(process.env.PORT) || 5000;

  await app.listen(PORT, '0.0.0.0');

  console.log(`=================================================`);
  console.log(`🚀 NestJS McEniesVite Platform Backend Running`);
  console.log(`📡 Base URL: http://localhost:${PORT}/api`);
  console.log(`📖 Swagger API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`=================================================`);
}

bootstrap();
