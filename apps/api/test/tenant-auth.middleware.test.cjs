const assert = require('node:assert/strict');
const { test } = require('node:test');
const { TenantAuthMiddleware } = require('../dist/auth/tenant-auth.middleware.js');

const deniedRouteCases = [
  { method: 'GET', path: '/api/v1/subjects', module: 'grades', action: 'canView' },
  { method: 'POST', path: '/api/v1/subjects', module: 'grades', action: 'canCreate' },
  { method: 'PATCH', path: '/api/v1/subjects/subject-1', module: 'grades', action: 'canUpdate' },
  { method: 'GET', path: '/api/v1/teaching-assignments', module: 'grades', action: 'canView' },
  { method: 'DELETE', path: '/api/v1/teaching-assignments/assignment-1', module: 'grades', action: 'canDelete' },
  { method: 'GET', path: '/api/v1/timetable', module: 'timetable', action: 'canView' },
  { method: 'POST', path: '/api/v1/timetable', module: 'timetable', action: 'canCreate' },
  { method: 'DELETE', path: '/api/v1/timetable/entry-1', module: 'timetable', action: 'canDelete' },
  { method: 'GET', path: '/api/v1/communication/notices', module: 'communication', action: 'canView' },
  { method: 'POST', path: '/api/v1/communication/notices', module: 'communication', action: 'canCreate' },
  { method: 'PATCH', path: '/api/v1/communication/notices/notice-1', module: 'communication', action: 'canUpdate' },
  { method: 'GET', path: '/api/v1/communication/recipients', module: 'communication', action: 'canView' },
  { method: 'GET', path: '/api/v1/transport/routes', module: 'transport', action: 'canView' },
  { method: 'POST', path: '/api/v1/transport/routes', module: 'transport', action: 'canCreate' },
  { method: 'PATCH', path: '/api/v1/transport/routes/route-1', module: 'transport', action: 'canUpdate' },
  { method: 'POST', path: '/api/v1/transport/routes/route-1/stops', module: 'transport', action: 'canCreate' },
  { method: 'POST', path: '/api/v1/transport/routes/route-1/students', module: 'transport', action: 'canCreate' },
  { method: 'DELETE', path: '/api/v1/transport/routes/route-1/students/student-1', module: 'transport', action: 'canDelete' },
  { method: 'GET', path: '/api/v1/transport/students', module: 'transport', action: 'canView' },
  { method: 'GET', path: '/api/v1/personnel/records', module: 'personnel', action: 'canView' },
  { method: 'POST', path: '/api/v1/personnel/records', module: 'personnel', action: 'canCreate' },
  { method: 'PATCH', path: '/api/v1/personnel/records/staff-1', module: 'personnel', action: 'canUpdate' },
  { method: 'POST', path: '/api/v1/personnel/records/staff-1/leaves', module: 'personnel', action: 'canCreate' },
  { method: 'PATCH', path: '/api/v1/personnel/leaves/leave-1', module: 'personnel', action: 'canUpdate' },
  { method: 'GET', path: '/api/v1/online-enrollment/requests', module: 'online-enrollment', action: 'canView' },
  { method: 'PATCH', path: '/api/v1/online-enrollment/requests/request-1/review', module: 'online-enrollment', action: 'canUpdate' },
  { method: 'POST', path: '/api/v1/online-enrollment/requests/request-1/enroll', module: 'online-enrollment', action: 'canCreate' },
  { method: 'POST', path: '/api/v1/online-enrollment/requests/request-1/notify', module: 'online-enrollment', action: 'canCreate' },
  { method: 'GET', path: '/api/v1/billing/summary', module: 'billing', action: 'canView' },
];

for (const testCase of deniedRouteCases) {
  test(`denies ${testCase.method} ${testCase.path} without ${testCase.module} permission`, async () => {
    const membership = { schoolId: 'school-test', userId: 'user-test', role: 'TEACHER' };
    let checkedPermission;
    let responseStatus;
    let responseBody;
    let continued = false;
    const middleware = new TenantAuthMiddleware(
      { verifyAsync: async () => ({ sub: membership.userId, schoolId: membership.schoolId, role: membership.role }) },
      {
        validateMembership: async () => membership,
        hasPermission: async (...permission) => {
          checkedPermission = permission;
          return false;
        },
      },
      { run: (_context, callback) => callback() },
    );

    await middleware.use(
      { path: testCase.path, method: testCase.method, headers: { authorization: 'Bearer test-token' } },
      {
        status(status) { responseStatus = status; return this; },
        json(body) { responseBody = body; return this; },
      },
      () => { continued = true; },
    );

    assert.deepEqual(checkedPermission, [membership.schoolId, membership.role, testCase.module, testCase.action]);
    assert.equal(responseStatus, 403);
    assert.match(responseBody.message, /autorisation/);
    assert.equal(continued, false);
  });
}

