import { type IngestEvent, IngestError, keys, type GroupingMode } from './contract.ts';

/** One repository per workspace. Implemented by Twenty's authenticated REST client. */
export type DbRecord = { id: string; [key: string]: unknown };
export type Filter = Record<string, string>;
export interface IngestionStore {
  list(resource: string, filter: Filter, limit?: number): Promise<DbRecord[]>;
  get(resource: string, id: string): Promise<DbRecord | null>;
  create(resource: string, data: Record<string, unknown>): Promise<DbRecord>;
  update(resource: string, id: string, data: Record<string, unknown>): Promise<DbRecord>;
}
export type IngestResult = {
  ok: true;
  status: 'created' | 'duplicate' | 'status_updated';
  channelId: string;
  identityId: string | null;
  personId: string | null;
  caseId: string | null;
  messageId: string;
  reviewRequired: boolean;
  stableId: boolean;
};
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const text = (value: unknown): string => string(value).trim();
const recordId = (value: unknown): string => text(value);
const isOpen = (value: unknown) => ['NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'HUMAN_REQUIRED'].includes(string(value));

function duplicateKey(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: number; message?: string; body?: unknown };
  return e.status === 409 || /unique|duplicate|already exists/i.test(String(e.message ?? '') + JSON.stringify(e.body ?? ''));
}
async function first(store: IngestionStore, resource: string, filter: Filter) {
  const records = await store.list(resource, filter, 2);
  return records[0] ?? null;
}
async function insertUnique(
  store: IngestionStore, resource: string, key: string, data: Record<string, unknown>,
): Promise<{record: DbRecord; created: boolean}> {
  try { return {record: await store.create(resource, data), created: true}; } catch (error) {
    if (!duplicateKey(error)) throw error;
    const existing = await first(store, resource, { externalKey: key });
    if (existing) return {record: existing, created: false};
    throw error;
  }
}
const verifyCase = (candidate: DbRecord | null, channelId: string, identityId: string | null, personId: string | null): boolean => {
  if (!candidate || recordId(candidate.channelInstanceId) !== channelId) return false;
  const associatedIdentity = recordId(candidate.externalIdentityId);
  const associatedPerson = recordId(candidate.personId);
  return !(identityId && associatedIdentity && identityId !== associatedIdentity)
    && !(personId && associatedPerson && personId !== associatedPerson);
};

type PersonResolution = { personId: string | null; review: boolean };
async function personFor(event: IngestEvent, store: IngestionStore, channelType: string): Promise<PersonResolution> {
  if (event.personId && event.personVerified) {
    const person = await store.get('people', event.personId);
    if (!person) throw new IngestError('UNKNOWN_PERSON', 'The supplied verified personId was not found', 409);
    return { personId: person.id, review: false };
  }
  // Transport-derived email is trustworthy for EMAIL. Other channels need an explicit verification signal.
  if (channelType !== 'EMAIL' && !event.personVerified) return { personId: null, review: false };
  const email = event.contactEmail || (channelType === 'EMAIL' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.externalUserId) ? event.externalUserId : '');
  if (!email) return { personId: null, review: false };
  const existing = await store.list('people', { 'emails.primaryEmail': email }, 2);
  if (existing.length > 1) return { personId: null, review: true };
  if (existing[0]) return { personId: existing[0].id, review: false };
  const rawName = event.contactName;
  const space = rawName.indexOf(' ');
  const firstName = space < 0 ? rawName : rawName.slice(0, space);
  const lastName = space < 0 ? '' : rawName.slice(space + 1);
  try {
    const person = await store.create('people', {
      emails: { primaryEmail: email },
      name: { firstName: firstName || '', lastName },
    });
    return { personId: person.id, review: false };
  } catch (error) {
    // An independent execution may have created the same person between read and create.
    if (!duplicateKey(error)) throw error;
    const reread = await store.list('people', { 'emails.primaryEmail': email }, 2);
    if (reread.length === 1) return { personId: reread[0].id, review: false };
    return { personId: null, review: true };
  }
}

