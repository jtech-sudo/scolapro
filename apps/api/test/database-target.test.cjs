const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  APP_DATABASE_SCHEMA,
  resolveMigrationDatabaseUrls,
  resolveRuntimeDatabaseUrl,
} = require('../database-target.cjs');

test('migration URLs target the configured application database and schema', () => {
  const urls = resolveMigrationDatabaseUrls({
    POSTGRES_DB: 'scolapro',
    DATABASE_URL: 'postgresql://app:secret@db:5432/scolapro',
    DATABASE_URL_UNPOOLED: '',
  });

  assert.equal(new URL(urls.applicationUrl).searchParams.get('schema'), APP_DATABASE_SCHEMA);
  assert.equal(new URL(urls.migrationUrl).searchParams.get('schema'), APP_DATABASE_SCHEMA);
  assert.equal(urls.expectedDatabase, 'scolapro');
});

test('migrations refuse a URL for a different database', () => {
  assert.throws(() => resolveMigrationDatabaseUrls({
    POSTGRES_DB: 'scolapro',
    DATABASE_URL: 'postgresql://app:secret@db:5432/other',
  }), /Refusing to run migrations/);
});

test('migrations require a direct URL for the same database host', () => {
  assert.throws(() => resolveMigrationDatabaseUrls({
    POSTGRES_DB: 'scolapro',
    DATABASE_URL: 'postgresql://app:secret@db:5432/scolapro',
    DATABASE_URL_UNPOOLED: 'postgresql://app:secret@other-db:5432/scolapro',
  }), /same PostgreSQL host/);
});

test('runtime preserves only explicitly isolated local test schemas', () => {
  const testUrl = resolveRuntimeDatabaseUrl(
    'postgresql://app:secret@localhost:5432/scolapro?schema=scolapro_test_1234',
    'scolapro',
  );
  const appUrl = resolveRuntimeDatabaseUrl(
    'postgresql://app:secret@db:5432/scolapro?schema=public',
    'scolapro',
  );

  assert.equal(new URL(testUrl).searchParams.get('schema'), 'scolapro_test_1234');
  assert.equal(new URL(appUrl).searchParams.get('schema'), APP_DATABASE_SCHEMA);
});

test('ordered migrations create every model and enum in the app schema', () => {
  const workspace = path.resolve(__dirname, '..');
  const schema = fs.readFileSync(path.join(workspace, 'prisma/schema.prisma'), 'utf8');
  const migrationRoot = path.join(workspace, 'prisma/migrations');
  const migrations = fs.readdirSync(migrationRoot)
    .filter((name) => fs.statSync(path.join(migrationRoot, name)).isDirectory())
    .sort();
  const modelNames = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const enumNames = [...schema.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const migratedTables = new Set();
  const migratedEnums = new Set();

  const migrationTimestamps = migrations.map((migration) => migration.match(/^(\d{14})_/)?.[1]);
  assert.ok(migrationTimestamps.every(Boolean), 'migration directories must start with an ordered timestamp');
  assert.deepEqual(migrationTimestamps, [...migrationTimestamps].sort());
  assert.equal(new Set(migrationTimestamps).size, migrationTimestamps.length, 'migration timestamps must be unique');
  for (const [, name, body] of [...modelNames, ...enumNames]) {
    assert.match(body, /@@schema\("scolapro"\)/, `${name} must be mapped to the app schema`);
  }
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(migrationRoot, migration, 'migration.sql'), 'utf8');
    for (const [, name] of sql.matchAll(/CREATE TABLE\s+"([^"]+)"/g)) migratedTables.add(name);
    for (const [, name] of sql.matchAll(/CREATE TYPE\s+"([^"]+)"/g)) migratedEnums.add(name);
  }

  assert.deepEqual(
    [...modelNames.map(([, name]) => name)].filter((name) => !migratedTables.has(name)),
    [],
    'every Prisma model must have a versioned table migration',
  );
  assert.deepEqual(
    [...enumNames.map(([, name]) => name)].filter((name) => !migratedEnums.has(name)),
    [],
    'every Prisma enum must have a versioned type migration',
  );
});
