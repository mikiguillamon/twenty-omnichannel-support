import assert from 'node:assert/strict';
import test from 'node:test';
import { decideProposal, parseProposalDecision } from '../src/lib/proposals/decision.ts';
import * as wait from '../src/lib/proposals/n8n-wait.ts';
import { proposalStorageKey } from '../src/lib/proposals/create.ts';

const messageId = 'd4e03365-c14b-4bf8-a6da-186c40cfa6a5';
const { isPublicWaitAddress, n8nWaitUrl } = wait;
const caseId = 'd3f4ecaf-a899-4e04-9aa7-48c2a2997680';
const token = 'cea9b4d9-580d-4e11-8c95-20677da385ee';
const allowedOrigin = 'https://automation.example.com/n8n';
const callbackUrl = `${allowedOrigin}/webhook-waiting/737/approval?signature=private`;
const message = 'Puedes cambiar la cita al miércoles.';
const confirmed = { messageId, confirmed: true, message };
const discarded = { messageId, confirmed: false };

function fixture(channel = 'EMAIL') {
  const record = {
    id: messageId,
    direction: 'OUTBOUND',
    senderType: 'BOT',
    supportCaseId: caseId,
    externalKey: 'omnichannel:proposal:v1:test',
    proposalStatus: 'PENDING',
    proposalUpdateToken: token,
    draftBody: 'Borrador inicial.',
    deliveryStatus: 'PENDING',
  };
  const calls = [];
  const privateData = new Map([[proposalStorageKey(token), { callbackUrl, caseId, externalKey: record.externalKey }]]);
  const claims = new Map();
  const settings = {
    async list(resource, { key }) { assert.equal(resource, 'supportSettings'); return claims.has(key) ? [claims.get(key)] : []; },
    async create(resource, data) {
      assert.equal(resource, 'supportSettings');
      if (claims.has(data.key)) throw Object.assign(Error('conflict'), { status: 409 });
      const claim = { id: data.key, ...data };
      claims.set(data.key, claim);
      return claim;
    },
    async update(resource, id, patch) {
      assert.equal(resource, 'supportSettings');
      Object.assign(claims.get(id), patch);
      return claims.get(id);
    },
  };
  const caller = {
    async get(resource, id) {
      if (resource === 'supportMessages' && id === messageId) return { ...record };
      if (resource === 'supportCases' && id === caseId) return { id, channel };
      return null;
    },
    async update(resource, id, patch) {
      assert.equal(resource, 'supportMessages');
      assert.equal(id, messageId);
      Object.assign(record, patch);
      return { ...record };
    },
  };
  const options = {
    caller, decisionWriter: { ...caller }, settings, allowedOrigin,
    storage: {
      async get(key) { return privateData.get(key) ?? null; },
      async set(key, value) { privateData.set(key, value); },
      async delete(key) { return privateData.delete(key); },
    },
    async notify(url, payload, key) { calls.push({ url: url.href, payload, key }); return 'accepted'; },
  };
  return { record, calls, privateData, claims, options };
}

test('confirmation passes edited text to Wait and never marks the draft as sent', async () => {
  const { record, calls, privateData, options } = fixture();
  const decision = parseProposalDecision(confirmed);
  assert.deepEqual(await decideProposal(decision, options), { ok: true, messageId, proposalStatus: 'CONFIRMED' });
  assert.deepEqual(calls, [{ url: callbackUrl, payload: { confirmed: true, message, proposalMessageId: messageId, caseId }, key: messageId }]);
  assert.equal(record.draftBody, message);
  assert.equal(record.deliveryStatus, 'PENDING');
  assert.equal(record.body, undefined);
  assert.equal(privateData.size, 0);
  assert.equal((await decideProposal(decision, options)).proposalStatus, 'CONFIRMED');
  assert.equal(calls.length, 1);
});

test('discard notifies Wait without a message and leaves the original draft in the history', async () => {
  const { record, calls, options } = fixture();
  assert.equal((await decideProposal(parseProposalDecision(discarded), options)).proposalStatus, 'DISCARDED');
  assert.deepEqual(calls[0].payload, { confirmed: false, proposalMessageId: messageId, caseId });
  assert.equal(record.draftBody, 'Borrador inicial.');
  assert.throws(() => parseProposalDecision({ ...discarded, message: 'unsent' }), { code: 'INVALID_PROPOSAL_DECISION' });
  await assert.rejects(decideProposal(parseProposalDecision(confirmed), options), { code: 'PROPOSAL_ALREADY_DECIDED' });
});

test('an agent can send an edited WhatsApp proposal to Wait', async () => {
  const { calls, options } = fixture('WHATSAPP');
  const result = await decideProposal(parseProposalDecision(confirmed), options);
  assert.equal(result.proposalStatus, 'CONFIRMED');
  assert.equal(calls[0].payload.message, message);
});

test('a Wait conflict is retryable when n8n explicitly says the execution is still running', () => {
  const url = new URL(callbackUrl);
  for (const [message, expected] of [
    ['The execution "737" is running already.', 'retryable'],
    ['The execution "738" is running already.', 'uncertain'],
    ['The execution "737" has finished already.', 'uncertain'],
    ['The execution "737" has finished with error.', 'uncertain'],
  ]) {
    assert.equal(wait.waitResponseOutcome(409, url, JSON.stringify({ message })), expected);
  }
  assert.equal(wait.waitResponseOutcome(409, url, 'invalid json'), 'uncertain');
});

