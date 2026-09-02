import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { requireSharedSecret } from './shared-secret.js';

function run(expected: string | undefined, supplied?: string) {
  let outcome: unknown;
  const req = { header: () => supplied } as unknown as Request;
  requireSharedSecret(expected)(req, {} as Response, ((value?: unknown) => { outcome = value ?? 'ok'; }) as NextFunction);
  return outcome;
}

test('shared-secret middleware accepts only the configured value', () => {
  assert.equal(run('a-secure-server-secret-1234', 'a-secure-server-secret-1234'), 'ok');
  assert.match(String(run('a-secure-server-secret-1234', 'wrong-secret')), /Lead intake authentication failed/);
  assert.match(String(run(undefined, 'anything')), /Lead intake is not configured/);
});
