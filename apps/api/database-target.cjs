const APP_DATABASE_SCHEMA = 'scolapro';
const TEST_SCHEMA_PREFIX = 'scolapro_test_';

function parseDatabaseUrl(value, label) {
  if (!value) throw new Error(`${label} must be configured.`);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL.`);
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${label} must use PostgreSQL.`);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!database) throw new Error(`${label} must name the application database.`);

  return { url, database };
}

function isTemporaryTestSchema(url) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const schema = url.searchParams.get('schema') ?? '';
  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
    && schema.startsWith(TEST_SCHEMA_PREFIX)
    && /^[a-z0-9_]+$/.test(schema);
}

function withApplicationSchema(url, keepLocalTestSchema = true) {
  if (!keepLocalTestSchema || !isTemporaryTestSchema(url)) {
    url.searchParams.set('schema', APP_DATABASE_SCHEMA);
  }
  return url.toString();
}

function resolveMigrationDatabaseUrls(environment) {
  const expectedDatabase = environment.SCOLARPRO_DATABASE_NAME ?? environment.POSTGRES_DB;
  if (!expectedDatabase) {
    throw new Error('POSTGRES_DB (or SCOLARPRO_DATABASE_NAME) must identify the application database before migrations can run.');
  }

  const application = parseDatabaseUrl(environment.DATABASE_URL, 'DATABASE_URL');
  if (!environment.DATABASE_URL_UNPOOLED && application.url.hostname.includes('-pooler')) {
    throw new Error('DATABASE_URL_UNPOOLED must be configured for migrations; pooled PostgreSQL URLs are not supported.');
  }
  const migration = parseDatabaseUrl(environment.DATABASE_URL_UNPOOLED || environment.DATABASE_URL, 'DATABASE_URL_UNPOOLED');
  if (migration.url.hostname.includes('-pooler')) {
    throw new Error('DATABASE_URL_UNPOOLED must use a direct PostgreSQL host for migrations.');
  }
  const applicationHost = application.url.hostname.replace(/-pooler(?=\.|$)/, '');
  if (applicationHost !== migration.url.hostname) {
    throw new Error('DATABASE_URL and DATABASE_URL_UNPOOLED must target the same PostgreSQL host.');
  }

  for (const [label, target] of [['DATABASE_URL', application], ['DATABASE_URL_UNPOOLED', migration]]) {
    if (target.database !== expectedDatabase) {
      throw new Error(`${label} targets database "${target.database}", but the configured application database is "${expectedDatabase}". Refusing to run migrations.`);
    }
  }

  return {
    applicationUrl: withApplicationSchema(application.url),
    migrationUrl: withApplicationSchema(migration.url),
    expectedDatabase,
  };
}

function resolveRuntimeDatabaseUrl(value, expectedDatabase) {
  const target = parseDatabaseUrl(value, 'DATABASE_URL');
  if (expectedDatabase && target.database !== expectedDatabase) {
    throw new Error(`DATABASE_URL targets database "${target.database}", but the configured application database is "${expectedDatabase}".`);
  }
  return withApplicationSchema(target.url);
}

module.exports = {
  APP_DATABASE_SCHEMA,
  parseDatabaseUrl,
  resolveMigrationDatabaseUrls,
  resolveRuntimeDatabaseUrl,
};
