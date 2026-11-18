import { type IngestEvent, IngestError, keys, type GroupingMode, type ConversationPatch } from './contract.ts';

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
const isContinuable = (value: unknown) => [
  'NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'HUMAN_REQUIRED', 'WAITING_INTERNAL',
  'AUTOMATED', 'INFORMATIONAL',
].includes(string(value));
const digits = (value: string) => value.replace(/\D/g, '');
const hours = (raw: unknown, fallback: number, min: number): number => {
  const value = raw === null || raw === undefined ? fallback : Number(raw);
  return Number.isInteger(value) && value >= min && value <= 8760 ? value : fallback;
};

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
const verifyCase = (
  candidate: DbRecord | null, channelId: string,
  identityId: string | null, personId: string | null, email: string,
  allowEmailMatch: boolean,
): boolean => {
  if (!candidate || recordId(candidate.channelInstanceId) !== channelId) return false;
  if (!identityId && !personId && !(allowEmailMatch && email)) return false;
  const linkedIdentity = recordId(candidate.externalIdentityId);
  const linkedPerson = recordId(candidate.personId);
  if (linkedIdentity && linkedIdentity !== identityId) return false;
  if (linkedPerson && linkedPerson !== personId) return false;
  // An unverified email from a chat never authorizes attaching to a known case.
  return (Boolean(identityId) && linkedIdentity === identityId)
    || (Boolean(personId) && linkedPerson === personId)
    || (allowEmailMatch && Boolean(email) && text(candidate.originEmail).toLowerCase() === email.toLowerCase());
};

type PersonResolution = { personId: string | null; review: boolean };
/**
 * Enrich a Person only when their identity was verified or the message's email matches.
 * Both native name parts must be present in the REST representation before a partial
 * update, otherwise we risk wiping a curated value that was omitted from a projection.
 */
async function fillMissingPersonName(
  event: IngestEvent, store: IngestionStore, person: DbRecord, channelType: string,
): Promise<void> {
  const firstName = event.contactFirstName;
  const lastName = event.contactLastName;
  if (!firstName && !lastName) return;
  const personEmail = person.emails && typeof person.emails === 'object'
    ? text((person.emails as Record<string, unknown>).primaryEmail).toLowerCase() : '';
  const verifiedId = event.personVerified && event.personId === person.id;
  const verifiedEmail = Boolean(event.contactEmail) && personEmail === event.contactEmail &&
    (channelType === 'EMAIL' || event.personVerified);
  if (!verifiedId && !verifiedEmail) return;

  const current = person.name && typeof person.name === 'object' ? person.name : (await store.get('people', person.id))?.name;
  if (!current || typeof current !== 'object') return;
  const existing = current as Record<string, unknown>;
  if (!Object.hasOwn(existing, 'firstName') || !Object.hasOwn(existing, 'lastName')) return;
  const nextFirst = text(existing.firstName) || firstName;
  const nextLast = text(existing.lastName) || lastName;
  if (nextFirst === text(existing.firstName) && nextLast === text(existing.lastName)) return;
  await store.update('people', person.id, { name: { firstName: nextFirst, lastName: nextLast } });
}
async function personFor(event: IngestEvent, store: IngestionStore, channelType: string): Promise<PersonResolution> {
  if (event.personId && event.personVerified) {
    const person = await store.get('people', event.personId);
    if (!person) throw new IngestError('UNKNOWN_PERSON', 'The supplied verified personId was not found', 409);
    await fillMissingPersonName(event, store, person, channelType);
    return { personId: person.id, review: false };
  }
  // Transport-derived email is trustworthy for EMAIL. Other channels need an explicit verification signal.
  if (channelType !== 'EMAIL' && !event.personVerified) return { personId: null, review: false };
  const email = event.contactEmail || (channelType === 'EMAIL' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.externalUserId) ? event.externalUserId : '');
  if (!email) return { personId: null, review: false };
  const existing = await store.list('people', { 'emails.primaryEmail': email }, 2);
  if (existing.length > 1) return { personId: null, review: true };
  if (existing[0]) {
    await fillMissingPersonName(event, store, existing[0], channelType);
    return { personId: existing[0].id, review: false };
  }
  // Full display names are ambiguous (compound given names and surnames).
  // Use explicit firstName/lastName when possible; otherwise preserve name as display-first-name.
  const firstName = event.contactFirstName || (event.contactLastName ? '' : event.contactName);
  const lastName = event.contactLastName;
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
    if (reread.length === 1) {
      await fillMissingPersonName(event, store, reread[0], channelType);
      return { personId: reread[0].id, review: false };
    }
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

