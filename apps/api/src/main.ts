import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './database/prisma-exception.filter';

config();
config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../../.env.local'), override: true });

function normalizeOrigin(origin: string) {
  return origin.replace(/\/$/, '');
}

function isAllowedLocalOrigin(origin: string | undefined) {
  if (!origin) return true;

  const configuredOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map((value) => normalizeOrigin(value.trim())).filter(Boolean);
  const normalizedOrigin = normalizeOrigin(origin);

  if (configuredOrigins.includes(normalizedOrigin)) return true;

  try {
    const { hostname, port } = new URL(normalizedOrigin);
    const host = hostname.toLowerCase();
    const isTemporaryTunnelHost = host.endsWith('.trycloudflare.com');
    const isPrivateLanHost = host === 'localhost' || host === '127.0.0.1' || host === '::1'
      || host.startsWith('10.')
      || host.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      || /^((?:[a-z0-9-]+\.)?local)$/i.test(host);

    return (isTemporaryTunnelHost || isPrivateLanHost) && /^https?:\/\//.test(normalizedOrigin) && (!!port || normalizedOrigin.startsWith('https://'));
  } catch {
    return false;
  }
}

async function createApp() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET doit être défini avec au moins 32 caractères dans le fichier .env.');
  }
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isAllowedLocalOrigin(origin));
    },
  });
  return app;
}

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  appPromise ??= createApp();
  const app = await appPromise;
  await app.init();
  return app.getHttpAdapter().getInstance()(request, response);
}

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`CSP API listening on http://localhost:${port}/api/v1`);
}

if (process.env.VERCEL !== '1') void bootstrap();
