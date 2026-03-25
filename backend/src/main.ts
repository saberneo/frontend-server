import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Security headers (CSP, X-Frame-Options, X-Content-Type-Options, …)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // allow Swagger UI
    }),
  );

  // ── Cookie parser (needed for httpOnly JWT extraction)
  app.use(cookieParser());

  // ── Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ── Global exception filter (uniform JSON error responses)
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── CORS — supporte plusieurs origines (liste séparée par virgule dans CORS_ORIGIN)
  // Dev:     CORS_ORIGIN=http://localhost:4200
  // Staging: CORS_ORIGIN=https://staging.nexus.votredomaine.com
  // Prod:     CORS_ORIGIN=https://nexus.votredomaine.com,https://app.nexus.votredomaine.com
  const rawOrigins = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, Swagger UI)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-ID', 'X-Okta-Token'],
  });

  // ── Global API prefix
  app.setGlobalPrefix('api/v1');

  // ── Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('NEXUS Platform API')
    .setDescription('REST API for the NEXUS data integration platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('nexus_token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`\n🚀 NEXUS API running at http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs\n`);
}

bootstrap();
