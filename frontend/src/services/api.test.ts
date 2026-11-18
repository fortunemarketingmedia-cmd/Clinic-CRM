import assert from 'node:assert/strict';
import test from 'node:test';
import { apiRequest, getAccessToken, setAccessToken, ApiError } from './api';

test('parallel unauthorized requests share one refresh and retry with its new access token', async (t) => {
  setAccessToken('expired');
  let refreshes = 0;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).endsWith('/auth/refresh')) {
      refreshes++;
      return new Response(JSON.stringify({ accessToken: 'renewed' }), { status: 200 });
    }
    const authorization = (init?.headers as Record<string, string>).Authorization;
    return new Response(
      JSON.stringify(authorization === 'Bearer renewed' ? { data: 'ok' } : { message: 'Expired' }),
      { status: authorization === 'Bearer renewed' ? 200 : 401 },
    );
  });
  const results = await Promise.all([apiRequest('/patients'), apiRequest('/leads')]);
  assert.deepEqual(results, [{ data: 'ok' }, { data: 'ok' }]);
  assert.equal(refreshes, 1);
  assert.equal(getAccessToken(), 'renewed');
  setAccessToken(null);
});

test('temporary refresh failure preserves the current session instead of signing the user out', async (t) => {
  setAccessToken('current');
  t.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request) =>
      new Response(JSON.stringify({ message: 'Busy' }), {
        status: String(input).endsWith('/auth/refresh') ? 503 : 401,
      }),
  );
  await assert.rejects(
    apiRequest('/patients'),
    (error: unknown) => error instanceof ApiError && error.status === 503,
  );
  assert.equal(getAccessToken(), 'current');
  setAccessToken(null);
});

test('public requests never trigger CRM token refresh', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(JSON.stringify({ message: 'Invalid link' }), { status: 401 });
  });
  await assert.rejects(
    apiRequest('/public/consents/invalid'),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(calls, 1);
});