async function identityFor(
  event: IngestEvent, store: IngestionStore, scope: ReturnType<typeof keys>, channelId: string,
) {
  const aliasMatches = await Promise.all(scope.aliases.map(a => first(store, 'supportIdentityAliases', { externalKey: a.externalKey })));
  const keyed = scope.identityKey ? await first(store, 'supportExternalIdentities', { externalKey: scope.identityKey }) : null;
  const matches = [...new Set([...aliasMatches.map(a => recordId(a?.externalIdentityId)), recordId(keyed?.id)].filter(Boolean))];
  if (matches.length > 1) return { identityId: null, review: true };
  let identityId = matches[0] || null;
  if (!identityId && scope.identityKey) {
    const { record: created } = await insertUnique(store, 'supportExternalIdentities', scope.identityKey, {
      externalKey: scope.identityKey, provider: scope.provider,
      externalUserId: event.externalUserId, externalAccountId: scope.accountId,
      displayName: event.contactName || event.contactEmail || event.externalUserId,
      verified: false, lastSeenAt: event.message.occurredAt, channelInstanceId: channelId,
    });
    identityId = created.id;
  }
  if (identityId) {
    const identity = keyed?.id === identityId ? keyed : await store.get('supportExternalIdentities', identityId);
    if (!identity) throw new IngestError('IDENTITY_MISSING', 'The linked identity no longer exists', 409);
    if (recordId(identity.channelInstanceId) && recordId(identity.channelInstanceId) !== channelId) {
      return { identityId: null, review: true };
    }
    for (let i = 0; i < scope.aliases.length; i++) {
      if (aliasMatches[i]) continue;
      const alias = scope.aliases[i];
      const { record } = await insertUnique(store, 'supportIdentityAliases', alias.externalKey, {
        externalKey: alias.externalKey, aliasValue: alias.aliasValue, aliasType: alias.aliasType,
        evidence: 'Provider event: remoteJid/remoteJidAlt',
        lastSeenAt: event.message.occurredAt, externalIdentityId: identityId,
      });
      if (recordId(record.externalIdentityId) !== identityId) return { identityId: null, review: true };
    }
  }
  return { identityId, review: false };
}

async function connectIdentity(
  store: IngestionStore, identityId: string | null, personId: string | null,
): Promise<{ personId: string | null; review: boolean }> {
  if (!identityId) return { personId, review: false };
  const identity = await store.get('supportExternalIdentities', identityId);
  if (!identity) throw new IngestError('IDENTITY_MISSING', 'Identity disappeared', 409);
  const linked = recordId(identity.personId);
  if (linked && personId && linked !== personId) return { personId: null, review: true };
  const selected = linked || personId;
  if (selected && !linked) await store.update('supportExternalIdentities', identityId, { personId: selected });
  return { personId: selected || null, review: false };
}