/** Resolve caller-supplied metadata only after the channel and record ownership were verified. */
async function conversationUpdates(
  patch: ConversationPatch, store: IngestionStore,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  for (const field of ['status', 'followUp', 'followUpAt', 'summary', 'comments', 'language', 'transcription'] as const) {
    if (Object.hasOwn(patch, field)) data[field] = patch[field];
  }
  if (Object.hasOwn(patch, 'recordingUrl')) {
    data.recording = patch.recordingUrl
      ? { primaryLinkUrl: patch.recordingUrl, primaryLinkLabel: 'Grabación de la conversación' }
      : null;
  }
  if (Object.hasOwn(patch, 'categoryId') || Object.hasOwn(patch, 'categoryCode')) {
    let category: DbRecord | null = null;
    if (patch.categoryId) category = await store.get('supportCategories', patch.categoryId);
    else if (patch.categoryCode) category = await first(store, 'supportCategories', { code: patch.categoryCode });
    if (patch.categoryId || patch.categoryCode) {
      if (!category || category.enabled === false)
        throw new IngestError('UNKNOWN_CATEGORY', 'Category is not available in this workspace', 422);
    }
    data.categoryId = category?.id ?? null;
  }
  return data;
}

/**
 * Auto-group chats inside a channel's configured activity window.
 * Never choose between multiple eligible cases: neither a phone number nor a
 * Person is enough to identify which of two open conversations is the subject.
 */
async function continuableCaseFor(
  event: IngestEvent, store: IngestionStore, channel: DbRecord,
  identityId: string | null, personId: string | null,
): Promise<{ record: DbRecord | null; ambiguous: boolean }> {
  const allowEmailMatch = event.personVerified && Boolean(event.contactEmail);
  if (!identityId && !personId && !(allowEmailMatch && event.contactPhone)) {
    return { record: null, ambiguous: false };
  }
  const filters: Filter[] = [];
  if (identityId) filters.push({ externalIdentityId: identityId, channelInstanceId: channel.id });
  if (personId) filters.push({ personId, channelInstanceId: channel.id });
  // Backward compatibility for cases created before their Person/identity was linked:
  // verified email AND the same phone are required, never email alone.
  if (allowEmailMatch && event.contactPhone) {
    filters.push({ originEmail: event.contactEmail, channelInstanceId: channel.id });
  }
  const batches = await Promise.all(filters.map(filter => store.list('supportCases', filter, 60)));
  // The REST API caps list results. A truncated candidate set is unsafe to auto-select.
  if (batches.some(batch => batch.length >= 60)) return { record: null, ambiguous: true };
  const candidates = [...new Map(batches.flat().map(row => [row.id, row])).values()];
  const eventTime = Date.parse(event.message.occurredAt);
  const continuationMs = hours(channel.continuationHours, 72, 1) * 3_600_000;
  const reopenMs = hours(channel.reopenHours, 48, 0) * 3_600_000;
  const active: DbRecord[] = [];
  const resolved: DbRecord[] = [];

  for (const candidate of candidates) {
    if (!verifyCase(candidate, channel.id, identityId, personId, event.contactEmail, allowEmailMatch)) continue;
    const byIdentity = Boolean(identityId) && recordId(candidate.externalIdentityId) === identityId;
    const byPerson = Boolean(personId) && recordId(candidate.personId) === personId;
    const savedPhone = digits(text(candidate.originPhone));
    const receivedPhone = digits(event.contactPhone);
    if (!byIdentity && !byPerson && (!savedPhone || !receivedPhone || savedPhone !== receivedPhone)) continue;
    // A Person may use several numbers: never join different phone lines on Person alone.
    if (!byIdentity && savedPhone && receivedPhone && savedPhone !== receivedPhone) continue;

    const last = Date.parse(text(candidate.lastMessageAt));
    if (!Number.isFinite(last) || !Number.isFinite(eventTime)) continue;
    const elapsed = eventTime - last;
    // Allow a small provider timestamp skew, but not stale events from a prior session.
    if (elapsed < -5 * 60_000) continue;
    if (isContinuable(candidate.status) && elapsed <= continuationMs) {
      active.push(candidate);
    } else if (string(candidate.status) === 'RESOLVED' &&
      reopenMs > 0 && elapsed <= reopenMs &&
      event.conversation.status &&
      !['RESOLVED', 'CLOSED'].includes(event.conversation.status)) {
      // A resolved case is reopened only when the new event explicitly requests
      // an active status. CLOSED remains terminal without an explicit reference.
      resolved.push(candidate);
    }
  }
  if (active.length === 1) return { record: active[0], ambiguous: false };
  if (active.length > 1) return { record: null, ambiguous: true };
  if (resolved.length === 1) return { record: resolved[0], ambiguous: false };
  if (resolved.length > 1) return { record: null, ambiguous: true };
  return { record: null, ambiguous: false };
}

