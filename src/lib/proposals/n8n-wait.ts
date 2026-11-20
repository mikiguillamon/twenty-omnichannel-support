import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { addAbortListener } from 'node:events';
import { IngestError } from '../ingestion/contract.ts';
import type { WaitOutcome, WaitPayload } from './decision.ts';

const pathSegment = /^[a-zA-Z0-9_-][a-zA-Z0-9._~-]*$/;

function httpsUrl(raw: string): URL | null {
  if (!raw.startsWith('https://') || /[\s\\]/.test(raw)) return null;
  const value = URL.parse(raw);
  return value && !value.username && !value.password && !value.hash && isIP(value.hostname.replace(/^\[|\]$/g, '')) === 0
    ? value : null;
}

export function n8nWaitUrl(raw: string, allowedOrigin: string | undefined): URL {
  const base = httpsUrl(allowedOrigin?.trim() ?? '');
  if (!base || base.search) {
    throw new IngestError('N8N_WAIT_NOT_CONFIGURED', 'Configure the HTTPS base URL for n8n Wait in application settings', 503);
  }
  const callback = httpsUrl(raw);
  const prefix = base.pathname.replace(/\/+$/, '') + '/webhook-waiting/';
  if (!callback || callback.origin !== base.origin || !callback.pathname.startsWith(prefix) ||
      !callback.pathname.slice(prefix.length).split('/').every(segment => pathSegment.test(segment))) {
    throw new IngestError('INVALID_PROPOSAL_CALLBACK', 'Use the n8n Wait URL for this execution on the configured host');
  }
  return callback;
}

const deniedIpv4 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) deniedIpv4.addSubnet(network, prefix, 'ipv4');

const globalIpv6 = new BlockList();
globalIpv6.addSubnet('2000::', 3, 'ipv6');
const deniedIpv6 = new BlockList();
for (const [network, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
] as const) deniedIpv6.addSubnet(network, prefix, 'ipv6');

export function isPublicWaitAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !deniedIpv4.check(address, 'ipv4');
  return family === 6 && globalIpv6.check(address, 'ipv6') && !deniedIpv6.check(address, 'ipv6');
}

async function resolveWaitAddress(hostname: string, signal: AbortSignal) {
  let subscription: ReturnType<typeof addAbortListener> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      subscription = addAbortListener(signal, () => reject(new Error('DNS deadline')));
    });
    const addresses = await Promise.race([lookup(hostname, { all: true }), timeout]);
    if (addresses.some(entry => !isPublicWaitAddress(entry.address))) return null;
    return addresses.find(entry => entry.family === 4) ?? addresses[0] ?? null;
  } catch {
    return null;
  } finally {
    subscription?.[Symbol.dispose]();
  }
}

/** Resolves and pins a public address without giving up hostname verification. */
export async function notifyN8nWait(url: URL, payload: WaitPayload, key: string, secret?: string): Promise<WaitOutcome> {
  const signal = AbortSignal.timeout(10000);
  const address = await resolveWaitAddress(url.hostname, signal);
  if (!address || signal.aborted) return 'retryable';
  const body = JSON.stringify(payload);
  const status = await new Promise<number>((resolve, reject) => {
    const outgoing = request(url, {
      method: 'POST', agent: false, signal, family: address.family, servername: url.hostname, rejectUnauthorized: true,
      lookup: (_hostname, options, next) => {
        if (options.all) next(null, [address]);
        else next(null, address.address, address.family);
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
        'Idempotency-Key': key,
        ...(secret ? { 'X-Omnichannel-Webhook-Secret': secret } : {}),
      },
    }, response => {
      resolve(response.statusCode ?? 0);
      response.destroy();
    });
    outgoing.on('error', reject);
    outgoing.end(body);
  }).catch(() => 0);
  if (status >= 200 && status < 300) return 'accepted';
  if ([401, 403, 404, 405, 410, 429].includes(status)) return 'retryable';
  return 'uncertain';
}