async function caseFor(
  event: IngestEvent, store: IngestionStore, scope: ReturnType<typeof keys>,
  channel: DbRecord, identityId: string | null, personId: string | null, review: boolean,
) {
  const mode = (text(channel.groupingMode) || (scope.channelType === 'EMAIL' ? 'THREAD' : 'HYBRID')) as GroupingMode;
  const safeIdentity = review ? null : identityId;
  const safePerson = review ? null : personId;
  const ref = event.message;
  const threadKey = ref.threadId ? scope.ns + ':THREAD:' + ref.threadId : '';
  const issueKey = ref.issueKey ? scope.ns + ':ISSUE:' + ref.issueKey : '';
  let candidate: DbRecord | null = null;
  if (!review && ref.caseId) candidate = await store.get('supportCases', ref.caseId);
  if (!review && !candidate && ref.replyToExternalId) {
    const original = await first(store, 'supportMessages', { externalKey: scope.ns + ':MESSAGE:' + ref.replyToExternalId });
    if (original?.supportCaseId) candidate = await store.get('supportCases', recordId(original.supportCaseId));
  }
  if (!review && !candidate && issueKey) candidate = await first(store, 'supportCases', { externalKey: issueKey });
  if (!review && !candidate && mode === 'THREAD' && threadKey) {
    candidate = await first(store, 'supportCases', { externalKey: threadKey });
  }
  if (!review && !candidate && mode === 'SESSION' && safeIdentity) {
    const cases = await store.list('supportCases', { externalIdentityId: safeIdentity, channelInstanceId: channel.id }, 50);
    const limit = Number(channel.continuationHours ?? 72) * 3_600_000;
    const time = Date.parse(event.message.occurredAt);
    candidate = cases
      .filter(c => isOpen(c.status) && Date.parse(string(c.lastMessageAt) || '') >= time - limit)
      .sort((a, b) => Date.parse(string(b.lastMessageAt)) - Date.parse(string(a.lastMessageAt)))[0] ?? null;
  }
  if (candidate && !verifyCase(candidate, channel.id, safeIdentity, safePerson)) {
    review = true;
    candidate = null;
  }
  // Never attach to an unrelated case when no trustworthy reference identifies the subject.
  if (!candidate && (mode === 'MANUAL' || (mode === 'HYBRID' && !issueKey && !ref.caseId && !ref.replyToExternalId && channel.ambiguousAction !== 'NEW') ||
    (mode === 'THREAD' && !ref.threadId && !issueKey))) review = true;

  const caseKey = candidate?.externalKey ? text(candidate.externalKey)
    : (review ? scope.ns + ':REVIEW-MESSAGE:' + event.messageKey
      : issueKey || (mode === 'THREAD' ? threadKey : '') || scope.ns + ':CASE-MESSAGE:' + event.messageKey);

  if (!candidate) {
    const savedCase = await insertUnique(store, 'supportCases', caseKey, {
      externalKey: caseKey,
      subject: ref.subject,
      channel: scope.channelType,
      status: review ? 'HUMAN_REQUIRED' : 'NEW',
      resolution: 'PENDING',
      firstMessageAt: ref.occurredAt,
      lastMessageAt: ref.occurredAt,
      channelInstanceId: channel.id,
      ...(safeIdentity ? { externalIdentityId: safeIdentity } : {}),
      ...(safePerson ? { personId: safePerson } : {}),
      ...(event.contactEmail ? { originEmail: event.contactEmail } : {}),
      ...(event.contactPhone ? { originPhone: event.contactPhone } : {}),
    });
    candidate = savedCase.record;
    if (!verifyCase(candidate, channel.id, safeIdentity, safePerson)) {
      throw new IngestError('CASE_CONFLICT', 'The selected case belongs to a different identity', 409);
    }
  } else {
    const updates: Record<string, unknown> = {};
    if (safePerson && !candidate.personId) updates.personId = safePerson;
    if (safeIdentity && !candidate.externalIdentityId) updates.externalIdentityId = safeIdentity;
    if (Date.parse(ref.occurredAt) > Date.parse(string(candidate.lastMessageAt) || '')) updates.lastMessageAt = ref.occurredAt;
    if (Object.keys(updates).length) await store.update('supportCases', candidate.id, updates);
  }
  return { caseId: candidate.id, review };
}
const deliveryRank: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, RECEIVED: 2 };
async function statusChange(store: IngestionStore, existing: DbRecord, newStatus: string) {
  const current = string(existing.deliveryStatus);
  if (current === newStatus || current === 'DELIVERED') return false;
  if (current !== 'FAILED' && newStatus !== 'FAILED' && (deliveryRank[newStatus] ?? 0) < (deliveryRank[current] ?? 0)) return false;
  await store.update('supportMessages', existing.id, {
    deliveryStatus: newStatus,
    ...(newStatus === 'SENT' ? { sentAt: new Date().toISOString() } : {}),
    ...(newStatus === 'DELIVERED' ? { deliveredAt: new Date().toISOString() } : {}),
  });
  return true;
}