async function caseFor(
  event: IngestEvent, store: IngestionStore, scope: ReturnType<typeof keys>,
  channel: DbRecord, identityId: string | null, personId: string | null, review: boolean,
) {
  const mode = (text(channel.groupingMode) || (scope.channelType === 'EMAIL' ? 'THREAD' : 'HYBRID')) as GroupingMode;
  const safeIdentity = review ? null : identityId;
  const safePerson = review ? null : personId;
  const ref = event.message;
  const metadata = await conversationUpdates(event.conversation, store);
  // Keep a convenient case-level link for telephone calls, without changing other channels.
  if (scope.channelType === 'PHONE' && ref.callRecordingUrl && !Object.hasOwn(metadata, 'recording')) {
    metadata.recording = { primaryLinkUrl: ref.callRecordingUrl, primaryLinkLabel: 'Audio de la llamada' };
  }
  if (scope.channelType === 'PHONE' && ref.callTranscription && !Object.hasOwn(metadata, 'transcription')) {
    metadata.transcription = ref.callTranscription;
  }
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
  const standaloneNotice = ref.issueKey.startsWith('standalone-auto:');
  const automatic = (mode === 'HYBRID' || mode === 'SESSION') &&
    (!ref.issueKey || standaloneNotice) && !ref.caseId && !ref.replyToExternalId;
  if (!review && !candidate && automatic) {
    const found = await continuableCaseFor(event, store, channel, safeIdentity, safePerson);
    if (found.ambiguous) {
      if (string(channel.ambiguousAction) !== 'NEW') review = true;
    } else {
      candidate = found.record;
    }
  }
  const allowEmailMatch = scope.channelType === 'EMAIL' || event.personVerified;
  if (candidate && !verifyCase(candidate, channel.id, safeIdentity, safePerson, event.contactEmail, allowEmailMatch)) {
    review = true;
    candidate = null;
  }
  // A new, unreferenced chat with an identified interlocutor is a legitimate
  // first case. Unidentified or ambiguous chats follow the channel's policy.
  const identifiable = Boolean(safeIdentity || safePerson);
  if (!candidate && !review && (
    mode === 'MANUAL' ||
    (mode === 'THREAD' && !ref.threadId && !issueKey) ||
    (automatic && !identifiable && !standaloneNotice && string(channel.ambiguousAction) !== 'NEW')
  )) review = true;

  const caseKey = candidate?.externalKey ? text(candidate.externalKey)
    : (review ? scope.ns + ':REVIEW-MESSAGE:' + event.messageKey
      : issueKey || (mode === 'THREAD' ? threadKey : '') || scope.ns + ':CASE-MESSAGE:' + event.messageKey);

  if (!candidate) {
    const savedCase = await insertUnique(store, 'supportCases', caseKey, {
      externalKey: caseKey,
      subject: ref.subject,
      channel: scope.channelType,
      resolution: 'PENDING',
      firstMessageAt: ref.occurredAt,
      lastMessageAt: ref.occurredAt,
      channelInstanceId: channel.id,
      ...(safeIdentity ? { externalIdentityId: safeIdentity } : {}),
      ...(safePerson ? { personId: safePerson } : {}),
      ...(event.contactEmail ? { originEmail: event.contactEmail } : {}),
      ...(event.contactPhone ? { originPhone: event.contactPhone } : {}),
      ...metadata,
      // Identity ambiguity always forces review, regardless of untrusted status.
      status: review ? 'HUMAN_REQUIRED' : (event.conversation.status ?? 'NEW'),
    });
    candidate = savedCase.record;
    if (!savedCase.created && !verifyCase(candidate, channel.id, safeIdentity, safePerson, event.contactEmail, allowEmailMatch)) {
      throw new IngestError('CASE_CONFLICT', 'The selected case belongs to a different identity', 409);
    }
  } else {
    const updates: Record<string, unknown> = { ...metadata };
    if (safePerson && !candidate.personId) updates.personId = safePerson;
    if (safeIdentity && !candidate.externalIdentityId) updates.externalIdentityId = safeIdentity;
    if (Date.parse(ref.occurredAt) > Date.parse(string(candidate.lastMessageAt) || '')) updates.lastMessageAt = ref.occurredAt;
    if (review) delete updates.status;
    if (Object.keys(updates).length) await store.update('supportCases', candidate.id, updates);
  }
  return { caseId: candidate.id, review };
}
const deliveryRank: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, RECEIVED: 2 };
async function statusChange(store: IngestionStore, existing: DbRecord, newStatus: string) {
  const current = string(existing.deliveryStatus);
  if (current === newStatus || current === 'DELIVERED' || current === 'FAILED') return false;
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
    // A retry may repair an older case that was stored before a Person was resolved.
    // Never replace a Person or identity that is already linked.
    const caseId = recordId(existing.supportCaseId) || null;
    const previous = caseId ? await store.get('supportCases', caseId) : null;
    let identityId = recordId(previous?.externalIdentityId) || null;
    let personId = recordId(previous?.personId) || null;
    let reviewRequired = false;
    if (personId && previous && recordId(previous.channelInstanceId) === channel.id) {
      const linkedPerson = await store.get('people', personId);
      if (linkedPerson && (event.personVerified || scope.channelType === 'EMAIL')) {
        await fillMissingPersonName(event, store, linkedPerson, scope.channelType);
      }
    }
    if (previous && recordId(previous.channelInstanceId) === channel.id && !personId) {
      const previousEmail = text(previous.originEmail).toLowerCase();
      if (previousEmail && previousEmail !== event.contactEmail) {
        return { ok: true, status: 'duplicate', channelId: channel.id,
          caseId, identityId, personId: null, messageId: existing.id,
          reviewRequired: true, stableId: event.stableId };
      }
      const identity = identityId ? await store.get('supportExternalIdentities', identityId) : null;
      const knownExternalId = text(identity?.externalUserId);
      if (knownExternalId && event.externalUserId && knownExternalId !== event.externalUserId) {
        reviewRequired = true;
      } else {
        const linkedId = recordId(identity?.personId);
        const resolved = linkedId ? { personId: linkedId, review: false }
          : await personFor(event, store, scope.channelType);
        if (linkedId && (event.personVerified || scope.channelType === 'EMAIL')) {
          const linkedPerson = await store.get('people', linkedId);
          if (linkedPerson) await fillMissingPersonName(event, store, linkedPerson, scope.channelType);
        }
        if (resolved.review) reviewRequired = true;
        else if (resolved.personId) {
          const attached = await connectIdentity(store, identityId, resolved.personId);
          if (attached.review) reviewRequired = true;
          else if (attached.personId) {
            personId = attached.personId;
            await store.update('supportCases', caseId!, { personId });
          }
        }
      }
    }
    return { ok: true, status: 'duplicate', channelId: channel.id,
      caseId, identityId, personId: personId || null,
      messageId: existing.id, reviewRequired, stableId: event.stableId };
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
  if (!identity.review && !link.review && link.personId && link.personId !== resolvedPerson.personId &&
      (event.personVerified || scope.channelType === 'EMAIL')) {
    const linkedPerson = await store.get('people', link.personId);
    if (linkedPerson) await fillMissingPersonName(event, store, linkedPerson, scope.channelType);
  }
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
    ...(ref.callTranscription ? { callTranscription: ref.callTranscription } : {}),
    ...(ref.callRecordingUrl ? { callRecording: { primaryLinkUrl: ref.callRecordingUrl, primaryLinkLabel: 'Audio de la llamada' } } : {}),
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
