import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import { getHttpCorsOptions } from './config/cors';

function validateProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return;

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres em produção.');
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL é obrigatória em produção.');
  try {
    const url = new URL(databaseUrl);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      !url.password ||
      url.pathname === '/'
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('DATABASE_URL deve ser uma URL PostgreSQL completa e válida.');
  }

  const hasVapidPublicKey = Boolean(process.env.VAPID_PUBLIC_KEY?.trim());
  const hasVapidPrivateKey = Boolean(process.env.VAPID_PRIVATE_KEY?.trim());
  if (hasVapidPublicKey !== hasVapidPrivateKey) {
    throw new Error('VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY devem ser configuradas juntas.');
  }
}

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  validateProductionConfiguration();

  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um número entre 1 e 65535.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads',
    setHeaders: res => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
    disableErrorMessages: isProduction,
  }));
  app.enableCors(getHttpCorsOptions());

  await app.listen(port);
  console.log(`Backend rodando na porta ${port}`);
}

bootstrap();