export async function ingest(event: IngestEvent, store: IngestionStore): Promise<IngestResult> {
  const channel = await first(store, 'supportChannels', { code: event.channelCode });
  if (!channel) throw new IngestError('UNKNOWN_CHANNEL', 'Unknown channelCode', 404);
  const scope = keys(event, {
    channelType: text(channel.channelType),
    provider: text(channel.provider),
    externalIdentifier: text(channel.externalIdentifier),
  });
  const existing = await first(store, 'supportMessages', { externalKey: scope.messageKey });
  if (event.kind === 'status') {
    if (!existing) throw new IngestError('UNKNOWN_MESSAGE', 'Status references an unknown message', 404);
    const changed = await statusChange(store, existing, event.message.deliveryStatus);
    return {
      ok: true, status: changed ? 'status_updated' : 'duplicate',
      channelId: channel.id, caseId: recordId(existing.supportCaseId) || null,
      identityId: null, personId: null, messageId: existing.id,
      reviewRequired: false, stableId: true,
    };
  }
  if (existing) {
    return { ok: true, status: 'duplicate', channelId: channel.id,
      caseId: recordId(existing.supportCaseId) || null, identityId: null, personId: null,
      messageId: existing.id, reviewRequired: false, stableId: event.stableId };
  }
  const withIdentity = {
    ...event, externalUserId: event.externalUserId || (scope.channelType === 'EMAIL' ? event.contactEmail : ''),
  };
  const scoped = keys(withIdentity, {
    channelType: scope.channelType, provider: scope.provider, externalIdentifier: scope.accountId,
  });
  const identity = await identityFor(withIdentity, store, scoped, channel.id);
  const resolvedPerson = identity.review ? { personId: null, review: true }
    : await personFor(withIdentity, store, scope.channelType);
  const link = identity.review || resolvedPerson.review
    ? { personId: null, review: true }
    : await connectIdentity(store, identity.identityId, resolvedPerson.personId);
  const review = identity.review || resolvedPerson.review || link.review;
  const selectedCase = await caseFor(withIdentity, store, scoped, channel,
    identity.identityId, link.personId, review);

  const ref = event.message;
  const messageData: Record<string, unknown> = {
    externalKey: scope.messageKey,
    supportCaseId: selectedCase.caseId,
    direction: ref.direction,
    senderType: ref.senderType,
    body: ref.body,
    subject: ref.subject,
    occurredAt: ref.occurredAt,
    deliveryStatus: ref.deliveryStatus,
    provider: scope.provider,
    ...(event.externalId ? { providerMessageId: event.externalId } : {}),
    ...(ref.fromAddress ? { fromAddress: ref.fromAddress } : {}),
    ...(ref.toAddress ? { toAddress: ref.toAddress } : {}),
    ...(ref.providerChatId ? { providerChatId: ref.providerChatId } : {}),
    ...(ref.providerChatIdAlt ? { providerChatIdAlt: ref.providerChatIdAlt } : {}),
    ...(ref.providerAddressingMode ? { providerAddressingMode: ref.providerAddressingMode } : {}),
    ...(ref.replyToExternalId ? { replyToExternalKey: scope.ns + ':MESSAGE:' + ref.replyToExternalId } : {}),
  };
  const { record: created, created: didCreate } = await insertUnique(store, 'supportMessages', scope.messageKey, messageData);
  return {
    ok: true,
    status: didCreate ? 'created' : 'duplicate',
    channelId: channel.id, caseId: recordId(created.supportCaseId) || selectedCase.caseId,
    identityId: review ? null : identity.identityId,
    personId: review ? null : link.personId,
    messageId: created.id, reviewRequired: selectedCase.review,
    stableId: event.stableId,
  };
}
