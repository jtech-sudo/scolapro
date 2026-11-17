import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

config({ path: resolve(__dirname, '../../.env') });
config({
  path: process.env.PRISMA_ENV_FILE ?? resolve(__dirname, '../../.env.local'),
  override: true,
});
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;

const { resolveMigrationDatabaseUrls } = require('./database-target.cjs') as {
  resolveMigrationDatabaseUrls: (environment: NodeJS.ProcessEnv) => {
    migrationUrl: string;
  };
};
const databaseTargets = resolveMigrationDatabaseUrls(process.env);
process.env.DATABASE_URL = databaseTargets.applicationUrl;
process.env.DATABASE_URL_UNPOOLED = databaseTargets.migrationUrl;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: databaseTargets.migrationUrl },
});