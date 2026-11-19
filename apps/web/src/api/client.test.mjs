import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveApiBaseUrl } from './client.ts';

test('uses the same-origin API proxy when the browser is on the local network', () => {
  const url = resolveApiBaseUrl({
    hostname: '10.0.18.247',
    protocol: 'http:',
    envUrl: 'http://localhost:3000/api/v1',
  });

  assert.equal(url, '/api/v1');
});

test('keeps the configured production API URL when it is not localhost', () => {
  const url = resolveApiBaseUrl({
    hostname: 'portal.example.com',
    protocol: 'https:',
    envUrl: 'https://api.example.com/api/v1',
  });

  assert.equal(url, 'https://api.example.com/api/v1');
});
