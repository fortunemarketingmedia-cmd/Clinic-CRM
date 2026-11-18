import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';

export function publicWebhookAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0)
    );
  }
  // Only globally routable IPv6; reject mapped IPv4, local, link-local, documentation and transition ranges.
  return (
    isIP(address) === 6 && /^[23]/i.test(address) && !/^(2001:(?:db8|0):|2002:)/i.test(address)
  );
}

export async function postAutomationWebhook(
  target: string,
  payload: unknown,
  eventId: string,
  timeoutMs: number,
) {
  const url = new URL(target);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
    throw new Error('Webhooks require HTTPS on port 443 without URL credentials');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicWebhookAddress(address)))
    throw new Error('Private or reserved network webhook targets are not allowed');
  const chosen = addresses[0];
  const body = JSON.stringify(payload);
  return new Promise<{ ok: boolean; status: number }>((resolve, reject) => {
    // Pin the validated DNS answer for this connection. Redirects are never followed.
    const request = https.request(
      url,
      {
        method: 'POST',
        agent: false,
        family: chosen.family,
        signal: AbortSignal.timeout(timeoutMs),
        lookup: (_hostname, _options, callback) => callback(null, chosen.address, chosen.family),
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'x-revive-event-id': eventId,
        },
      },
      (response) => {
        response.resume();
        const status = response.statusCode ?? 502;
        resolve({ ok: status >= 200 && status < 300, status });
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}
