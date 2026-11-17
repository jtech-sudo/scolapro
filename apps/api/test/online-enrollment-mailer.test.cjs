const assert = require('node:assert/strict');
const { test } = require('node:test');
const { OnlineEnrollmentMailerService } = require('../dist/online-enrollment/online-enrollment-mailer.service.js');

test('reports when SMTP and enrollment recipient settings are missing', async (t) => {
  const keys = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_FROM',
    'SMTP_USER',
    'SMTP_PASS',
    'ONLINE_ENROLLMENT_NOTIFICATION_EMAIL',
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  for (const key of keys) delete process.env[key];

  const result = await new OnlineEnrollmentMailerService().notify(
    { id: 'request-test', firstName: 'Test', lastName: 'Élève', guardianFirstName: 'Test', guardianLastName: 'Parent', guardianPhone: '00000000', guardianEmail: null },
    'École test',
    'CP A',
  );

  assert.equal(result, 'not-configured');
});
