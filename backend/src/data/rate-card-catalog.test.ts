import assert from 'node:assert/strict';
import test from 'node:test';
import { rateCardPackages, rateCardServices } from './rate-card-catalog.js';

test('rate-card packages reference valid treatment services', () => {
  const serviceNames = new Set(rateCardServices.map((service) => service.name));
  const missingLinks = rateCardPackages.flatMap((packageMaster) =>
    packageMaster.includedServices
      .filter((serviceName) => !serviceNames.has(serviceName))
      .map((serviceName) => `${packageMaster.name}: ${serviceName}`),
  );

  assert.equal(rateCardServices.length, 81);
  assert.equal(rateCardPackages.length, 56);
  assert.deepEqual(missingLinks, []);
  assert.ok(rateCardServices.every((service) => service.basePrice >= 0));
  assert.ok(rateCardPackages.every((packageMaster) => packageMaster.price > 0 && packageMaster.totalSessions > 0));
});