test('an agent with no write permission cannot resume Wait', async () => {
  const { calls, claims, options } = fixture();
  options.caller.update = async () => { throw Object.assign(Error('forbidden'), { status: 403 }); };
  await assert.rejects(decideProposal(parseProposalDecision(confirmed), options), { status: 403 });
  assert.deepEqual(calls, []);
  assert.equal(claims.size, 0);
});

test('agents can decide when only the app can write the internal decision fields', async () => {
  const { calls, record, options } = fixture();
  const update = options.caller.update;
  options.caller.update = async (resource, id, patch) => {
    if ('proposalStatus' in patch || 'replyDecision' in patch) throw Object.assign(Error('forbidden'), { status: 403 });
    return update(resource, id, patch);
  };
  options.decisionWriter.update = async (resource, id, patch) => {
    assert.deepEqual(patch, { proposalStatus: 'CONFIRMED', replyDecision: 'REPLY' });
    return update(resource, id, patch);
  };
  assert.equal((await decideProposal(parseProposalDecision(confirmed), options)).proposalStatus, 'CONFIRMED');
  assert.equal(record.draftBody, message);
  assert.equal(calls.length, 1);
});

test('the app does not write a decision when the proposal was relinked during the callback', async () => {
  const { calls, record, options } = fixture();
  const notify = options.notify;
  options.notify = async (...args) => {
    record.supportCaseId = '3f65e0af-a63c-4a7f-b43d-d468dd24c845';
    return notify(...args);
  };
  await assert.rejects(decideProposal(parseProposalDecision(confirmed), options), { code: 'PROPOSAL_BINDING_CHANGED' });
  assert.equal(record.proposalStatus, 'PENDING');
  assert.equal(calls.length, 1);
});

test('only one concurrent decision reaches Wait and an acknowledged result survives a failed CRM write', async () => {
  const { calls, options } = fixture();
  const notify = options.notify;
  let reachedNotify;
  const notifying = new Promise(resolve => { reachedNotify = resolve; });
  let finishNotify;
  const finish = new Promise(resolve => { finishNotify = resolve; });
  options.notify = async (...args) => { reachedNotify(); await finish; return notify(...args); };
  const update = options.decisionWriter.update;
  options.decisionWriter.update = async (resource, id, patch) => {
    if (patch.proposalStatus === 'CONFIRMED') throw Error('write interrupted');
    return update(resource, id, patch);
  };

  const first = decideProposal(parseProposalDecision(confirmed), options);
  const rejectedWrite = assert.rejects(first, /write interrupted/);
  await notifying;
  await assert.rejects(decideProposal(parseProposalDecision(discarded), options), { code: 'PROPOSAL_DECISION_CONFLICT' });
  finishNotify();
  await rejectedWrite;
  options.decisionWriter.update = update;
  assert.equal((await decideProposal(parseProposalDecision(confirmed), options)).proposalStatus, 'CONFIRMED');
  assert.equal(calls.length, 1);
});

test('retries an explicit rejection with the same payload and never automatically repeats an uncertain callback', async () => {
  const { calls, claims, record, options } = fixture();
  const notify = options.notify;
  options.notify = async (...args) => { await notify(...args); return 'retryable'; };
  await assert.rejects(decideProposal(parseProposalDecision(confirmed), options), { code: 'N8N_WAIT_RETRYABLE' });
  options.notify = async (...args) => { await notify(...args); return 'uncertain'; };
  await assert.rejects(decideProposal(parseProposalDecision(confirmed), options), { code: 'N8N_WAIT_UNCERTAIN' });
  await assert.rejects(decideProposal(parseProposalDecision(confirmed), options), { code: 'N8N_WAIT_UNCERTAIN' });
  assert.equal(record.proposalStatus, 'PENDING');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].key, calls[1].key);
  assert(!JSON.stringify([...claims.values()]).includes(message));
  assert(!JSON.stringify([...claims.values()]).includes(callbackUrl));
});

test('confines callback URLs to the configured HTTPS Wait path and permits a suffix and signature', () => {
  assert.equal(n8nWaitUrl(callbackUrl, allowedOrigin).href, callbackUrl);
  for (const denied of [
    'http://automation.example.com/n8n/webhook-waiting/737',
    'https://user@automation.example.com/n8n/webhook-waiting/737',
    'https://automation.example.com.other.invalid/n8n/webhook-waiting/737',
    `${allowedOrigin}/webhook/737`,
    `${allowedOrigin}/webhook-waiting/737%2Fapproval`,
    `${allowedOrigin}/webhook-waiting/737#fragment`,
  ]) assert.throws(() => n8nWaitUrl(denied, allowedOrigin), { code: 'INVALID_PROPOSAL_CALLBACK' });
});

test('the transport only connects to publicly routable addresses for the configured hostname', () => {
  assert(isPublicWaitAddress('93.184.216.34'));
  assert(isPublicWaitAddress('2606:4700:4700::1111'));
  for (const address of ['127.0.0.1', '169.254.169.254', '192.168.1.2', '10.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::42', 'fe80::1']) {
    assert.equal(isPublicWaitAddress(address), false);
  }
  assert.throws(() => n8nWaitUrl('https://192.0.2.1/webhook-waiting/737', 'https://192.0.2.1'), { code: 'N8N_WAIT_NOT_CONFIGURED' });
});
