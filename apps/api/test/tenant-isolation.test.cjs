const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

const databaseUrl = process.env.DATABASE_URL_TEST;

test('Prisma scopes reads and writes to the active school', { skip: !databaseUrl && 'Set DATABASE_URL_TEST to an isolated local test schema.' }, async () => {
  const testUrl = new URL(databaseUrl);
  const schema = testUrl.searchParams.get('schema');
  if (!['localhost', '127.0.0.1', '::1'].includes(testUrl.hostname) || !schema?.startsWith('scolapro_test_')) {
    throw new Error('DATABASE_URL_TEST must use localhost and a temporary scolapro_test_* schema.');
  }

  process.env.DATABASE_URL = databaseUrl;
  const { PrismaService } = require('../dist/database/prisma.service.js');
  const { TenantContextService } = require('../dist/database/tenant-context.service.js');
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService(tenantContext);
  const schoolA = `test-school-a-${randomUUID()}`;
  const schoolB = `test-school-b-${randomUUID()}`;
  let profileA;
  let profileB;
  let spoofedStudent;

  const inSchool = (schoolId, operation) => tenantContext.run({ schoolId }, async () => await operation());

  try {
    profileA = await inSchool(schoolA, () => prisma.schoolProfile.create({ data: { name: 'École test A' } }));
    profileB = await inSchool(schoolB, () => prisma.schoolProfile.create({ data: { name: 'École test B' } }));
    spoofedStudent = await inSchool(schoolA, () => prisma.student.create({
      data: { schoolId: schoolB, matricule: `spoof-${randomUUID()}`, firstName: 'Tenant', lastName: 'Spoof' },
    }));

    const profilesSeenByA = await inSchool(schoolA, () => prisma.schoolProfile.findMany({ orderBy: { name: 'asc' } }));
    const profilesSeenByB = await inSchool(schoolB, () => prisma.schoolProfile.findMany({ orderBy: { name: 'asc' } }));
    const crossSchoolProfile = await inSchool(schoolA, () => prisma.schoolProfile.findUnique({ where: { id: profileB.id } }));
    const crossSchoolUpdate = await inSchool(schoolA, () => prisma.schoolProfile.updateMany({ where: { id: profileB.id }, data: { name: 'Modification interdite' } }));
    const spoofedUpdate = await inSchool(schoolA, () => prisma.schoolProfile.update({
      where: { id: profileA.id },
      data: { schoolId: schoolB, name: 'Modification école A' },
    }));
    const spoofedBulkUpdate = await inSchool(schoolA, () => prisma.schoolProfile.updateMany({
      where: { id: profileA.id },
      data: { schoolId: schoolB },
    }));

    assert.equal(spoofedStudent.schoolId, schoolA);
    assert.deepEqual(profilesSeenByA.map((profile) => profile.schoolId), [schoolA]);
    assert.deepEqual(profilesSeenByB.map((profile) => profile.schoolId), [schoolB]);
    assert.equal(crossSchoolProfile, null);
    assert.equal(crossSchoolUpdate.count, 0);
    assert.equal(spoofedUpdate.schoolId, schoolA);
    assert.equal(spoofedBulkUpdate.count, 1);
    assert.equal((await inSchool(schoolA, () => prisma.schoolProfile.findUnique({ where: { id: profileA.id } }))).schoolId, schoolA);
  } finally {
    if (profileA) await inSchool(schoolA, () => prisma.schoolProfile.deleteMany({ where: { id: profileA.id } }));
    if (profileB) await inSchool(schoolB, () => prisma.schoolProfile.deleteMany({ where: { id: profileB.id } }));
    if (spoofedStudent) await inSchool(schoolA, () => prisma.student.deleteMany({ where: { id: spoofedStudent.id } }));
    await prisma.onModuleDestroy();
  }
});