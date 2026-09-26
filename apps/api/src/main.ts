import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';
import { validateRuntimeConfiguration } from './config/runtime-config.js';

async function bootstrap(): Promise<void> {
  validateRuntimeConfiguration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useStaticAssets(join(__dirname, '../uploads'), { prefix: '/uploads/' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`API Asesoría Inmobiliaria JB disponible en http://localhost:${port}/api`);
}

void bootstrap();
