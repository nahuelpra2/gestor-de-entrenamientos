import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- Seguridad HTTP ---
  // Helmet agrega headers de seguridad críticos:
  //   X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security,
  //   Content-Security-Policy, Referrer-Policy, etc.
  app.use(helmet());

  // --- CORS ---
  // En producción debe configurarse con los dominios exactos del dashboard web.
  // Para la app móvil, CORS no aplica (las apps nativas no usan el mecanismo CORS del browser).
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? allowedOrigins.length > 0
          ? allowedOrigins
          : false
        : '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });

  // --- Prefijo global de versión ---
  app.setGlobalPrefix('v1');

  // --- Validación global de DTOs ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // --- Filtro global de excepciones ---
  app.useGlobalFilters(new AllExceptionsFilter());

  // --- Swagger UI (solo en desarrollo) ---
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Trainr API')
      .setDescription('API para gestión de entrenamiento')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 API corriendo en http://localhost:${port}/v1`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📚 Swagger en http://localhost:${port}/api/docs`);
  }
}
bootstrap();
