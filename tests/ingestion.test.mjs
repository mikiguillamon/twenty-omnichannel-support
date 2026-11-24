import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, keys, IngestError } from '../src/lib/ingestion/contract.ts';
import { readTotalCount } from '../src/lib/overview.ts';
import * as ingestion from '../src/lib/ingestion/processor.ts';
import { serializeFilter, TwentyRestIngestionStore } from '../src/lib/ingestion/twenty-rest-store.ts';
import * as proposalCreate from '../src/lib/proposals/create.ts';
import messageAppendRoute from '../src/logic-functions/omnichannel-message-append.logic-function.ts';
import proposalCreateRoute from '../src/logic-functions/omnichannel-proposal-create.logic-function.ts';

const { ingest } = ingestion;

class MemoryStore {
  constructor(channelType = 'EMAIL') {
    this.rows = new Map();
    this.id = 0;
    this.rows.set('supportChannels', [{
      id: 'channel-1', code: channelType === 'EMAIL' ? 'email-test' : channelType === 'PHONE' ? 'phone-test' : 'wa-test',
      channelType, provider: channelType === 'EMAIL' ? 'gmail' : channelType === 'PHONE' ? 'voip' : 'evolution',
      externalIdentifier: channelType === 'EMAIL' ? 'support@example.com' : channelType === 'PHONE' ? 'line-1' : 'wa-1',
      status: 'ACTIVE', groupingMode: channelType === 'EMAIL' ? 'THREAD' : 'HYBRID',
      ambiguousAction: 'REVIEW',
    }]);
    this.writes = [];
  }
  rowsFor(type) { return this.rows.get(type) ?? []; }
  async list(type, filter, limit = 20) {
    return this.rowsFor(type).filter(row =>
      Object.entries(filter).every(([field, value]) => {
        const got = field.split('.').reduce((obj, key) => obj?.[key], row);
        return String(got ?? '') === String(value);
      })).slice(0, limit);
  }
  async get(type, id) { return this.rowsFor(type).find(row => row.id === id) ?? null; }
  async create(type, data) {
    if (this.rowsFor(type).some(r => (data.externalKey && r.externalKey === data.externalKey) ||
      (data.id && r.id === data.id))) {
      throw Object.assign(new Error('unique index conflict'), { status: 409 });
    }
    this.id++;
    const row = { ...data, id: data.id ?? 'new-' + this.id };
    this.rows.set(type, [...this.rowsFor(type), row]);
    this.writes.push(['create', type, row]);
    return row;
  }
  async update(type, id, data) {
    const r = await this.get(type, id);
    if (!r) throw new Error('record missing');
    Object.assign(r, data);
    this.writes.push(['update', type, r]);
    return r;
  }
  async advanceCaseActivity(caseId, occurredAt, recoveredChanges) {
    const row = this.rowsFor('supportCases').find(record => record.id === caseId);
    if (row && (!row.lastMessageAt || Date.parse(row.lastMessageAt) < Date.parse(occurredAt) ||
        (recoveredChanges && row.lastMessageAt === occurredAt))) {
      Object.assign(row, recoveredChanges);
      row.lastMessageAt = occurredAt;
      this.writes.push(['update', 'supportCases', row]);
    }
  }
  async linkPersonIfMissing(resource, id, personId) {
    const record = this.rowsFor(resource).find(row => row.id === id);
    if (record && !record.personId) record.personId = personId;
  }
  async linkMessageIfMissing(id, caseId) {
    const message = this.rowsFor('supportMessages').find(row => row.id === id);
    if (message && !message.supportCaseId) message.supportCaseId = caseId;
  }
}

const email = (extra = {}) => normalizeEvent({
  channelCode: 'email-test', channelType: 'EMAIL',
  provider: 'gmail', accountId: 'support@example.com',
  contact: { email: 'client@example.com', name: 'Alex Client' },
  message: { externalId: 'provider-message-1', threadId: 'thread-1', body: 'Hola', subject: 'Ayuda' },
  ...extra,
}, new Date('2026-11-16T12:00:00.000Z'), () => 'test-uuid');

const whatsapp = (extra = {}) => normalizeEvent({
  channelCode: 'wa-test', channelType: 'WHATSAPP',
  provider: 'evolution', accountId: 'wa-1',
  externalUserId: '34600111222@s.whatsapp.net',
  remoteJid: '2323232323@lid', remoteJidAlt: '34600111222@s.whatsapp.net',
  messageId: 'wamid-100', body: 'hola',
  ...extra,
}, new Date('2026-11-16T12:00:00.000Z'));

test('flat n8n data without messageId uses a one-time generated key', () => {
  const event = normalizeEvent({
    channelCode: 'email-test', channelType: 'EMAIL', customerEmail: 'client@example.com', body: 'hola',
  }, new Date('2026-11-16T12:00:00Z'), () => 'test-uuid');
  assert.equal(event.stableId, false);
  assert.equal(event.messageKey, 'generated-test-uuid');
  assert.equal(event.message.threadId, '');
  assert.equal(event.contactEmail, 'client@example.com');
  assert.equal(event.message.direction, 'INBOUND');
});

test('message status needs the stable external message ID', () => {
  assert.throws(() => normalizeEvent({channelCode:'email-test',eventType:'message.status'}), error =>
    error instanceof IngestError && error.code === 'MISSING_MESSAGE_ID');
});

test('WhatsApp PN / LID are normalized and account-scoped', () => {
  const event = whatsapp();
  const scope = keys(event, {channelType: 'WHATSAPP', provider:'evolution', externalIdentifier:'wa-1'});
  assert.equal(scope.aliases.length, 2);
  assert(scope.aliases.some(a => a.aliasType === 'WHATSAPP_LID'));
  assert(scope.aliases.some(a => a.aliasType === 'WHATSAPP_PN'));
  assert(scope.messageKey.includes(':MESSAGE:wamid-100'));
});

test('WhatsApp group events are rejected', () => {
  assert.throws(() => whatsapp({remoteJid:'12345@g.us'}), error =>
    error instanceof IngestError && error.code === 'UNSUPPORTED_GROUP');
});

test('reject cross-account scope, even when the event is otherwise valid', () => {
  assert.throws(() => keys(email(), {channelType:'EMAIL',provider:'gmail',externalIdentifier:'other@example.com'}), error =>
    error instanceof IngestError && error.code === 'ACCOUNT_MISMATCH');
});

test('create native Person, Identity, Case, Message and relations; retry is idempotent', async () => {
  const store = new MemoryStore();
  const first = await ingest(email(), store);
  assert.equal(first.status, 'created');
  assert(first.personId && first.identityId && first.caseId && first.messageId);
  const person = store.rowsFor('people')[0];
  assert.equal(person.emails.primaryEmail, 'client@example.com');
  const identity = store.rowsFor('supportExternalIdentities')[0];
  assert.equal(identity.personId, person.id);
  const supportCase = store.rowsFor('supportCases')[0];
  assert.equal(supportCase.personId, person.id);
  assert.equal(supportCase.externalIdentityId, identity.id);
  assert.equal(store.rowsFor('supportMessages')[0].supportCaseId, supportCase.id);
  const before = store.writes.length;
  const second = await ingest(email(), store);
  assert.equal(second.status, 'duplicate');
  assert.equal(store.rowsFor('supportMessages').length, 1);
  assert.equal(store.writes.length, before);
});

test('messages in the same email thread share a case', async () => {
  const store = new MemoryStore();
  const first = await ingest(email(), store);
  const second = await ingest(email({message:{externalId:'provider-message-2',threadId:'thread-1',body:'segunda respuesta',occurredAt:'2026-11-16T13:00:00Z'}}),store);
  assert.equal(first.caseId,second.caseId);
  assert.equal(store.rowsFor('supportCases').length,1);
  assert.equal(store.rowsFor('supportMessages').length,2);
});

test('persists every line break of incoming plain text, including blank lines at the edges', async () => {
  const store = new MemoryStore('WHATSAPP');
  await ingest(whatsapp({ body: '\r\n  Hola\r\n\r\nPuedo ir mañana?\rGracias\r\n' }), store);
  assert.equal(store.rowsFor('supportMessages')[0].body, '\n  Hola\n\nPuedo ir mañana?\nGracias\n');
});

test('persists HTML email as plain text with paragraphs, breaks and decoded characters', async () => {
  const store = new MemoryStore();
  await ingest(email({ message: {
    externalId: 'html-mail',
    body: '<html><head><title>Oculto</title></head><body><p>Hola, Ana &amp; Luis</p><p>Primera l&iacute;nea<br>Segunda<br><br>Cuarta</p><p><a href="https://example.com/factura">Ver factura</a></p><p hidden>Oculto</p><style>.x{}</style></body></html>',
  } }), store);
  assert.equal(store.rowsFor('supportMessages')[0].body, 'Hola, Ana & Luis\n\nPrimera línea\nSegunda\n\nCuarta\n\nVer factura [https://example.com/factura]');
});

test('accepts an HTML-only payload and prefers the textual version when present', async () => {
  const store = new MemoryStore();
  await ingest(email({ message: { externalId: 'html-only', body: '\r\n ', bodyHtml: '<div>Primera</div><div>Segunda</div>' } }), store);
  await ingest(email({ message: { externalId: 'multipart', text: 'Usa <div> aquí\n\nGracias', html: '<p>Otra versión</p>' } }), store);
  assert.deepEqual(store.rowsFor('supportMessages').map(row => row.body), ['Primera\nSegunda', 'Usa <div> aquí\n\nGracias']);
});

const n8nOrigin = 'https://automation.example.com/n8n';
const waitUrl = `${n8nOrigin}/webhook-waiting/817/approval`;