for (const method of ['GET', 'POST']) {
  test(`allows unauthenticated public enrollment ${method}`, async () => {
    let continued = false;
    let permissionChecked = false;
    const middleware = new TenantAuthMiddleware(
      { verifyAsync: async () => { throw new Error('Public routes do not need a token'); } },
      { validateMembership: async () => null, hasPermission: async () => { permissionChecked = true; return false; } },
      { run: (_context, callback) => callback() },
    );

    await middleware.use(
      { path: '/api/v1/online-enrollment/public/ecole-test', method, headers: {} },
      { status() { return this; }, json() { return this; } },
      () => { continued = true; },
    );

    assert.equal(continued, true);
    assert.equal(permissionChecked, false);
  });
}

test('continues when the school role has the module permission', async () => {
  const membership = { schoolId: 'school-test', userId: 'user-test', role: 'TEACHER' };
  let continued = false;
  const middleware = new TenantAuthMiddleware(
    { verifyAsync: async () => ({ sub: membership.userId, schoolId: membership.schoolId, role: membership.role }) },
    { validateMembership: async () => membership, hasPermission: async () => true },
    { run: (_context, callback) => callback() },
  );

  await middleware.use(
    { path: '/api/v1/subjects', method: 'GET', headers: { authorization: 'Bearer test-token' } },
    { status() { return this; }, json() { return this; } },
    () => { continued = true; },
  );

  assert.equal(continued, true);
});

test('allows school administration routes when the school role has administration permission', async () => {
  const membership = { schoolId: 'school-test', userId: 'user-test', role: 'ADMIN' };
  let checkedPermission;
  let continued = false;
  const middleware = new TenantAuthMiddleware(
    { verifyAsync: async () => ({ sub: membership.userId, schoolId: membership.schoolId, role: membership.role }) },
    {
      validateMembership: async () => membership,
      hasPermission: async (...permission) => {
        checkedPermission = permission;
        return true;
      },
    },
    { run: (_context, callback) => callback() },
  );

  await middleware.use(
    { path: '/api/v1/admin/users', method: 'GET', headers: { authorization: 'Bearer school-token' } },
    { status() { return this; }, json() { return this; } },
    () => { continued = true; },
  );

  assert.deepEqual(checkedPermission, [membership.schoolId, membership.role, 'administration', 'canView']);
  assert.equal(continued, true);
});

test('denies school administration routes to non-admin school roles', async () => {
  const membership = { schoolId: 'school-test', userId: 'user-test', role: 'TEACHER' };
  let responseStatus;
  let responseBody;
  let continued = false;
  let permissionChecked = false;
  const middleware = new TenantAuthMiddleware(
    { verifyAsync: async () => ({ sub: membership.userId, schoolId: membership.schoolId, role: membership.role }) },
    {
      validateMembership: async () => membership,
      hasPermission: async () => {
        permissionChecked = true;
        return true;
      },
    },
    { run: (_context, callback) => callback() },
  );

  await middleware.use(
    { path: '/api/v1/admin/users', method: 'GET', headers: { authorization: 'Bearer school-token' } },
    {
      status(status) { responseStatus = status; return this; },
      json(body) { responseBody = body; return this; },
    },
    () => { continued = true; },
  );

  assert.equal(responseStatus, 403);
  assert.match(responseBody.message, /administrateur de cet établissement/);
  assert.equal(permissionChecked, false);
  assert.equal(continued, false);
});

test('seeds default permissions only for the target school', async () => {
  const { AuthService } = require('../dist/auth/auth.service.js');
  let updateCalls = 0;
  let createdRows;
  const service = new AuthService(
    {
      rolePermission: {
        createMany: async ({ data }) => {
          createdRows = data;
          return { count: data.length };
        },
        updateMany: async () => {
          updateCalls += 1;
          throw new Error('default permissions must not be bulk-updated across all schools');
        },
      },
    },
    {},
    {},
  );

  await service.ensureDefaultSchoolPermissions('school-a');

  assert.equal(updateCalls, 0);
  assert.ok(Array.isArray(createdRows));
  assert.ok(createdRows.length > 0);
  assert.ok(createdRows.every((row) => row.schoolId === 'school-a'));
});
