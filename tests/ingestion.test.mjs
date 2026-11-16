import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, keys, IngestError } from '../src/lib/ingestion/contract.ts';
import { readTotalCount } from '../src/lib/overview.ts';
import { ingest } from '../src/lib/ingestion/processor.ts';
import { serializeFilter } from '../src/lib/ingestion/twenty-rest-store.ts';

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

test('categories are validated inside the current workspace before linking conversation',async()=>{
  const store=new MemoryStore();
  const categoryId='1e419c4a-6b99-4a69-8ea4-4d5d26a1c17a';
  store.rows.set('supportCategories',[{id:categoryId,code:'WELCOME',enabled:true}]);
  await ingest(email({conversation:{categoryCode:'WELCOME'}}),store);
  assert.equal(store.rowsFor('supportCases')[0].categoryId,categoryId);
  const other=email({message:{externalId:'msg-other',threadId:'thread-1',body:'Hola'},
    conversation:{categoryCode:'UNKNOWN'}});
  await assert.rejects(()=>ingest(other,store),error=>error instanceof IngestError&&error.code==='UNKNOWN_CATEGORY');
  assert.equal(store.rowsFor('supportMessages').length,1);
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