test('proposal intake requires its own configured integration credential', () => {
  assert.throws(() => proposalCreate.requireProposalKey(undefined, 'synthetic'), { code: 'N8N_PROPOSAL_KEY_NOT_CONFIGURED' });
  assert.throws(() => proposalCreate.requireProposalKey('synthetic', undefined), { code: 'N8N_PROPOSAL_KEY_FORBIDDEN' });
  assert.throws(() => proposalCreate.requireProposalKey('synthetic', 'incorrect'), { code: 'N8N_PROPOSAL_KEY_FORBIDDEN' });
  assert.doesNotThrow(() => proposalCreate.requireProposalKey('synthetic', 'synthetic'));
});

test('the case append and proposal routes reject an invalid integration key before reaching Twenty REST', async t => {
  const key = 'OMNICHANNEL_N8N_PROPOSAL_SECRET';
  const previous = process.env[key];
  process.env[key] = 'unit-test-only-key';
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw Error('Unexpected Twenty REST request'); });
  for (const route of [messageAppendRoute.config, proposalCreateRoute.config]) {
    assert.equal(route.httpRouteTriggerSettings.isAuthRequired, true);
    assert.deepEqual(route.httpRouteTriggerSettings.forwardedRequestHeaders, ['x-omnichannel-proposal-key']);
    for (const headers of [{}, { 'x-omnichannel-proposal-key': 'wrong-key' }]) {
      const response = await route.handler({ headers, body: {} });
      assert.equal(response.status, 403);
      assert.equal(response.body.error.code, 'N8N_PROPOSAL_KEY_FORBIDDEN');
    }
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('an incoming email with a proposal adds a pending outbound draft to the same case', async () => {
  const store = new MemoryStore();
  const values = new Map();
  const proposals = {
    allowedOrigin: n8nOrigin,
    storage: { async get(key) { return values.get(key) ?? null; }, async set(key, value) { values.set(key, value); } },
  };
  const event = email({ proposedReply: { body: 'Hola, te contestamos enseguida.', callbackUrl: waitUrl } });
  const result = await ingest(event, store, proposals);
  const [received, proposal] = store.rowsFor('supportMessages');
  assert.equal(store.rowsFor('supportCases')[0].status, 'IN_PROGRESS');
  assert.equal(proposal.id, result.proposalMessageId);
  assert.equal(result.proposalStatus, 'PENDING');
  assert.equal(proposal.supportCaseId, received.supportCaseId);
  assert.equal(proposal.proposalStatus, 'PENDING');
  assert.equal(proposal.draftBody, 'Hola, te contestamos enseguida.');
  assert.equal(proposal.body, undefined);
  assert.equal(proposal.deliveryStatus, 'PENDING');
  assert.equal(proposal.senderType, 'BOT');
  assert.equal(proposal.direction, 'OUTBOUND');
  assert.equal([...values.values()][0].callbackUrl, waitUrl);
  assert(!JSON.stringify(store.rowsFor('supportMessages')).includes(waitUrl));

  proposal.proposalStatus = 'CONFIRMED';
  values.clear();
  const duplicate = await ingest(event, store, proposals);
  assert.equal(duplicate.proposalMessageId, proposal.id);
  assert.equal(duplicate.proposalStatus, 'CONFIRMED');
  assert.equal(proposal.proposalStatus, 'CONFIRMED');
  assert.equal(values.size, 0);
  assert.equal(store.rowsFor('supportMessages').length, 2);
});

test('persists HTML reply proposals as editable plain text', async () => {
  const store = new MemoryStore();
  await ingest(email({ proposedReply: { body: '<p>Hola<br>Primera línea</p><p>Gracias</p>', callbackUrl: waitUrl } }), store, {
    allowedOrigin: n8nOrigin,
    storage: { async get() { return null; }, async set() {} },
  });
  assert.equal(store.rowsFor('supportMessages')[1].draftBody, 'Hola\nPrimera línea\n\nGracias');
});

test('a second n8n execution cannot replace the Wait URL of a pending proposal', async () => {
  const store = new MemoryStore();
  const values = new Map();
  const proposals = {
    allowedOrigin: n8nOrigin,
    storage: { async get(key) { return values.get(key) ?? null; }, async set(key, value) { values.set(key, value); } },
  };
  const first = email({ proposedReply: { body: 'El borrador original.', callbackUrl: waitUrl } });
  const replayUrl = `${n8nOrigin}/webhook-waiting/927/approval`;
  const replay = email({ proposedReply: { body: 'Un borrador distinto.', callbackUrl: replayUrl } });
  const result = await ingest(first, store, proposals);
  assert.equal((await ingest(first, store, proposals)).proposalStatus, 'PENDING');
  await assert.rejects(ingest(replay, store, proposals), { code: 'PROPOSAL_CALLBACK_CONFLICT', status: 409 });
  assert.equal([...values.values()][0].callbackUrl, waitUrl);
  assert.equal(values.size, 1);
  assert.equal(store.rowsFor('supportMessages').length, 2);

  store.rowsFor('supportMessages')[1].proposalStatus = 'DISCARDED';
  values.clear();
  const terminal = await ingest(replay, store, proposals);
  assert.equal(terminal.proposalStatus, 'DISCARDED');
  assert.equal(terminal.proposalMessageId, result.proposalMessageId);
  assert.equal(values.size, 0);
});

test('retry completes a proposal after the inbound email was already saved and private storage failed', async () => {
  const store = new MemoryStore();
  const event = email({ proposedReply: { body: 'Gracias por avisar.', callbackUrl: waitUrl } });
  const proposals = { allowedOrigin: n8nOrigin, storage: { async get() { return null; }, async set() { throw Error('unavailable'); } } };
  await assert.rejects(ingest(event, store, proposals), /unavailable/);
  assert.equal(store.rowsFor('supportMessages').length, 1);
  proposals.storage.set = async () => {};
  assert.equal((await ingest(event, store, proposals)).status, 'duplicate');
  assert.equal(store.rowsFor('supportMessages').length, 2);
});

test('proposals require a stable inbound email and a configured Wait origin before writing records', async () => {
  const options = { proposedReply: { body: 'Gracias.', callbackUrl: waitUrl } };
  assert.throws(() => normalizeEvent({ channelCode: 'email-test', ...options }), { code: 'PROPOSAL_REQUIRES_MESSAGE_ID' });
  assert.throws(() => email({ eventType: 'message.sent', ...options }), { code: 'INVALID_PROPOSAL_EVENT' });
  const store = new MemoryStore();
  const storage = { async get() { return null; }, async set() {} };
  await assert.rejects(ingest(email(options), store, { storage }), { code: 'N8N_WAIT_NOT_CONFIGURED' });
  await assert.rejects(ingest(email(options), store, { allowedOrigin: 'https://unrelated.example.com', storage }), { code: 'INVALID_PROPOSAL_CALLBACK' });
  assert.equal(store.writes.length, 0);
});

test('an inline WhatsApp proposal uses the same history as the incoming message', async () => {
  const store = new MemoryStore('WHATSAPP');
  const result = await ingest(whatsapp({ proposedReply: { body: 'Gracias.', callbackUrl: waitUrl } }), store, {
    allowedOrigin: n8nOrigin, storage: { async get() { return null; }, async set() {} },
  });
  assert.equal(result.proposalStatus, 'PENDING');
  assert.equal(store.rowsFor('supportMessages')[1].supportCaseId, result.caseId);
});

test('a proposal can be added to a previously ingested message using its Twenty ID alone', async () => {
  const store = new MemoryStore('WHATSAPP');
  const source = await ingest(whatsapp(), store);
  const id = '25ae1525-5bb0-4f44-929f-baf3f5509cb2';
  store.rowsFor('supportMessages')[0].id = id;
  const privateData = new Map();
  const storage = {
    async get(key) { return privateData.get(key) ?? null; },
    async set(key, value) { privateData.set(key, value); },
  };
  const input = { messageId: id, body: '<p>Hola<br>Gracias.</p>', callbackUrl: waitUrl };
  const result = await proposalCreate.proposeReply(input, store, storage, n8nOrigin);
  const draft = store.rowsFor('supportMessages')[1];
  assert.deepEqual(result, { proposalMessageId: draft.id, proposalStatus: 'PENDING', caseId: source.caseId });
  assert.equal(draft.draftBody, 'Hola\nGracias.');
  assert.equal(draft.supportCaseId, source.caseId);
  assert.equal(store.rowsFor('supportCases')[0].status, 'NEW');
  assert(!JSON.stringify(result).includes(waitUrl));
  assert(!JSON.stringify(draft).includes(waitUrl));
  assert.deepEqual(await proposalCreate.proposeReply(input, store, storage, n8nOrigin), result);
  await assert.rejects(proposalCreate.proposeReply({ ...input, callbackUrl: waitUrl + '/other' }, store, storage, n8nOrigin),
    { code: 'PROPOSAL_CALLBACK_CONFLICT' });
  await assert.rejects(proposalCreate.proposeReply({ ...input, caseId: source.caseId }, store, storage, n8nOrigin),
    { code: 'INVALID_PROPOSAL' });
  store.rowsFor('supportMessages')[0].direction = 'OUTBOUND';
  await assert.rejects(proposalCreate.proposeReply(input, store, storage, n8nOrigin), { code: 'PROPOSAL_SOURCE_NOT_FOUND' });
  assert.equal(store.rowsFor('supportMessages').length, 2);
});

test('append uses the case channel and reuses provider delivery tracking without looking up the contact', async () => {
  const store = new MemoryStore('WHATSAPP');
  await ingest(whatsapp(), store);
  const supportCase = store.rowsFor('supportCases')[0];
  const caseId = '12d9f648-84f1-4c4d-852b-f2e7019796d7';
  supportCase.id = caseId;
  const input = { caseId, message: {
    externalId: 'sent-1', body: 'Texto aprobado', occurredAt: '2026-11-17T12:00:00Z',
  } };
  const result = await ingestion.appendMessage(input, store);
  assert.equal(result.caseId, caseId);
  assert.equal(result.status, 'created');
  assert.equal(result.identityId, supportCase.externalIdentityId);
  assert.equal(store.rowsFor('supportCases').length, 1);
  const sent = store.rowsFor('supportMessages').find(row => row.id === result.messageId);
  assert.equal(sent.body, 'Texto aprobado');
  assert.equal(sent.direction, 'OUTBOUND');
  assert.equal(sent.deliveryStatus, 'SENT');
  assert.equal(supportCase.lastMessageAt, '2026-11-17T12:00:00.000Z');
  assert.equal((await ingestion.appendMessage(input, store)).status, 'duplicate');
  const secondCaseId = 'cd0b72dc-0241-4c13-af3a-ca0e7803c194';
  await store.create('supportCases', { ...supportCase, id: secondCaseId, externalKey: 'other-case' });
  await assert.rejects(ingestion.appendMessage({ ...input, caseId: secondCaseId }, store), { code: 'MESSAGE_CASE_CONFLICT' });
  await assert.rejects(ingestion.appendMessage({ caseId, message: { body: 'Sin ID' } }, store), { code: 'MISSING_MESSAGE_ID' });
  const delivered = await ingest(whatsapp({ eventType: 'message.status', messageId: 'sent-1', deliveryStatus: 'DELIVERED' }), store);
  assert.equal(delivered.messageId, result.messageId);
  assert.equal(sent.deliveryStatus, 'DELIVERED');
});

test('append accepts legacy provider and account overrides if the channel leaves them unset', async () => {
  const store = new MemoryStore('WHATSAPP');
  const channel = store.rowsFor('supportChannels')[0];
  channel.provider = null;
  channel.externalIdentifier = null;
  await ingest(whatsapp(), store);
  const caseId = '2ac9d9e3-b1f1-4d11-a413-1cd6eeffa7b7';
  store.rowsFor('supportCases')[0].id = caseId;
  const response = await ingestion.appendMessage({
    caseId, provider: 'evolution', accountId: 'wa-1', message: { externalId: 'sent-legacy', body: 'Enviado' },
  }, store);
  const status = await ingest(whatsapp({ eventType: 'message.status', messageId: 'sent-legacy', deliveryStatus: 'DELIVERED' }), store);
  assert.equal(status.messageId, response.messageId);
  await assert.rejects(ingestion.appendMessage({
    caseId, provider: 'evolution', accountId: 'other-wa', message: { externalId: 'wrong-account', body: 'Enviado' },
  }, store), { code: 'CASE_SCOPE_MISMATCH' });
});

test('append retries repair case activity without moving it backwards', async () => {
  const store = new MemoryStore();
  await ingest(email(), store);
  const supportCase = store.rowsFor('supportCases')[0];
  const caseId = 'd95fd502-35f5-489e-8cb7-20dd5b4827eb';
  supportCase.id = caseId;
  const older = { caseId, message: { externalId: 'older', occurredAt: '2026-11-17T12:00:00.000Z' } };
  const newer = { caseId, message: { externalId: 'newer', occurredAt: '2026-11-18T12:00:00.000Z' } };
  const advance = store.advanceCaseActivity.bind(store);
  store.advanceCaseActivity = async () => { throw Error('case activity unavailable'); };
  await assert.rejects(ingestion.appendMessage(older, store), /case activity unavailable/);
  assert.equal(store.rowsFor('supportMessages').length, 2);
  store.advanceCaseActivity = advance;
  assert.equal((await ingestion.appendMessage(older, store)).status, 'duplicate');
  assert.equal(supportCase.lastMessageAt, older.message.occurredAt);
  await ingestion.appendMessage(newer, store);
  await ingestion.appendMessage(older, store);
  assert.equal(supportCase.lastMessageAt, newer.message.occurredAt);
});

test('the Twenty REST activity write filters on case ID and old or missing dates in the same request', async () => {
  const caseId = 'd95fd502-35f5-489e-8cb7-20dd5b4827eb';
  const occurredAt = '2026-11-17T12:00:00.000Z';
  const calls = [];
  const store = new TwentyRestIngestionStore({ async patch(...args) { calls.push(args); } });
  await store.advanceCaseActivity(caseId, occurredAt);
  assert.deepEqual(calls, [[
    '/rest/supportCases',
    { lastMessageAt: occurredAt },
    { query: { filter: `and(id[eq]:"${caseId}",or(lastMessageAt[lt]:"${occurredAt}",lastMessageAt[is]:NULL))` } },
  ]]);
});

test('an existing Person is reused by verified matching email, never duplicated', async () => {
  const store = new MemoryStore();
  store.rows.set('people', [{id:'known-person',emails:{primaryEmail:'client@example.com'}}]);
  const result = await ingest(email(),store);
  assert.equal(result.personId,'known-person');
  assert.equal(store.rowsFor('people').length,1);
});

test('an ambiguous WhatsApp identity is recorded for human review, without a forced Person', async () => {
  const store = new MemoryStore('WHATSAPP');
  const event = whatsapp();
  const scope = keys(event, {channelType:'WHATSAPP',provider:'evolution',externalIdentifier:'wa-1'});
  store.rows.set('supportExternalIdentities', [{id:'person-a',externalKey:'some-key'}, {id:'person-b',externalKey:'other-key'}]);
  store.rows.set('supportIdentityAliases', [
    {id:'a1',externalKey:scope.aliases[0].externalKey,externalIdentityId:'person-a'},
    {id:'a2',externalKey:scope.aliases[1].externalKey,externalIdentityId:'person-b'},
  ]);
  const result = await ingest(event,store);
  assert.equal(result.reviewRequired,true);
  assert.equal(result.personId,null);
  assert.equal(result.identityId,null);
  assert.equal(store.rowsFor('supportCases')[0].status,'HUMAN_REQUIRED');
  assert.equal(store.rowsFor('supportMessages').length,1);
});

test('a retry completes a review case after a temporary failure saving the message', async () => {
  const store = new MemoryStore('WHATSAPP');
  const event = normalizeEvent({ channelCode: 'wa-test', messageId: 'anonymous-1', body: 'Hola' });
  const create = store.create.bind(store);
  let failNextMessage = true;
  store.create = async (type, data) => {
    if (type === 'supportMessages' && failNextMessage) {
      failNextMessage = false;
      throw new Error('temporary message write failure');
    }
    return create(type, data);
  };

  await assert.rejects(ingest(event, store), /temporary message write failure/);
  const [reviewCase] = store.rowsFor('supportCases');
  assert.equal(reviewCase.status, 'HUMAN_REQUIRED');
  assert.equal(store.rowsFor('supportMessages').length, 0);

  const result = await ingest(event, store);
  assert.equal(result.status, 'created');
  assert.equal(result.reviewRequired, true);
  assert.equal(result.caseId, reviewCase.id);
  assert.equal(store.rowsFor('supportCases').length, 1);
  assert.equal(store.rowsFor('supportMessages')[0].supportCaseId, reviewCase.id);
  assert.equal((await ingest(event, store)).status, 'duplicate');
});

test('retry recovery never attaches a message to a review case from another channel', async () => {
  const store = new MemoryStore('WHATSAPP');
  const event = normalizeEvent({ channelCode: 'wa-test', messageId: 'anonymous-1', body: 'Hola' });
  const scope = keys(event, { channelType: 'WHATSAPP', provider: 'evolution', externalIdentifier: 'wa-1' });
  await store.create('supportCases', {
    externalKey: `${scope.ns}:REVIEW-MESSAGE:${event.messageKey}`,
    channelInstanceId: 'another-channel',
    status: 'HUMAN_REQUIRED',
  });

  await assert.rejects(ingest(event, store), { code: 'CASE_CONFLICT' });
  assert.equal(store.rowsFor('supportMessages').length, 0);
});

test('a chat without verified email does not fabricate a native Person', async () => {
  const store = new MemoryStore('WHATSAPP');
  const result = await ingest(whatsapp(),store);
  assert.equal(result.personId,null);
  assert.equal(store.rowsFor('people').length,0);
  assert.equal(store.rowsFor('supportIdentityAliases').length,2);
});

test('status notifications update the existing message instead of adding a second message', async () => {
  const store = new MemoryStore();
  const result = await ingest(email(),store);
  const event = email({eventType:'message.status',message:{externalId:'provider-message-1',deliveryStatus:'DELIVERED'}});
  const status = await ingest(event,store);
  assert.equal(status.status,'status_updated');
  assert.equal(status.messageId,result.messageId);
  assert.equal(store.rowsFor('supportMessages').length,1);
  assert.equal(store.rowsFor('supportMessages')[0].deliveryStatus,'DELIVERED');
});

test('filters escape untrusted values and encode multiple conditions', () => {
  assert.equal(serializeFilter({code:'test"and'}),'code[eq]:"test\\"and"');
  assert.equal(serializeFilter({externalIdentityId:'id-a',channelInstanceId:'id-b'}),'and(externalIdentityId[eq]:"id-a",channelInstanceId[eq]:"id-b")');
});

test('outgoing email resolves recipient without inventing a new thread ID', async () => {
  const store = new MemoryStore();
  const event = normalizeEvent({
    channelCode: 'email-test',
    channelType: 'EMAIL',
    provider: 'gmail',
    accountId: 'support@example.com',
    message: {
      externalId: 'outgoing-01',
      direction: 'OUTBOUND',
      toAddress: 'recipient@example.com',
      fromAddress: 'support@example.com',
      body: 'Respuesta',
    },
  });
  const result = await ingest(event, store);
  assert.equal(result.status, 'created');
  assert.equal(store.rowsFor('people')[0].emails.primaryEmail, 'recipient@example.com');
  assert.equal(store.rowsFor('supportCases')[0].status, 'HUMAN_REQUIRED');
  assert.equal(store.rowsFor('supportMessages')[0].direction, 'OUTBOUND');
});

test('idempotencyKey makes retries safe when provider message ID is unavailable', async () => {
  const store = new MemoryStore();
  const raw = {
    channelCode: 'email-test', channelType: 'EMAIL',
    provider: 'gmail', accountId: 'support@example.com',
    customerEmail: 'client@example.com',
    idempotencyKey: 'source-event-1',
    body: 'Mensaje sin ID de proveedor',
  };
  const firstResult = await ingest(normalizeEvent(raw), store);
  const secondResult = await ingest(normalizeEvent(raw), store);
  assert.equal(firstResult.status, 'created');
  assert.equal(secondResult.status, 'duplicate');
  assert.equal(store.rowsFor('supportMessages').length, 1);
});

test('delivery updates are monotonic after DELIVERED', async () => {
  const store = new MemoryStore();
  await ingest(email(), store);
  await ingest(email({eventType:'message.status',message:{externalId:'provider-message-1',deliveryStatus:'DELIVERED'}}), store);
  const late = await ingest(email({eventType:'message.status',message:{externalId:'provider-message-1',deliveryStatus:'SENT'}}), store);
  assert.equal(late.status, 'duplicate');
  assert.equal(store.rowsFor('supportMessages')[0].deliveryStatus, 'DELIVERED');
});

test('a message from a different configured account cannot impersonate an existing channel', async () => {
  const store = new MemoryStore();
  const event = email({accountId:'other@example.com'});
  await assert.rejects(() => ingest(event,store), error =>
    error instanceof IngestError && error.code === 'ACCOUNT_MISMATCH');
  assert.equal(store.writes.length,0);
});


test('REST dashboard counts use top-level totalCount and never fabricate zero',()=>{
  assert.equal(readTotalCount({data:{supportCases:[]},totalCount:18}),18);
  assert.equal(readTotalCount({data:{supportCases:[]}}),null);
  assert.equal(readTotalCount({totalCount:0}),0);
});

test('create conversation with optional status, follow-up, language and summary through ingestion',async()=>{
  const store=new MemoryStore();
  const event=email({conversation:{
    status:'INFORMATIONAL',followUp:'NONE',language:'ca',summary:'Missatge automàtic',comments:'Sense resposta necessària',
    followUpAt:'2026-11-20T09:00:00Z',
  }});
  await ingest(event,store);
  const conversation=store.rowsFor('supportCases')[0];
  assert.equal(conversation.status,'INFORMATIONAL');
  assert.equal(conversation.followUp,'NONE');
  assert.equal(conversation.language,'ca');
  assert.equal(conversation.summary,'Missatge automàtic');
  assert.equal(conversation.followUpAt,'2026-11-20T09:00:00.000Z');
});

test('adding a new message updates status of existing conversation without clearing other fields',async()=>{
  const store=new MemoryStore();
  await ingest(email({conversation:{status:'AUTOMATED',summary:'Original'}}),store);
  const event=email({message:{externalId:'msg-second',threadId:'thread-1',body:'Necesita seguimiento'},
    conversation:{status:'WAITING_INTERNAL',followUp:'REQUIRED',comments:'Contactar al responsable'}});
  const second=await ingest(event,store);
  assert.equal(second.status,'created');
  const conversation=store.rowsFor('supportCases')[0];
  assert.equal(conversation.status,'WAITING_INTERNAL');
  assert.equal(conversation.summary,'Original');
  assert.equal(conversation.followUp,'REQUIRED');
  assert.equal(conversation.comments,'Contactar al responsable');
  const before=store.writes.length;
  assert.equal((await ingest(event,store)).status,'duplicate');
  assert.equal(store.writes.length,before);
});

test('category codes are resolved in the workspace and unknown codes auto-create',async()=>{
  const store=new MemoryStore();
  const categoryId='1e419c4a-6b99-4a69-8ea4-4d5d26a1c17a';
  store.rows.set('supportCategories',[{id:categoryId,code:'WELCOME',enabled:true}]);
  await ingest(email({conversation:{categoryCode:'WELCOME'}}),store);
  assert.equal(store.rowsFor('supportCases')[0].categoryId,categoryId);
  const other=email({message:{externalId:'msg-other',threadId:'thread-1',body:'Hola'},
    conversation:{categoryCode:'UNKNOWN'}});
  await ingest(other, store);
  const created = store.rowsFor('supportCategories').find(row => row.code === 'UNKNOWN');
  assert(created);
  assert.equal(created.name, 'UNKNOWN');
  assert.equal(created.enabled, true);
  assert.equal(store.rowsFor('supportCases')[0].categoryId, created.id);
  assert.equal(store.rowsFor('supportMessages').length, 2);
});

test('phone call events preserve secure recording URLs and transcripts',async()=>{
  const store=new MemoryStore('PHONE');
  const event=normalizeEvent({
    channelCode:'phone-test',channelType:'PHONE',provider:'voip',accountId:'line-1',
    contact:{externalId:'caller-123',name:'Alex'},
    message:{externalId:'call-1',issueKey:'call-thread-1',body:'Llamada',callTranscription:'Buenos días',callRecordingUrl:'https://recordings.example.com/clip-1'},
    conversation:{status:'INFORMATIONAL',transcription:'Buenos días',recordingUrl:'https://recordings.example.com/clip-1'},
  });
  await ingest(event,store);
  assert.equal(store.rowsFor('supportCases')[0].status,'INFORMATIONAL');
  assert.equal(store.rowsFor('supportCases')[0].recording.primaryLinkUrl,'https://recordings.example.com/clip-1');
  assert.equal(store.rowsFor('supportMessages')[0].callTranscription,'Buenos días');
  assert.equal(store.rowsFor('supportMessages')[0].callRecording.primaryLinkUrl,'https://recordings.example.com/clip-1');
});
test('invalid status and non-HTTPS recordings are rejected before CRM writes',()=>{
  assert.throws(()=>email({conversation:{status:'NOT_A_STATUS'}}),e=>e instanceof IngestError);
  assert.throws(()=>email({conversation:{recordingUrl:'http://localhost:8080/private'}}),e=>e instanceof IngestError&&e.code==='INVALID_RECORDING_URL');
  assert.throws(()=>email({conversation:{categoryId:'not-a-uuid'}}),e=>e instanceof IngestError&&e.code==='INVALID_CATEGORY');
  assert.throws(()=>email({eventType:'message.status',message:{externalId:'provider-message-1',deliveryStatus:'SENT'},conversation:{status:'CLOSED'}}),
    e=>e instanceof IngestError&&e.code==='CONVERSATION_ON_DELIVERY_EVENT');
});
test('no identity-safe conversation can be silently marked informational during mandatory review',async()=>{
  const store=new MemoryStore();
  const result=await ingest(normalizeEvent({channelCode:'email-test',channelType:'EMAIL',
    accountId:'support@example.com',provider:'gmail',message:{externalId:'no-contact',body:'sin persona'},
    conversation:{status:'INFORMATIONAL'}}),store);
  assert.equal(result.reviewRequired,true);
  assert.equal(store.rowsFor('supportCases')[0].status,'HUMAN_REQUIRED');
});

test('structured surnames are saved in Twenty native Person name field', async () => {
  const store = new MemoryStore();
  await ingest(email({ contact: {
    email: 'client@example.com', firstName: 'María del Mar', lastName: 'García López',
  } }), store);
  assert.deepEqual(store.rowsFor('people')[0].name, { firstName: 'María del Mar', lastName: 'García López' });
});

test('verified existing Person receives missing surname without overwriting curated names', async () => {
  const store = new MemoryStore();
  store.rows.set('people', [{
    id: 'person-1', emails: { primaryEmail: 'client@example.com' },
    name: { firstName: 'Alex', lastName: '' },
  }]);
  await ingest(email({ contact: {
    email: 'client@example.com', firstName: 'Alexander', lastName: 'Pérez',
  } }), store);
  assert.deepEqual(store.rowsFor('people')[0].name, { firstName: 'Alex', lastName: 'Pérez' });
  await ingest(email({ message: {
    externalId: 'message-2', threadId: 'thread-1', body: 'Otro mensaje',
  }, contact: {
    email: 'client@example.com', firstName: 'Alexander', lastName: 'Otro Apellido',
  } }), store);
  assert.equal(store.rowsFor('people')[0].name.lastName, 'Pérez');
});

test('existing linked Person can be enriched during an idempotent replay', async () => {
  const store = new MemoryStore();
  await ingest(email({ contact: {email: 'client@example.com', name: 'Alex'} }), store);
  const retry = await ingest(email({contact: {
    email: 'client@example.com', firstName: 'Alex', lastName: 'Soler',
  }}), store);
  assert.equal(retry.status, 'duplicate');
  assert.equal(store.rowsFor('people')[0].name.lastName, 'Soler');
  assert.equal(store.rowsFor('supportMessages').length, 1);
});

test('telephone recordings automatically appear on the case as well as on the message', async () => {
  const store = new MemoryStore('PHONE');
  await ingest(normalizeEvent({
    channelCode: 'phone-test', channelType: 'PHONE', provider: 'voip', accountId: 'line-1',
    contact: {externalId: 'call-contact-1'},
    message: {
      externalId: 'call-5', issueKey: 'call-5', callTranscription: 'Hola',
      callRecordingUrl: 'https://audio.example.com/5.mp3',
    },
  }), store);
  assert.equal(store.rowsFor('supportCases')[0].recording.primaryLinkUrl, 'https://audio.example.com/5.mp3');
  assert.equal(store.rowsFor('supportMessages')[0].callRecording.primaryLinkUrl, 'https://audio.example.com/5.mp3');
  assert.equal(store.rowsFor('supportCases')[0].transcription, 'Hola');
  assert.equal(store.rowsFor('supportMessages')[0].body, 'Llamada entrante');
});

test('a duplicate event from a different contact cannot inject surnames into the linked Person', async () => {
  const store = new MemoryStore();
  await ingest(email({contact: {email: 'client@example.com', firstName: 'Alex'}}), store);
  const duplicate = await ingest(email({contact: {
    email: 'attacker@example.com', firstName: 'Unrelated', lastName: 'Injected',
  }}), store);
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(store.rowsFor('people')[0].name.lastName, '');
  assert.equal(store.rowsFor('supportMessages').length, 1);
});

test('a Person without complete native name representation is never overwritten by enrichment', async () => {
  const store = new MemoryStore();
  store.rows.set('people', [{
    id: 'person-partial', emails: {primaryEmail: 'client@example.com'},
    name: {firstName: 'Protected'},
  }]);
  await ingest(email({contact: {
    email: 'client@example.com', firstName: 'Other', lastName: 'New',
  }}),store);
  assert.deepEqual(store.rowsFor('people')[0].name,{firstName:'Protected'});
});

const chatEvent = (id, options = {}) => normalizeEvent({
  channelCode: 'wa-test',
  channelType: 'WHATSAPP',
  provider: 'evolution',
  accountId: 'wa-1',
  contact: {
    externalId: options.userId ?? '34600111222@s.whatsapp.net',
    ...(options.email ? {email: options.email, phone: options.phone ?? '+34600111222', verified: true} : {}),
  },
  message: {
    externalId: id,
    direction: options.direction ?? 'INBOUND',
    body: 'message ' + id,
    occurredAt: options.at ?? '2026-11-16T12:00:00Z',
    ...(options.issueKey ? {issueKey: options.issueKey} : {}),
  },
  conversation: {
    status: options.status ?? 'IN_PROGRESS',
    ...(options.followUp ? {followUp: options.followUp} : {}),
  },
});

test('HYBRID automatically continues a WhatsApp conversation and applies the new status', async () => {
  const store = new MemoryStore('WHATSAPP');
  const first = await ingest(chatEvent('welcome-1', {
    direction:'OUTBOUND', status:'AUTOMATED', issueKey:'standalone-auto:welcome-1',
  }), store);
  const reply = await ingest(chatEvent('reply-1', {
    at:'2026-11-16T13:00:00Z', status:'IN_PROGRESS', followUp:'REQUIRED',
  }), store);
  assert.equal(reply.caseId, first.caseId);
  assert.equal(store.rowsFor('supportCases').length, 1);
  assert.equal(store.rowsFor('supportMessages').length, 2);
  assert.equal(store.rowsFor('supportCases')[0].status, 'IN_PROGRESS');
  assert.equal(store.rowsFor('supportCases')[0].followUp, 'REQUIRED');
});

test('a subsequent automated notice can reuse a recent case even with a different synthetic issueKey', async () => {
  const store = new MemoryStore('WHATSAPP');
  const first = await ingest(chatEvent('welcome-1', {
    direction:'OUTBOUND', status:'AUTOMATED', issueKey:'standalone-auto:welcome-1',
  }),store);
  const second = await ingest(chatEvent('notice-2', {
    at:'2026-11-16T13:00:00Z', direction:'OUTBOUND', status:'AUTOMATED',
    issueKey:'standalone-auto:notice-2',
  }),store);
  assert.equal(first.caseId, second.caseId);
  assert.equal(store.rowsFor('supportCases').length,1);
});

test('automatic grouping does not mix different WhatsApp identities', async () => {
  const store = new MemoryStore('WHATSAPP');
  const first = await ingest(chatEvent('a1'),store);
  const second = await ingest(chatEvent('b1',{userId:'34600999888@s.whatsapp.net',at:'2026-11-16T13:00:00Z'}),store);
  assert.notEqual(first.caseId,second.caseId);
  assert.equal(store.rowsFor('supportCases').length,2);
});

test('an expired activity window starts a fresh conversation', async () => {
  const store = new MemoryStore('WHATSAPP');
  const first = await ingest(chatEvent('a1'),store);
  const second = await ingest(chatEvent('a2',{at:'2026-11-21T12:00:00Z'}),store);
  assert.notEqual(first.caseId,second.caseId);
});

test('a verified contact can safely recover a legacy unlinked case by matching email and phone', async () => {
  const store = new MemoryStore('WHATSAPP');
  store.rows.set('people',[{id:'known-1',emails:{primaryEmail:'client@example.com'},name:{firstName:'Alex',lastName:''}}]);
  const old = await ingest(chatEvent('old-message',{userId:'',email:undefined,status:'AUTOMATED'}),store);
  // Simulate an older case created without a recognized identity.
  const stored = store.rowsFor('supportCases')[0];
  delete stored.externalIdentityId;
  delete stored.personId;
  stored.originEmail='client@example.com';
  stored.originPhone='+34600111222';
  const result = await ingest(chatEvent('new-message',{email:'client@example.com',at:'2026-11-16T13:00:00Z'}),store);
  assert.equal(result.caseId,old.caseId);
  assert.equal(stored.personId,'known-1');
});

test('ambiguous multiple open WhatsApp cases require review rather than choosing arbitrarily', async () => {
  const store = new MemoryStore('WHATSAPP');
  const first = await ingest(chatEvent('case-1',{issueKey:'topic-1'}),store);
  const second = await ingest(chatEvent('case-2',{issueKey:'topic-2',at:'2026-11-16T12:30:00Z'}),store);
  assert.notEqual(first.caseId,second.caseId);
  const incoming = await ingest(chatEvent('case-3',{at:'2026-11-16T13:00:00Z'}),store);
  assert.equal(incoming.reviewRequired,true);
  assert.equal(store.rowsFor('supportCases').length,3);
  assert.equal(store.rowsFor('supportCases')[2].status,'HUMAN_REQUIRED');
});

test('resolved conversation is reopened within the configured window, but CLOSED is not', async () => {
  const store = new MemoryStore('WHATSAPP');
  const first = await ingest(chatEvent('case-1',{status:'RESOLVED'}),store);
  const second = await ingest(chatEvent('case-2',{status:'IN_PROGRESS',at:'2026-11-16T13:00:00Z'}),store);
  assert.equal(second.caseId,first.caseId);
  const third = await ingest(chatEvent('case-3',{status:'CLOSED',at:'2026-11-16T14:00:00Z'}),store);
  assert.equal(third.caseId,first.caseId);
  const fourth = await ingest(chatEvent('case-4',{status:'IN_PROGRESS',at:'2026-11-16T15:00:00Z'}),store);
  assert.notEqual(fourth.caseId,first.caseId);
});

test('duplicate WhatsApp delivery retries never rewrite a newer conversation status', async () => {
  const store = new MemoryStore('WHATSAPP');
  await ingest(chatEvent('a1',{status:'AUTOMATED'}),store);
  await ingest(chatEvent('a2',{status:'IN_PROGRESS',at:'2026-11-16T13:00:00Z'}),store);
  const duplicated = await ingest(chatEvent('a1',{status:'CLOSED'}),store);
  assert.equal(duplicated.status,'duplicate');
  assert.equal(store.rowsFor('supportCases')[0].status,'IN_PROGRESS');
});

test('outbound WhatsApp E.164 phone and inbound PN JID resolve the same identity and conversation', async () => {
  const store = new MemoryStore('WHATSAPP');
  const sent = normalizeEvent({
    channelCode:'wa-test',channelType:'WHATSAPP',provider:'evolution',accountId:'wa-1',
    contact:{phone:'+34600111222'},
    eventType:'message.sent',
    message:{externalId:'out-1',body:'Bienvenida',occurredAt:'2026-11-16T12:00:00Z'},
    conversation:{status:'AUTOMATED'},
  });
  assert.equal(sent.externalUserId,'34600111222@s.whatsapp.net');
  const first = await ingest(sent,store);
  const received = await ingest(chatEvent('reply-2',{
    userId:'34600111222@s.whatsapp.net',at:'2026-11-16T13:00:00Z',
  }),store);
  assert.equal(received.caseId,first.caseId);
});

test('a malformed or unverified phone is not used as a WhatsApp identity', () => {
  const raw = {channelCode:'wa-test',channelType:'WHATSAPP',
    contact:{phone:'600 111 222'},message:{externalId:'x',body:'Hola'}};
  const event = normalizeEvent(raw);
  assert.equal(event.externalUserId,'');
});

const personA = 'f00652fc-1ae5-47b2-82be-3d6cac124db1';
const personB = 'c660b579-6847-448d-8cc5-578a925c71cf';
const directChat = (messageId, extra = {}) => whatsapp({ routingMode: 'CHAT', messageId, ...extra });

test('CHAT converges on one WhatsApp history for concurrent inbound/outbound and PN/LID aliases', async () => {
  const store = new MemoryStore('WHATSAPP');
  store.rowsFor('supportChannels')[0].groupingMode = 'MESSAGE';
  const [sent, received] = await Promise.all([
    ingest(directChat('outgoing', {
      eventType: 'message.sent', externalUserId: undefined,
      remoteJid: '34600111222@s.whatsapp.net', remoteJidAlt: '2323232323@lid',
    }), store),
    ingest(directChat('incoming', { externalUserId: undefined, occurredAt: '2027-01-01T12:00:00Z' }), store),
  ]);
  assert.equal(sent.reviewRequired, false);
  assert.equal(received.reviewRequired, false);
  assert.equal(sent.caseId, received.caseId);
  assert.equal(sent.identityId, received.identityId);
  const [history] = store.rowsFor('supportCases');
  assert.equal(history.lastMessageAt, '2027-01-01T12:00:00.000Z');
  history.status = 'CLOSED';
  const lidOnly = directChat('after-close', {
    externalUserId: '2323232323@lid', remoteJid: '', remoteJidAlt: '', occurredAt: '2027-06-01T00:00:00Z',
  });
  assert.equal((await ingest(lidOnly, store)).caseId, sent.caseId);
  assert.equal(history.status, 'CLOSED');
  assert.equal((await ingest(lidOnly, store)).reviewRequired, false);
  assert.equal(store.rowsFor('supportMessages').length, 3);
  assert.equal(store.rowsFor('supportCases').length, 1);
});

test('CHAT keeps Telegram and Instagram direct histories across closed cases and account changes', async () => {
  for (const channelType of ['TELEGRAM', 'INSTAGRAM']) {
    const store = new MemoryStore(channelType);
    store.rowsFor('supportChannels')[0].externalIdentifier = '';
    const event = (id, accountId, user) => normalizeEvent({ channelCode: 'wa-test', channelType,
      accountId, routingMode: 'CHAT', messageId: id, contact: { externalId: user } });
    const first = await ingest(event('message-1', 'account-a', 'customer'), store);
    store.rowsFor('supportCases')[0].status = 'CLOSED';
    assert.equal((await ingest(event('message-2', 'account-a', 'customer'), store)).caseId, first.caseId);
    assert.notEqual((await ingest(event('message-1', 'account-b', 'customer'), store)).caseId, first.caseId);
    assert.notEqual((await ingest(event('message-3', 'account-a', 'someone-else'), store)).caseId, first.caseId);
  }
});

test('CHAT adopts a single scoped legacy case, including the historical wa-chat issue key', async () => {
  for (const issueKey of ['', 'standalone-auto:old', 'wa-chat:34600111222@s.whatsapp.net']) {
    const store = new MemoryStore('WHATSAPP');
    const old = await ingest(chatEvent('old', { issueKey, status: 'CLOSED' }), store);
    // The old integration sent only the PN as externalId. Now the LID arrives with that PN as its alternate.
    const next = await ingest(directChat('new', { externalUserId: undefined, occurredAt: '2027-06-01T00:00:00Z' }), store);
    assert.equal(next.reviewRequired, false);
    assert.equal(next.caseId, old.caseId, issueKey);
    assert.equal(next.identityId, old.identityId);
    if (issueKey) {
      assert.equal((await ingest(chatEvent('old-node', { issueKey }), store)).caseId, old.caseId);
    }
  }
});

test('CHAT preserves explicit topic, thread and reply routing and excludes them from automatic history', async () => {
  const store = new MemoryStore('WHATSAPP');
  const named = await ingest(directChat('topic', { issueKey: 'order-123' }), store);
  const wrongJid = await ingest(directChat('other-topic', { issueKey: 'wa-chat:90000999@lid' }), store);
  const thread = await ingest(directChat('thread', { threadId: 'thread-123' }), store);
  assert.notEqual(thread.caseId, named.caseId);
  assert.equal((await ingest(directChat('same-thread', { threadId: 'thread-123' }), store)).caseId, thread.caseId);
  const normal = await ingest(directChat('direct'), store);
  assert.equal(normal.reviewRequired, false);
  for (const explicit of [named, wrongJid, thread]) assert.notEqual(explicit.caseId, normal.caseId);
  assert.equal((await ingest(directChat('reply', { replyToMessageId: 'topic' }), store)).caseId, named.caseId);
  assert.equal((await ingest(directChat('ref', { caseId: named.caseId }), store)).caseId, named.caseId);
});

test('CHAT sends ambiguous scoped legacy histories to review even when the channel prefers NEW', async () => {
  const store = new MemoryStore('WHATSAPP');
  Object.assign(store.rowsFor('supportChannels')[0], { groupingMode: 'MESSAGE', ambiguousAction: 'NEW' });
  const first = await ingest(whatsapp({ messageId: 'legacy-a' }), store);
  const second = await ingest(whatsapp({ messageId: 'legacy-b' }), store);
  const incoming = directChat('unassigned');
  const result = await ingest(incoming, store);
  assert.equal(result.reviewRequired, true);
  assert(![first.caseId, second.caseId].includes(result.caseId));
  assert.equal((await store.get('supportCases', result.caseId)).status, 'HUMAN_REQUIRED');
  assert.equal((await ingest(incoming, store)).reviewRequired, true);
});

test('CHAT ignores unverified contact email and phone alone when identifying a WhatsApp chat', async () => {
  const store = new MemoryStore('WHATSAPP');
  const known = await ingest(directChat('known'), store);
  const other = await ingest(directChat('anonymous', {
    externalUserId: undefined, remoteJid: '', remoteJidAlt: '',
    contact: { phone: '+34600111222', email: 'customer@example.com' },
  }), store);
  assert.equal(other.reviewRequired, true);
  assert.equal(other.identityId, null);
  assert.notEqual(other.caseId, known.caseId);
});

test('CHAT rejects delivery key collisions across identities or channels, including concurrent messages', async () => {
  const otherPerson = { externalUserId: '777@lid', remoteJid: '777@lid', remoteJidAlt: '' };
  const store = new MemoryStore('WHATSAPP');
  const attempts = await Promise.allSettled([
    ingest(directChat('collision'), store), ingest(directChat('collision', otherPerson), store),
  ]);
  assert.equal(attempts.filter(attempt => attempt.status === 'rejected' && attempt.reason.code === 'MESSAGE_CONFLICT').length, 1);
  const winningCase = await store.get('supportCases', store.rowsFor('supportMessages')[0].supportCaseId);
  const identity = await store.get('supportExternalIdentities', winningCase.externalIdentityId);
  const loser = identity.externalUserId === '777@lid' ? {} : otherPerson;
  await assert.rejects(ingest(directChat('collision', loser), store), { code: 'MESSAGE_CONFLICT' });
  store.rowsFor('supportChannels').push({ ...store.rowsFor('supportChannels')[0], id: 'channel-2', code: 'other' });
  await assert.rejects(ingest(directChat('collision', { channelCode: 'other' }), store), { code: 'MESSAGE_CONFLICT' });
});

test('concurrent CHAT ID collisions leave the losing existing case and its last activity intact', async () => {
  const store = new MemoryStore('WHATSAPP');
  const other = { externalUserId: '777@lid', remoteJid: '777@lid', remoteJidAlt: '' };
  const histories = [await ingest(directChat('initial-a'), store), await ingest(directChat('initial-b', other), store)];
  const update = { occurredAt: '2027-01-01T00:00:00Z', conversation: { status: 'CLOSED', comments: 'update' } };
  const attempts = await Promise.allSettled([ingest(directChat('collide', update), store),
    ingest(directChat('collide', { ...other, ...update }), store)]);
  const loserIndex = attempts.findIndex(attempt => attempt.status === 'rejected');
  assert.notEqual(loserIndex, -1);
  assert.equal(attempts[loserIndex].reason.code, 'MESSAGE_CONFLICT');
  const losingCase = await store.get('supportCases', histories[loserIndex].caseId);
  assert.equal(losingCase.status, 'NEW');
  assert.equal(losingCase.comments, undefined);
  assert.equal(losingCase.lastMessageAt, '2026-11-16T12:00:00.000Z');
});

test('CHAT retries an interrupted case update and finishes the original stored message', async () => {
  const store = new MemoryStore('WHATSAPP');
  const initial = await ingest(directChat('first'), store);
  const update = store.update.bind(store);
  store.update = async (resource, id, data) => {
    if (resource === 'supportCases') throw Error('interrupted case update');
    return update(resource, id, data);
  };
  const event = directChat('update', { conversation: { status: 'CLOSED' } });
  await assert.rejects(ingest(event, store), /interrupted case update/);
  const stored = store.rowsFor('supportMessages').find(row => row.providerMessageId === 'update');
  assert.ok(stored);
  store.update = update;
  const complete = await ingest(event, store);
  assert.equal(complete.messageId, stored.id);
  assert.equal(stored.supportCaseId, initial.caseId);
  assert.equal((await store.get('supportCases', initial.caseId)).status, 'CLOSED');
});

test('simultaneous verified CHAT contacts never replace an existing Person link for an identity', async () => {
  const store = new MemoryStore('WHATSAPP');
  store.rows.set('people', [{ id: personA }, { id: personB }]);
  const events = [personA, personB].map(id => directChat('msg-' + id, { contact: { personId: id, verified: true } }));
  const results = await Promise.all(events.map(event => ingest(event, store)));
  assert.equal(results.filter(value => value.reviewRequired).length, 1);
  const accepted = results.find(value => !value.reviewRequired);
  assert.equal((await store.get('supportExternalIdentities', accepted.identityId)).personId, accepted.personId);
  assert.equal((await store.get('supportCases', accepted.caseId)).personId, accepted.personId);
});

test('a pending CHAT message rejects changed routing and preserves newer metadata when finishing its original case link', async () => {
  const store = new MemoryStore('WHATSAPP');
  const base = await ingest(directChat('original'), store);
  const linkMessage = store.linkMessageIfMissing.bind(store);
  store.linkMessageIfMissing = async () => { throw Error('link failed'); };
  const older = directChat('pending', { conversation: { status: 'IN_PROGRESS' }, occurredAt: '2027-01-01T12:00:00Z' });
  await assert.rejects(ingest(older, store), /link failed/);
  store.linkMessageIfMissing = linkMessage;
  await assert.rejects(ingest(directChat('pending', { issueKey: 'other-case' }), store), { code: 'MESSAGE_CONFLICT' });
  await ingest(directChat('newer', { occurredAt: '2027-01-02T12:00:00Z', conversation: { status: 'CLOSED' } }), store);
  assert.equal((await ingest(older, store)).caseId, base.caseId);
  assert.equal((await store.get('supportCases', base.caseId)).status, 'CLOSED');
});

test('a completed CHAT replay with a conflicting verified Person is flagged before it can repair or enrich a case', async () => {
  const store = new MemoryStore('WHATSAPP');
  store.rows.set('people', [{ id: personA }, { id: personB }]);
  const contact = personId => ({ verified: true, personId });
  const first = await ingest(directChat('person', { contact: contact(personA) }), store);
  const replay = await ingest(directChat('person', { contact: contact(personB) }), store);
  assert.equal(replay.reviewRequired, true);
  assert.equal((await store.get('supportCases', first.caseId)).personId, personA);
  const history = await store.get('supportCases', first.caseId);
  delete history.personId;
  assert.equal((await ingest(directChat('person', { contact: contact(personB) }), store)).reviewRequired, true);
  assert.equal(history.personId, undefined);
});

test('CHAT rejects unsupported routing modes and channel types', async () => {
  assert.throws(() => whatsapp({ routingMode: 'CHTA' }), { code: 'INVALID_ROUTING_MODE' });
  await assert.rejects(ingest(email({ routingMode: 'CHAT' }), new MemoryStore()), { code: 'INVALID_ROUTING_MODE' });
  const group = normalizeEvent({ channelCode: 'wa-test', routingMode: 'CHAT', contact: { externalId: '-10012345' } });
  await assert.rejects(ingest(group, new MemoryStore('TELEGRAM')), { code: 'UNSUPPORTED_GROUP' });
});

test('correctable CHAT catalog and verified Person errors leave the provider message ID available', async () => {
  const missing = 'd96bd6c7-5135-45ec-8a88-e19e9223e7fd';
  for (const [fields, code] of [
    [{ conversation: { categoryId: missing } }, 'UNKNOWN_CATEGORY'],
    [{ conversation: { typeId: missing } }, 'UNKNOWN_TYPE'],
    [{ conversation: { categoryCode: 'RETIRED' } }, 'UNKNOWN_CATEGORY'],
    [{ contact: { personId: missing, verified: true } }, 'UNKNOWN_PERSON'],
    [{ contact: { personId: 'mistyped', verified: true } }, 'INVALID_PERSON'],
  ]) {
    const store = new MemoryStore('WHATSAPP');
    store.rows.set('supportCategories', [{ id: 'disabled', code: 'RETIRED', enabled: false }]);
    await assert.rejects(ingest(directChat('correct-me', fields), store), { code });
    assert.equal(store.rowsFor('supportMessages').length, 0);
    assert.equal(store.rowsFor('supportExternalIdentities').length, 0);
    const fixed = await ingest(directChat('correct-me', { conversation: { categoryCode: 'ACTIVE' } }), store);
    assert.equal(fixed.status, 'created');
    assert.equal(store.rowsFor('supportMessages').length, 1);
  }
});

test('CHAT checks conflicting alias evidence on both new messages and retries', async () => {
  const store = new MemoryStore('WHATSAPP');
  const first = await ingest(directChat('pn'), store);
  const bad = { externalUserId: '990000@s.whatsapp.net' };
  const review = await ingest(directChat('new', bad), store);
  assert.equal(review.reviewRequired, true);
  assert.notEqual(review.caseId, first.caseId);
  await assert.rejects(ingest(directChat('pn', bad), store), { code: 'MESSAGE_CONFLICT' });
});

test('CHAT retries a per-message review after a partial write with a verified Person and no provider ID', async () => {
  const store = new MemoryStore('WHATSAPP');
  store.rows.set('people', [{ id: personA, emails: { primaryEmail: 'client@example.com' } }]);
  const event = directChat('needs-review', { externalUserId: '', remoteJid: '', remoteJidAlt: '',
    contact: { personId: personA, verified: true } });
  const create = store.create.bind(store);
  store.create = async (type, data) => {
    if (type === 'supportMessages') throw Error('temporary write failure');
    return create(type, data);
  };
  await assert.rejects(ingest(event, store), /temporary write failure/);
  store.create = create;
  const recovered = await ingest(event, store);
  assert.equal(recovered.reviewRequired, true);
  assert.equal(store.rowsFor('supportCases').length, 1);
  assert.equal(store.rowsFor('supportMessages').length, 1);
});

test('CHAT honors the provider and account of explicit references and append to a canonical chat', async () => {
  const store = new MemoryStore('WHATSAPP');
  const first = await ingest(directChat('scoped'), store);
  const row = await store.get('supportCases', first.caseId);
  const otherScope = 'WHATSAPP:other-provider:wa-1';
  assert.match(row.externalKey, /^WHATSAPP:evolution:wa-1:CHAT:/);
  row.id = '01234567-0000-0000-0000-abcdefabcdef';
  store.rowsFor('supportChannels')[0].provider = '';
  await assert.rejects(ingestion.appendMessage({ caseId: row.id, provider: 'other-provider',
    message: { externalId: 'other-scope' } }, store), { code: 'CASE_SCOPE_MISMATCH' });
  row.externalKey = otherScope + ':CASE-MESSAGE:historical';
  const explicit = await ingest(directChat('wrong-history', { caseId: row.id }), store);
  assert.equal(explicit.reviewRequired, true);
  assert.notEqual(explicit.caseId, row.id);
});

const namedChat = (id, contact = {}, extra = {}) => directChat(id, { createPersonFromChat: true,
  contact: { firstName: 'Anna Maria', lastName: 'Soler Puig', ...contact }, ...extra });

test('named CHAT creates one native Person per provider identity across simultaneous messages and aliases', async () => {
  const store = new MemoryStore('WHATSAPP');
  store.rows.set('people', [{ id: 'unrelated', name: { firstName: 'Anna Maria', lastName: 'Soler Puig' },
    emails: { primaryEmail: 'unconfirmed@example.com' } }]);
  const [a, b] = await Promise.all([
    ingest(namedChat('first', { email: 'unconfirmed@example.com' }), store),
    ingest(namedChat('second', {}, { externalUserId: '2323232323@lid' }), store),
  ]);
  assert.match(a.personId ?? '', /^[\da-f]{8}-[\da-f]{4}-5[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  assert.equal(a.personId, b.personId);
  assert.equal(store.rowsFor('people').length, 2);
  const person = await store.get('people', a.personId);
  assert.deepEqual(person.name, { firstName: 'Anna Maria', lastName: 'Soler Puig' });
  assert.equal(person.emails, undefined);
  assert.equal((await store.get('supportExternalIdentities', a.identityId)).personId, a.personId);
  assert.equal((await store.get('supportCases', a.caseId)).personId, a.personId);
  assert.equal((await ingest(namedChat('first', { email: 'unconfirmed@example.com' }), store)).personId, a.personId);
});

test('named CHAT can link a previously stored message on replay without replacing curated names', async () => {
  const store = new MemoryStore('WHATSAPP');
  const original = await ingest(directChat('existing'), store);
  assert.equal(original.personId, null);
  const updated = await ingest(namedChat('existing'), store);
  assert.equal(updated.status, 'duplicate');
  assert.ok(updated.personId);
  assert.equal(updated.caseId, original.caseId);
  const person = await store.get('people', updated.personId);
  person.name = { firstName: 'Curated', lastName: 'CRM surname' };
  assert.equal((await ingest(namedChat('later'), store)).personId, updated.personId);
  assert.deepEqual(person.name, { firstName: 'Curated', lastName: 'CRM surname' });
});

test('named CHAT reuses the Person created before a failed identity link', async () => {
  const store = new MemoryStore('WHATSAPP');
  const link = store.linkPersonIfMissing.bind(store);
  store.linkPersonIfMissing = async () => { throw Error('write interrupted'); };
  const event = namedChat('partial');
  await assert.rejects(ingest(event, store), /write interrupted/);
  const [saved] = store.rowsFor('people');
  assert.ok(saved);
  store.linkPersonIfMissing = link;
  assert.equal((await ingest(event, store)).personId, saved.id);
  assert.equal(store.rowsFor('people').length, 1);
});

test('named CHAT stores a verified new email on the same deterministic Person across concurrent requests', async () => {
  const store = new MemoryStore('WHATSAPP');
  const contact = { email: 'verified@example.com', verified: true };
  const [a, b] = await Promise.all([ingest(namedChat('one', contact), store), ingest(namedChat('two', contact), store)]);
  assert.match(a.personId, /^[\da-f]{8}-[\da-f]{4}-5/);
  assert.equal(a.personId, b.personId);
  assert.equal(store.rowsFor('people').length, 1);
  assert.equal((await store.get('people', a.personId)).emails.primaryEmail, contact.email);
});

test('named CHAT waits for a clear routing decision before creating a Person for a new verified email', async () => {
  const store = new MemoryStore('WHATSAPP');
  store.rowsFor('supportChannels')[0].groupingMode = 'MESSAGE';
  await ingest(whatsapp({ messageId: 'old1' }), store);
  await ingest(whatsapp({ messageId: 'old2' }), store);
  const review = await ingest(namedChat('ambiguous', { email: 'verified@example.com', verified: true }), store);
  assert.equal(review.reviewRequired, true);
  assert.equal(store.rowsFor('people').length, 0);
});

test('named CHAT respects existing verified IDs, email matches, and a concurrently curated identity link', async () => {
  const store = new MemoryStore('WHATSAPP');
  store.rows.set('people', [{ id: personA, emails: { primaryEmail: 'known@example.com' },
    name: { firstName: 'Chosen', lastName: 'Surname' } }]);
  const link = store.linkPersonIfMissing.bind(store);
  store.linkPersonIfMissing = async (resource, id, personId) => {
    if (resource === 'supportExternalIdentities') (await store.get(resource, id)).personId = personA;
    await link(resource, id, personId);
  };
  assert.equal((await ingest(namedChat('race'), store)).personId, personA);
  assert.equal((await ingest(namedChat('verified', { verified: true, email: 'known@example.com' }), store)).personId, personA);
  assert.equal((await ingest(namedChat('verified-id', { verified: true, personId: personA }), store)).personId, personA);
  assert.deepEqual(store.rowsFor('people')[0].name, { firstName: 'Chosen', lastName: 'Surname' });
});

test('named CHAT requires opt-in, structured names and unambiguous provider identity', async () => {
  assert.throws(() => whatsapp({ createPersonFromChat: true }), { code: 'INVALID_CHAT_PERSON' });
  assert.throws(() => directChat('flag', { createPersonFromChat: 'true' }), { code: 'INVALID_CHAT_PERSON' });
  const store = new MemoryStore('WHATSAPP');
  await ingest(directChat('no-opt-in', { contact: { firstName: 'Anna' } }), store);
  await ingest(namedChat('nameless', { firstName: '', lastName: '', name: 'Display name' }), store);
  await ingest(namedChat('no-provider', {}, { externalUserId: '', remoteJid: '', remoteJidAlt: '' }), store);
  await ingest(namedChat('conflict', {}, { externalUserId: '777@s.whatsapp.net' }), store);
  assert.equal(store.rowsFor('people').length, 0);
});

test('the Twenty REST chat Person link only writes when the same record still has a null personId', async () => {
  const calls = [];
  const store = new TwentyRestIngestionStore({ async patch(...args) { calls.push(args); } });
  const id = '7bea301b-7409-4214-912e-a3e949ebd614';
  const personId = '45461215-05ac-598e-b6cd-d9975c829a05';
  for (const resource of ['supportExternalIdentities', 'supportCases']) {
    await store.linkPersonIfMissing(resource, id, personId);
    assert.deepEqual(calls.at(-1), ['/rest/' + resource, { personId },
      { query: { filter: 'and(id[eq]:"' + id + '",personId[is]:NULL)' } }]);
  }
});


test('all editable metadata can be set on creation and patched on a later message', async () => {
  const store = new MemoryStore();
  const typeId = '9c71777d-6a38-4bcb-83c1-2e5b5009b699';
  const categoryId = '1e419c4a-6b99-4a69-8ea4-4d5d26a1c17a';
  store.rows.set('supportTypes', [{ id: typeId, code: 'CONSULTA', enabled: true }]);
  store.rows.set('supportCategories', [{ id: categoryId, code: 'GENERAL', enabled: true }]);
  await ingest(email({ conversation: {
    subject: 'Pedido', typeCode: 'CONSULTA', categoryCode: 'GENERAL', tags: ['VIP'],
    customTags: ['campana-verano'], status: 'NEW', resolution: 'PENDING',
    automation: 'NONE', technicalStatus: 'UNKNOWN', assignedTo: 'agente-a',
  }}), store);
  let conversation = store.rowsFor('supportCases')[0];
  assert.equal(conversation.subject, 'Pedido');
  assert.equal(conversation.caseTypeId, typeId);
  assert.equal(conversation.categoryId, categoryId);
  assert.deepEqual(conversation.tags, ['VIP']);
  assert.deepEqual(conversation.customTags, ['campana-verano']);
  await ingest(email({
    message: { externalId: 'msg-2', threadId: 'thread-1', body: 'Nueva información' },
    conversation: {
      subject: 'Pedido urgente', status: 'IN_PROGRESS', tags: ['URGENT', 'VIP'],
      customTags: [], automation: 'PARTIAL', technicalStatus: 'SUCCESS',
    },
  }), store);
  conversation = store.rowsFor('supportCases')[0];
  assert.equal(conversation.subject, 'Pedido urgente');
  assert.equal(conversation.status, 'IN_PROGRESS');
  assert.deepEqual(conversation.tags, ['URGENT', 'VIP']);
  assert.deepEqual(conversation.customTags, []);
  assert.equal(conversation.automation, 'PARTIAL');
  assert.equal(conversation.categoryId, categoryId);
  assert.equal(conversation.caseTypeId, typeId);
  assert.equal(conversation.assignedTo, 'agente-a');
  const writes = store.writes.length;
  const replay = email({
    message: { externalId: 'msg-2', threadId: 'thread-1', body: 'Nueva información' },
    conversation: { subject: 'Título antiguo', tags: [] },
  });
  assert.equal((await ingest(replay, store)).status, 'duplicate');
  assert.equal(store.writes.length, writes);
  assert.equal(store.rowsFor('supportCases')[0].subject, 'Pedido urgente');
});

test('type codes auto-create and type IDs must exist; metadata is nullable', async () => {
  const store = new MemoryStore();
  const id = '9c71777d-6a38-4bcb-83c1-2e5b5009b699';
  store.rows.set('supportTypes', [{ id, code: 'RECLAMACION', enabled: true }]);
  await ingest(email({ conversation: { typeId: id }}), store);
  assert.equal(store.rowsFor('supportCases')[0].caseTypeId, id);
  await ingest(email({ message: { externalId:'msg-3', threadId:'thread-1' }, conversation: { typeId: null } }), store);
  assert.equal(store.rowsFor('supportCases')[0].caseTypeId, null);
  await ingest(email({ message: { externalId:'msg-4', threadId:'thread-1' },
    conversation: { typeCode: 'OTHER' } }),store);
  const created = store.rowsFor('supportTypes').find(row => row.code === 'OTHER');
  assert(created);
  assert.equal(created.name, 'OTHER');
  assert.equal(created.enabled, true);
  assert.equal(store.rowsFor('supportCases')[0].caseTypeId, created.id);
  assert.equal(store.rowsFor('supportMessages').length, 3);
  assert.throws(() => email({ conversation: { typeId: id, typeCode: 'RECLAMACION' } }),
    error => error instanceof IngestError && error.code === 'CONFLICTING_TYPE');
});

test('invalid tags and unknown mutable conversation fields are rejected', () => {
  assert.throws(() => email({conversation:{tags:['BOGUS']}}), error =>
    error instanceof IngestError && error.code === 'INVALID_CONVERSATION_FIELD');
  assert.throws(() => email({conversation:{customTags:['']}}), error =>
    error instanceof IngestError && error.code === 'INVALID_CONVERSATION_FIELD');
  assert.throws(() => email({conversation:{externalKey:'unsafe'}}), error =>
    error instanceof IngestError && error.code === 'UNKNOWN_CONVERSATION_FIELD');
});


test('new category and type codes create records with identical name and code', async () => {
  const store = new MemoryStore();
  await ingest(email({conversation:{categoryCode:'CLIENTES_VERANO',typeCode:'Consulta_Interna'}}),store);
  const category = store.rowsFor('supportCategories')[0];
  const type = store.rowsFor('supportTypes')[0];
  assert.deepEqual({code:category.code,name:category.name,enabled:category.enabled},
    {code:'CLIENTES_VERANO',name:'CLIENTES_VERANO',enabled:true});
  assert.deepEqual({code:type.code,name:type.name,enabled:type.enabled},
    {code:'Consulta_Interna',name:'Consulta_Interna',enabled:true});
  assert.equal(store.rowsFor('supportCases')[0].categoryId,category.id);
  assert.equal(store.rowsFor('supportCases')[0].caseTypeId,type.id);

  await ingest(email({message:{externalId:'second-auto-label',threadId:'thread-1'},
    conversation:{categoryCode:'CLIENTES_VERANO',typeCode:'Consulta_Interna'}}),store);
  assert.equal(store.rowsFor('supportCategories').length,1);
  assert.equal(store.rowsFor('supportTypes').length,1);
  assert.equal(store.rowsFor('supportCases').length,1);
});

test('concurrent catalog creations reuse winning record after unique-index conflict', async () => {
  class RacingStore extends MemoryStore {
    injected = new Set();
    async create(resource, data) {
      if ((resource === 'supportCategories' || resource === 'supportTypes') && !this.injected.has(resource)) {
        this.injected.add(resource);
        // Simulate another worker winning the unique-code insertion between read and create.
        await super.create(resource, data);
        throw Object.assign(new Error('duplicate key value violates unique index'), {status:409});
      }
      return super.create(resource, data);
    }
  }
  const store = new RacingStore();
  await ingest(email({conversation:{categoryCode:'NEW_CATEGORY',typeCode:'NEW_TYPE'}}),store);
  const category = store.rowsFor('supportCategories')[0];
  const type = store.rowsFor('supportTypes')[0];
  assert.equal(store.rowsFor('supportCategories').length,1);
  assert.equal(store.rowsFor('supportTypes').length,1);
  assert.equal(store.rowsFor('supportCases')[0].categoryId,category.id);
  assert.equal(store.rowsFor('supportCases')[0].caseTypeId,type.id);
});

test('disabled catalog entries are not reactivated, and unknown IDs are never created', async () => {
  const store = new MemoryStore();
  store.rows.set('supportCategories',[{id:'disabled-category',code:'INACTIVE_CATEGORY',name:'Curated',enabled:false}]);
  store.rows.set('supportTypes',[{id:'disabled-type',code:'INACTIVE_TYPE',name:'Curated',enabled:false}]);
  await assert.rejects(() => ingest(email({conversation:{categoryCode:'INACTIVE_CATEGORY'}}),store),
    error => error instanceof IngestError && error.code === 'UNKNOWN_CATEGORY');
  await assert.rejects(() => ingest(email({conversation:{typeCode:'INACTIVE_TYPE'}}),store),
    error => error instanceof IngestError && error.code === 'UNKNOWN_TYPE');
  const missing = '9c71777d-6a38-4bcb-83c1-2e5b5009b699';
  await assert.rejects(() => ingest(email({conversation:{categoryId:missing}}),store),
    error => error instanceof IngestError && error.code === 'UNKNOWN_CATEGORY');
  await assert.rejects(() => ingest(email({conversation:{typeId:missing}}),store),
    error => error instanceof IngestError && error.code === 'UNKNOWN_TYPE');
  assert.equal(store.rowsFor('supportCategories').length,1);
  assert.equal(store.rowsFor('supportTypes').length,1);
  assert.equal(store.rowsFor('supportMessages').length,0);
  assert.equal(store.rowsFor('supportCategories')[0].name,'Curated');
});
