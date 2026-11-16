import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, keys, IngestError } from '../src/lib/ingestion/contract.ts';
import { ingest } from '../src/lib/ingestion/processor.ts';
import { serializeFilter } from '../src/lib/ingestion/twenty-rest-store.ts';

class MemoryStore {
  constructor(channelType = 'EMAIL') {
    this.rows = new Map();
    this.id = 0;
    this.rows.set('supportChannels', [{
      id: 'channel-1', code: channelType === 'EMAIL' ? 'email-test' : 'wa-test',
      channelType, provider: channelType === 'EMAIL' ? 'gmail' : 'evolution',
      externalIdentifier: channelType === 'EMAIL' ? 'support@example.com' : 'wa-1',
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
    if (data.externalKey && this.rowsFor(type).some(r => r.externalKey === data.externalKey)) {
      throw Object.assign(new Error('unique index conflict'), { status: 409 });
    }
    this.id++;
    const row = { ...data, id: 'new-' + this.id };
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
