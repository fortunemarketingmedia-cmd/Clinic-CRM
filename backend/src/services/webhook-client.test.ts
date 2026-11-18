import assert from 'node:assert/strict';
import test from 'node:test';
import { publicWebhookAddress, postAutomationWebhook } from './webhook-client.js';

test('automation webhooks reject private, metadata, mapped and reserved IP targets', () => {
  for (const address of [
    '127.0.0.1',
    '10.2.3.4',
    '192.168.1.1',
    '169.254.169.254',
    '172.16.0.1',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::ffff:127.0.0.1',
    'fe80::1',
    'fc00::1',
    '2001:db8::1',
    '2002:7f00:1::',
  ])
    assert.equal(publicWebhookAddress(address), false, address);
  assert.equal(publicWebhookAddress('8.8.8.8'), true);
  assert.equal(publicWebhookAddress('2606:4700:4700::1111'), true);
});

test('automation webhooks reject unsafe URLs before any network connection', async () => {
  for (const url of [
    'http://example.com',
    'https://example.com:8080',
    'https://user:pass@example.com',
    'https://127.0.0.1',
    'https://[::1]',
  ])
    await assert.rejects(postAutomationWebhook(url, {}, 'test', 1000));
});
