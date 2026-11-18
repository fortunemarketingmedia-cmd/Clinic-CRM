import type { NextFunction, Request, Response } from 'express';
import { redactFinancials } from './redact-financials.js';

const secretFields = new Set([
  'passwordHash',
  'mfaSecretCiphertext',
  'mfaRecoveryCodes',
  'tokenHash',
  'idempotencyHash',
]);
function withoutSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (
    value &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    typeof (value as { toJSON?: unknown }).toJSON !== 'function'
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !secretFields.has(key))
        .map(([key, child]) => [key, withoutSecrets(child)]),
    );
  }
  return value;
}

/** Applied before routes: evaluate the authenticated actor when the response is sent. */
export function sensitiveResponse(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  const json = res.json.bind(res);
  res.json = (body: unknown) =>
    json(withoutSecrets(req.user?.role === 'RECEPTIONIST' ? redactFinancials(body) : body));
  next();
}
