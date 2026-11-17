const assert = require('node:assert/strict');
const { test } = require('node:test');

const { addTenantToCreate } = require('../dist/database/prisma.service.js');

test('overrides a caller-supplied schoolId on the top-level write', () => {
  const result = addTenantToCreate({
    schoolId: 'school-2',
    name: 'École test',
  }, 'school-1', false, true);

  assert.deepEqual(result, {
    schoolId: 'school-1',
    name: 'École test',
  });
});

test('adds schoolId to nested createMany rows without stamping the relation wrapper', () => {
  const result = addTenantToCreate({
    createMany: {
      data: [
        { name: 'Alpha' },
        { name: 'Beta' },
      ],
    },
  }, 'school-1');

  assert.deepEqual(result, {
    createMany: {
      data: [
        { name: 'Alpha', schoolId: 'school-1' },
        { name: 'Beta', schoolId: 'school-1' },
      ],
    },
  });
});

test('adds schoolId to nested connectOrCreate create payloads without stamping the wrapper', () => {
  const result = addTenantToCreate({
    connectOrCreate: {
      where: { code: 'A' },
      create: { code: 'A', name: 'Alpha' },
    },
  }, 'school-1');

  assert.deepEqual(result, {
    connectOrCreate: {
      where: { code: 'A' },
      create: { code: 'A', name: 'Alpha', schoolId: 'school-1' },
    },
  });
});

test('adds schoolId to nested upsert create payloads without stamping the wrapper', () => {
  const result = addTenantToCreate({
    upsert: {
      where: { code: 'A' },
      create: { code: 'A', name: 'Alpha' },
      update: { name: 'Beta' },
    },
  }, 'school-1');

  assert.deepEqual(result, {
    upsert: {
      where: { code: 'A' },
      create: { code: 'A', name: 'Alpha', schoolId: 'school-1' },
      update: { name: 'Beta' },
    },
  });
});
