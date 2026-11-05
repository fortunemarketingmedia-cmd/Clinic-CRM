import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicAppRoute } from './public-routes';

test('patient consent URLs bypass every CRM authentication gate', () => {
  assert.equal(isPublicAppRoute('/consent/patient-token'), true);
  assert.equal(isPublicAppRoute('/qr/registration-token'), true);
  assert.equal(isPublicAppRoute('/login'), true);
  assert.equal(isPublicAppRoute('/patients/patient-id'), false);
  assert.equal(isPublicAppRoute('/settings'), false);
});
