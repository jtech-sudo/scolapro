import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

config({ path: resolve(__dirname, '../../.env') });
config({
  path: process.env.PRISMA_ENV_FILE ?? resolve(__dirname, '../../.env.local'),
  override: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? env('DATABASE_URL') },
});