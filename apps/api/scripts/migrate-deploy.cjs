const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const {
  APP_DATABASE_SCHEMA,
  resolveMigrationDatabaseUrls,
} = require('../database-target.cjs');

const workspace = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(workspace, '../../.env') });
dotenv.config({
  path: process.env.PRISMA_ENV_FILE ?? path.resolve(workspace, '../../.env.local'),
  override: true,
});

const targets = resolveMigrationDatabaseUrls(process.env);
process.env.DATABASE_URL = targets.applicationUrl;
process.env.DATABASE_URL_UNPOOLED = targets.migrationUrl;

const prismaCli = require.resolve('prisma/build/index.js', { paths: [workspace] });
const migrationsPath = path.resolve(workspace, 'prisma/migrations');

function migrationObjects() {
  const directories = fs.readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const tables = new Set();
  const enums = new Set();

  for (const directory of directories) {
    const sql = fs.readFileSync(path.join(migrationsPath, directory, 'migration.sql'), 'utf8');
    for (const [, name] of sql.matchAll(/CREATE TABLE\s+"([^"]+)"/g)) tables.add(name);
    for (const [, name] of sql.matchAll(/CREATE TYPE\s+"([^"]+)"/g)) enums.add(name);
  }

  return { directories, tables: [...tables], enums: [...enums] };
}

