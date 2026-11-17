const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must point to a local PostgreSQL database.');

const baseUrl = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
  throw new Error('Integration tests only run against a local PostgreSQL database.');
}

const schema = `scolapro_test_${randomUUID().replaceAll('-', '')}`;
const testUrl = new URL(baseUrl);
testUrl.searchParams.set('schema', schema);
const prisma = new (require('@prisma/client').PrismaClient)();
const workspace = path.resolve(__dirname, '..');
let schemaCreated = false;

function run(command, args, environment) {
  const result = spawnSync(command, args, { cwd: workspace, env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}.`);
}

async function main() {
  try {
    const [privileges] = await prisma.$queryRaw`SELECT has_database_privilege(current_user, current_database(), $q$CREATE$q$) AS can_create_schema`;
    if (!privileges.can_create_schema) throw new Error('The local PostgreSQL role needs CREATE privilege to run isolated integration tests.');

    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;

    const environment = { ...process.env, DATABASE_URL: testUrl.toString(), DATABASE_URL_TEST: testUrl.toString() };
    run('npm', ['run', 'prisma:db:push', '--', '--schema', 'prisma/schema.prisma', '--skip-generate'], environment);
    run(process.execPath, ['--test', 'test/tenant-isolation.test.cjs', 'test/multi-school-api.test.cjs'], environment);
  } finally {
    if (schemaCreated) await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});