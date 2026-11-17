const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { createServer } = require('node:net');
const path = require('node:path');
const { test } = require('node:test');

const databaseUrl = process.env.DATABASE_URL_TEST;

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function requestJson(url, { method = 'GET', token, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

test('school login, list and switch preserve tenant isolation through the API', { skip: !databaseUrl && 'Set DATABASE_URL_TEST to an isolated local test schema.' }, async () => {
  const testUrl = new URL(databaseUrl);
  const schema = testUrl.searchParams.get('schema');
  if (!['localhost', '127.0.0.1', '::1'].includes(testUrl.hostname) || !schema?.startsWith('scolapro_test_')) {
    throw new Error('DATABASE_URL_TEST must use localhost and a temporary scolapro_test_* schema.');
  }

  process.env.DATABASE_URL = databaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient();
  const workspace = path.resolve(__dirname, '..');
  const password = 'TestPassword123!';
  const email = `multi-school-${randomUUID()}@example.test`;
  const schoolA = await prisma.school.create({ data: { name: 'École API test A', slug: `api-test-a-${randomUUID()}` } });
  const schoolB = await prisma.school.create({ data: { name: 'École API test B', slug: `api-test-b-${randomUUID()}` } });
  const suffix = randomUUID();
  const schoolYearA = await prisma.schoolYear.create({
    data: { schoolId: schoolA.id, name: `2026-A-${suffix}`, startsOn: new Date('2026-01-01'), endsOn: new Date('2026-12-31') },
  });
  const schoolYearB = await prisma.schoolYear.create({
    data: { schoolId: schoolB.id, name: `2026-B-${suffix}`, startsOn: new Date('2026-01-01'), endsOn: new Date('2026-12-31') },
  });
  const levelB = await prisma.level.create({ data: { schoolId: schoolB.id, name: `Niveau-${suffix}`, type: 'PRIMARY', sortOrder: 1 } });
  const classB = await prisma.schoolClass.create({
    data: { schoolId: schoolB.id, name: `Classe-${suffix}`, levelId: levelB.id, schoolYearId: schoolYearB.id },
  });
  const user = await prisma.user.create({
    data: {
      fullName: 'Compte de test multi-école',
      email,
      passwordHash: await bcrypt.hash(password, 4),
      role: 'ADMIN',
    },
  });
  await prisma.schoolMembership.createMany({
    data: [schoolA, schoolB].map((school) => ({ schoolId: school.id, userId: user.id, role: 'ADMIN' })),
  });
  await prisma.schoolProfile.create({ data: { schoolId: schoolA.id, name: 'Profil école API A' } });
  await prisma.schoolProfile.create({ data: { schoolId: schoolB.id, name: 'Profil école API B' } });
  const studentA = await prisma.student.create({ data: { schoolId: schoolA.id, matricule: `API-A-${randomUUID()}`, firstName: 'Élève', lastName: 'ÉcoleA' } });
  await prisma.student.create({ data: { schoolId: schoolB.id, matricule: `API-B-${randomUUID()}`, firstName: 'Élève', lastName: 'ÉcoleB' } });

  const port = await reservePort();
  let apiOutput = '';
  const api = spawn(process.execPath, ['dist/main.js'], {
    cwd: workspace,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      API_PORT: String(port),
      JWT_SECRET: randomBytes(48).toString('hex'),
      PLATFORM_ADMIN_BOOTSTRAP_KEY: randomBytes(48).toString('hex'),
      WEB_ORIGIN: `http://127.0.0.1:${port}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout.on('data', (data) => { apiOutput += data.toString(); });
  api.stderr.on('data', (data) => { apiOutput += data.toString(); });

  try {
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const deadline = Date.now() + 20_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (api.exitCode !== null) throw new Error(`Test API exited early. ${apiOutput}`);
      try {
        const response = await fetch(`${baseUrl}/health/ready`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    assert.equal(ready, true, `Test API did not become ready. ${apiOutput}`);

    const login = await requestJson(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: { schoolSlug: schoolA.slug, email, password },
    });
    assert.equal(login.status, 201);
    assert.equal(login.body.school.id, schoolA.id);

    const crossSchoolEnrollment = await requestJson(`${baseUrl}/students`, {
      method: 'POST',
      token: login.body.accessToken,
      body: { firstName: 'Élève', lastName: 'ClasseÉtrangère', matricule: `CROSS-${randomBytes(8).toString('hex')}`, classId: classB.id },
    });
    assert.equal(crossSchoolEnrollment.status, 404, JSON.stringify(crossSchoolEnrollment.body));

    const crossSchoolTransfer = await requestJson(`${baseUrl}/students/${studentA.id}/enrollments`, {
      method: 'POST',
      token: login.body.accessToken,
      body: { classId: classB.id },
    });
    assert.equal(crossSchoolTransfer.status, 404, JSON.stringify(crossSchoolTransfer.body));

    const schools = await requestJson(`${baseUrl}/auth/schools`, { token: login.body.accessToken });
    assert.deepEqual(new Set(schools.body.map((school) => school.id)), new Set([schoolA.id, schoolB.id]));

    const profileA = await requestJson(`${baseUrl}/admin/school-profile`, { token: login.body.accessToken });
    assert.equal(profileA.body.name, 'Profil école API A');
    const studentsA = await requestJson(`${baseUrl}/students`, { token: login.body.accessToken });
    assert.deepEqual(studentsA.body.data.map((student) => student.lastName), ['ÉcoleA']);

    const switched = await requestJson(`${baseUrl}/auth/switch-school/${schoolB.id}`, {
      method: 'POST',
      token: login.body.accessToken,
    });
    assert.equal(switched.status, 201);
    assert.equal(switched.body.school.id, schoolB.id);

    const profileB = await requestJson(`${baseUrl}/admin/school-profile`, { token: switched.body.accessToken });
    assert.equal(profileB.body.name, 'Profil école API B');
    const studentsB = await requestJson(`${baseUrl}/students`, { token: switched.body.accessToken });
    assert.deepEqual(studentsB.body.data.map((student) => student.lastName), ['ÉcoleB']);

    const oldTokenProfile = await requestJson(`${baseUrl}/admin/school-profile`, { token: login.body.accessToken });
    assert.equal(oldTokenProfile.body.name, 'Profil école API A');
    const oldTokenStudents = await requestJson(`${baseUrl}/students`, { token: login.body.accessToken });
    assert.deepEqual(oldTokenStudents.body.data.map((student) => student.lastName), ['ÉcoleA']);

    const unauthorizedSwitch = await requestJson(`${baseUrl}/auth/switch-school/${randomUUID()}`, {
      method: 'POST',
      token: login.body.accessToken,
    });
    assert.equal(unauthorizedSwitch.status, 401);
  } finally {
    if (api.exitCode === null && api.signalCode === null) {
      api.kill('SIGTERM');
      await new Promise((resolve) => api.once('exit', resolve));
    }
    await prisma.$disconnect();
  }
});