function getAppliedMigrationNames(history, directories, schemaName) {
  if (history.some((row) => !row.finished_at && !row.rolled_back_at)) {
    throw new Error(`Schema "${schemaName}" contains an unfinished migration; resolve it before deploying.`);
  }

  const recorded = new Set(history.map((row) => row.migration_name));
  const unknown = [...recorded].filter((name) => !directories.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Schema "${schemaName}" contains migrations not present in this checkout (${unknown.join(', ')}).`);
  }

  const applied = new Set(
    history.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name),
  );
  const appliedInOrder = directories.filter((name) => applied.has(name));
  if (appliedInOrder.some((name, index) => directories[index] !== name)) {
    throw new Error(`Schema "${schemaName}" has an out-of-order Prisma migration history.`);
  }
  return applied;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function runPrisma(args, extraEnvironment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prismaCli, ...args], {
      cwd: workspace,
      env: { ...process.env, ...extraEnvironment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function prepareApplicationSchema() {
  const client = new PrismaClient({ datasourceUrl: targets.migrationUrl });
  const { directories, tables, enums } = migrationObjects();

  try {
    await client.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`${APP_DATABASE_SCHEMA}:schema-bootstrap`}, 0)) IS NULL AS locked
      `;
      const [database] = await transaction.$queryRaw`SELECT current_database() AS database_name`;
      if (database.database_name !== targets.expectedDatabase) {
        throw new Error(`Connected to database "${database.database_name}" instead of the configured application database "${targets.expectedDatabase}".`);
      }

      await transaction.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(APP_DATABASE_SCHEMA)}`);

      const appSchemaTables = await transaction.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${APP_DATABASE_SCHEMA} AND table_type = 'BASE TABLE'
      `;
      const appTables = new Set(appSchemaTables.map((row) => row.table_name));
      const appRelationRows = await transaction.$queryRaw`
        SELECT relation.relname AS relation_name
        FROM pg_class AS relation
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = ${APP_DATABASE_SCHEMA}
          AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      `;
      const appRelations = new Set(appRelationRows.map((row) => row.relation_name));
      const appSchemaEnumRows = await transaction.$queryRaw`
        SELECT type.typname AS type_name
        FROM pg_type AS type
        JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
        WHERE namespace.nspname = ${APP_DATABASE_SCHEMA} AND type.typtype = 'e'
      `;
      const appEnums = new Set(appSchemaEnumRows.map((row) => row.type_name));

      if (appRelations.size > 0 || appEnums.size > 0) {
        if (!appTables.has('_prisma_migrations')) {
          throw new Error(`Schema "${APP_DATABASE_SCHEMA}" contains objects but no Prisma migration history; refusing to continue.`);
        }
        const appHistory = await transaction.$queryRawUnsafe(
          `SELECT migration_name, finished_at, rolled_back_at FROM ${quoteIdentifier(APP_DATABASE_SCHEMA)}."_prisma_migrations"`,
        );
        const appliedNames = getAppliedMigrationNames(appHistory, directories, APP_DATABASE_SCHEMA);
        const appliedTables = new Set();
        const appliedEnums = new Set();
        for (const directory of directories.filter((name) => appliedNames.has(name))) {
          const sql = fs.readFileSync(path.join(migrationsPath, directory, 'migration.sql'), 'utf8');
          for (const [, name] of sql.matchAll(/CREATE TABLE\s+"([^"]+)"/g)) appliedTables.add(name);
          for (const [, name] of sql.matchAll(/CREATE TYPE\s+"([^"]+)"/g)) appliedEnums.add(name);
        }
        const missingTables = [...appliedTables].filter((name) => !appTables.has(name));
        const missingEnums = [...appliedEnums].filter((name) => !appEnums.has(name));
        const untrackedRelations = [...appRelations].filter((name) => name !== '_prisma_migrations' && !appliedTables.has(name));
        if (missingTables.length > 0 || missingEnums.length > 0 || untrackedRelations.length > 0) {
          throw new Error(`Schema "${APP_DATABASE_SCHEMA}" is incomplete or inconsistent (missing tables: ${missingTables.join(', ') || 'none'}; missing enums: ${missingEnums.join(', ') || 'none'}; untracked relations: ${untrackedRelations.join(', ') || 'none'}).`);
        }

        const publicTableRows = await transaction.$queryRaw`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `;
        const publicTableNames = new Set(publicTableRows.map((row) => row.table_name));
        const duplicatedLegacyTables = tables.filter((name) => publicTableNames.has(name));
        let publicHistoryHasAppMigrations = false;
        if (publicTableNames.has('_prisma_migrations')) {
          const publicHistory = await transaction.$queryRawUnsafe(
            'SELECT migration_name FROM public."_prisma_migrations"',
          );
          publicHistoryHasAppMigrations = publicHistory.some((row) => directories.includes(row.migration_name));
        }
        if (duplicatedLegacyTables.length > 0 || publicHistoryHasAppMigrations) {
          throw new Error(`The app schema is initialized while legacy ScolaPro tables or migration history remain in public; refusing to leave the app pointed at an empty or split data set.`);
        }
        return;
      }

      const publicTables = await transaction.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `;
      const publicTableNames = new Set(publicTables.map((row) => row.table_name));
      const legacyModelTables = tables.filter((name) => publicTableNames.has(name));
      const hasLegacyMigrationHistory = publicTableNames.has('_prisma_migrations');

      if (legacyModelTables.length === 0 && !hasLegacyMigrationHistory) return;
      if (!hasLegacyMigrationHistory) {
        throw new Error('Found application tables in public without Prisma migration history; refusing an unsafe schema cutover.');
      }

      const history = await transaction.$queryRawUnsafe(
        'SELECT migration_name, finished_at, rolled_back_at FROM public."_prisma_migrations"',
      );
      if (history.length === 0 && legacyModelTables.length === 0) return;
      const appliedMigrations = getAppliedMigrationNames(history, directories, 'public');

      const appliedFiles = directories.filter((name) => appliedMigrations.has(name));
      const appliedObjects = new Set();
      const appliedEnums = new Set();
      for (const directory of appliedFiles) {
        const sql = fs.readFileSync(path.join(migrationsPath, directory, 'migration.sql'), 'utf8');
        for (const [, name] of sql.matchAll(/CREATE TABLE\s+"([^"]+)"/g)) appliedObjects.add(name);
        for (const [, name] of sql.matchAll(/CREATE TYPE\s+"([^"]+)"/g)) appliedEnums.add(name);
      }

      const missingTables = [...appliedObjects].filter((name) => !publicTableNames.has(name));
      const untrackedTables = legacyModelTables.filter((name) => !appliedObjects.has(name));
      const publicEnumRows = await transaction.$queryRaw`
        SELECT type.typname AS type_name
        FROM pg_type AS type
        JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
        WHERE namespace.nspname = 'public' AND type.typtype = 'e'
      `;
      const publicEnums = new Set(publicEnumRows.map((row) => row.type_name));
      const missingEnums = [...appliedEnums].filter((name) => !publicEnums.has(name));
      if (missingTables.length > 0 || missingEnums.length > 0 || untrackedTables.length > 0) {
        throw new Error(`The public schema is incomplete or inconsistent (missing tables: ${missingTables.join(', ') || 'none'}; missing enums: ${missingEnums.join(', ') || 'none'}; untracked tables: ${untrackedTables.join(', ') || 'none'}). Refusing to move it.`);
      }

      const appObjects = await transaction.$queryRaw`
        SELECT relation.relname AS object_name
        FROM pg_class AS relation
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = ${APP_DATABASE_SCHEMA}
          AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
        UNION ALL
        SELECT type.typname AS object_name
        FROM pg_type AS type
        JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
        WHERE namespace.nspname = ${APP_DATABASE_SCHEMA}
      `;
      if (appObjects.length > 0) {
        throw new Error(`Schema "${APP_DATABASE_SCHEMA}" is not empty but has no application tables; refusing to merge unrelated objects.`);
      }

      for (const name of appliedEnums) {
        await transaction.$executeRawUnsafe(
          `ALTER TYPE ${quoteIdentifier('public')}.${quoteIdentifier(name)} SET SCHEMA ${quoteIdentifier(APP_DATABASE_SCHEMA)}`,
        );
      }
      for (const name of appliedObjects) {
        await transaction.$executeRawUnsafe(
          `ALTER TABLE ${quoteIdentifier('public')}.${quoteIdentifier(name)} SET SCHEMA ${quoteIdentifier(APP_DATABASE_SCHEMA)}`,
        );
      }
      await transaction.$executeRawUnsafe(
        `ALTER TABLE ${quoteIdentifier('public')}."_prisma_migrations" SET SCHEMA ${quoteIdentifier(APP_DATABASE_SCHEMA)}`,
      );

      console.log(`Moved ${appliedObjects.size} tables, ${appliedEnums.size} enum types, and Prisma migration history into "${APP_DATABASE_SCHEMA}".`);
    }, { maxWait: 60_000, timeout: 10 * 60_000 });
  } finally {
    await client.$disconnect();
  }
}

async function migrateAndVerify() {
  const client = new PrismaClient({ datasourceUrl: targets.migrationUrl });
  try {
    await client.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`${APP_DATABASE_SCHEMA}:prisma-migrate`}, 0)) IS NULL AS locked
      `;
      const migration = await runPrisma(
        ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
        { PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1' },
      );
      if (migration.status !== 0) {
        throw new Error(`Prisma migrate deploy failed with status ${migration.status ?? 'unknown'}.`);
      }

      const diff = await runPrisma([
        'migrate',
        'diff',
        '--from-schema-datasource',
        'prisma/schema.prisma',
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--exit-code',
      ]);
      if (diff.status === 2) {
        const details = await runPrisma([
          'migrate',
          'diff',
          '--from-schema-datasource',
          'prisma/schema.prisma',
          '--to-schema-datamodel',
          'prisma/schema.prisma',
        ]);
        if (details.status !== 0) {
          throw new Error(`Unable to describe the schema diff (status ${details.status ?? 'unknown'}).`);
        }
        throw new Error('Migration history applied, but the live app schema differs from the Prisma datamodel.');
      }
      if (diff.status !== 0) {
        throw new Error(`Post-migration schema verification failed with status ${diff.status ?? 'unknown'}.`);
      }
    }, { maxWait: 60_000, timeout: 30 * 60_000 });
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  await prepareApplicationSchema();
  await migrateAndVerify();
  console.log(`Verified Prisma schema against database "${targets.expectedDatabase}" in schema "${APP_DATABASE_SCHEMA}".`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
