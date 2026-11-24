import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { requireProposalKey } from '../src/lib/proposals/create.ts';

const digest = value => createHash('sha256').update(value).digest('hex');
const header = 'twenty-v2.' + digest('omnichannel-support:n8n:v2\0unit-test-api-key');
const fingerprint = digest(header);

test('a paired Twenty credential authorizes protected routes while its displayed fingerprint cannot', () => {
  assert.doesNotThrow(() => requireProposalKey(undefined, header, fingerprint));
  for (const invalid of [undefined, fingerprint, 'twenty-v2.' + fingerprint, header + '1']) {
    assert.throws(() => requireProposalKey(undefined, invalid, fingerprint), { code: 'N8N_PROPOSAL_KEY_FORBIDDEN' });
  }
  assert.throws(() => requireProposalKey(undefined, header, ''), { code: 'N8N_PROPOSAL_KEY_NOT_CONFIGURED' });
  assert.doesNotThrow(() => requireProposalKey('old-secret', 'old-secret', fingerprint));
  assert.doesNotThrow(() => requireProposalKey('old-secret', header, fingerprint));
});
