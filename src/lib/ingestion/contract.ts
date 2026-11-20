import { randomUUID } from 'node:crypto';
import { messageText } from '../message-text.ts';
import { PROPOSAL_BODY_LIMIT } from '../proposal-constants.ts';

export { PROPOSAL_BODY_LIMIT } from '../proposal-constants.ts';

/** The public contract is intentionally provider-agnostic. Old flat n8n payloads also work. */
export type ChannelType = 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'TELEGRAM' | 'PHONE';
export type Direction = 'INBOUND' | 'OUTBOUND';
export type DeliveryStatus = 'RECEIVED' | 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
export type GroupingMode = 'THREAD' | 'MESSAGE' | 'HYBRID' | 'SESSION' | 'MANUAL';

export const CONVERSATION_STATUSES = [
  'NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'HUMAN_REQUIRED', 'RESOLVED', 'CLOSED',
  'AUTOMATED', 'INFORMATIONAL', 'WAITING_INTERNAL',
] as const;
export const CONVERSATION_TAGS = ['URGENT', 'REPEAT', 'VIP', 'ESCALATED', 'FOLLOWUP'] as const;
export const CONVERSATION_RESOLUTIONS = ['PENDING', 'SOLVED', 'UNSOLVED', 'NOT_APPLICABLE'] as const;
export const CONVERSATION_AUTOMATIONS = ['PENDING', 'FULL', 'PARTIAL', 'NONE'] as const;
export const CONVERSATION_TECHNICAL_STATUSES = ['UNKNOWN', 'PENDING', 'SUCCESS', 'RETRYING', 'ERROR'] as const;
export const FOLLOW_UP_STATUSES = [
  'NONE', 'REQUIRED', 'SCHEDULED', 'WAITING_RESPONSE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
] as const;
export type ConversationStatus = typeof CONVERSATION_STATUSES[number];
export type FollowUpStatus = typeof FOLLOW_UP_STATUSES[number];
export type ProposedReply = { body: string; callbackUrl: string };

/**
 * Sparse patch of a conversation. Omitted keys do not change the current value.
 * Nullable text, date, category, type and recording fields accept explicit null to clear them.
 */
export type ConversationPatch = {
  status?: ConversationStatus;
  subject?: string | null;
  tags?: typeof CONVERSATION_TAGS[number][];
  customTags?: string[];
  resolution?: typeof CONVERSATION_RESOLUTIONS[number];
  automation?: typeof CONVERSATION_AUTOMATIONS[number];
  technicalStatus?: typeof CONVERSATION_TECHNICAL_STATUSES[number];
  assignedTo?: string | null;
  categoryId?: string | null;
  typeId?: string | null;
  typeCode?: string | null;
  categoryCode?: string | null;
  followUp?: FollowUpStatus | null;
  followUpAt?: string | null;
  summary?: string | null;
  comments?: string | null;
  language?: string | null;
  transcription?: string | null;
  recordingUrl?: string | null;
};


export type IngestEvent = {
  kind: 'message' | 'status';
  eventType: 'message.received' | 'message.sent' | 'message.status';
  channelCode: string;
  channelType: ChannelType | null;
  provider: string;
  accountId: string;
  externalId: string | null;
  messageKey: string;
  stableId: boolean;
  externalUserId: string;
  contactEmail: string;
  contactPhone: string;
  contactName: string;
  contactFirstName: string;
  contactLastName: string;
  personId: string | null;
  personVerified: boolean;
  conversation: ConversationPatch;
  proposedReply?: ProposedReply;
  message: {
    direction: Direction;
    senderType: 'CUSTOMER' | 'BOT' | 'AGENT';
    deliveryStatus: DeliveryStatus;
    body: string;
    subject: string;
    fromAddress: string;
    toAddress: string;
    occurredAt: string;
    threadId: string;
    issueKey: string;
    caseId: string;
    replyToExternalId: string;
    providerChatId: string;
    providerChatIdAlt: string;
    providerAddressingMode: string;
    callTranscription: string | null;
    callRecordingUrl: string | null;
  };
  aliases: { externalKey: string; aliasType: 'WHATSAPP_PN' | 'WHATSAPP_LID'; aliasValue: string }[];
};

export class IngestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'IngestError';
    this.code = code;
    this.status = status;
  }
}

type Dict = Record<string, unknown>;
const object = (value: unknown): Dict =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : {};
const string = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const lower = (value: unknown): string => string(value).toLowerCase();

function normalizeProposedReply(raw: unknown): ProposedReply {
  const proposal = object(raw);
  const body = messageText(proposal.body);
  if (Object.keys(proposal).some(key => key !== 'body' && key !== 'callbackUrl') ||
      !body.trim() || body.length > PROPOSAL_BODY_LIMIT ||
      typeof proposal.callbackUrl !== 'string' || !proposal.callbackUrl.trim() || proposal.callbackUrl.length > 2048) {
    throw new IngestError('INVALID_PROPOSAL', 'proposedReply requires body and a Wait callbackUrl');
  }
  return { body, callbackUrl: proposal.callbackUrl.trim() };
}

function max(value: string, limit: number, name: string): string {
  if (value.length > limit) throw new IngestError('FIELD_TOO_LONG', name + ' exceeds ' + limit + ' characters');
  return value;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JID = /^[0-9]+@(s\.whatsapp\.net|lid)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LANGUAGE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function nullableText(raw: unknown, field: string, length: number): string | null {
  if (raw === null) return null;
  if (typeof raw !== 'string') throw new IngestError('INVALID_CONVERSATION_FIELD', field + ' must be text or null');
  return max(raw.trim(), length, field);
}
function enumValue<T extends string>(raw: unknown, field: string, values: readonly T[]): T {
  const candidate = string(raw).toUpperCase();
  if (!values.includes(candidate as T)) throw new IngestError('INVALID_CONVERSATION_FIELD', 'Invalid ' + field);
  return candidate as T;
}
function stringArray(raw: unknown, field: string, limit: number, entryLimit: number): string[] {
  if (!Array.isArray(raw) || raw.length > limit) {
    throw new IngestError('INVALID_CONVERSATION_FIELD', field + ' must be an array with at most ' + limit + ' elements');
  }
  const values = raw.map(item => {
    if (typeof item !== 'string') throw new IngestError('INVALID_CONVERSATION_FIELD', field + ' must contain only strings');
    const value = max(item.trim(), entryLimit, field);
    if (!value) throw new IngestError('INVALID_CONVERSATION_FIELD', field + ' cannot contain empty tags');
    return value;
  });
  return [...new Set(values)];
}
function optionalDate(raw: unknown, field: string): string | null {
  if (raw === null) return null;
  if (typeof raw !== 'string' || !DATE_ISO.test(raw) || !Number.isFinite(Date.parse(raw)))
    throw new IngestError('INVALID_CONVERSATION_FIELD', field + ' must be an ISO 8601 date or null');
  return new Date(raw).toISOString();
}
/** HTTPS only: never copy a provider's credentials, internal URL or base64 recording into CRM data. */
export function recordingUrl(raw: unknown, field: string): string | null {
  const value = nullableText(raw, field, 2048);
  if (value === null) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return url.href;
  } catch { /* The public error below intentionally omits the URL. */ }
  throw new IngestError('INVALID_RECORDING_URL', field + ' requires an HTTPS URL without embedded credentials');
}
export function normalizeConversation(raw: unknown): ConversationPatch {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new IngestError('INVALID_CONVERSATION', 'conversation must be an object');
  const input = raw as Dict;
  const allowed = ['status', 'subject', 'tags', 'customTags', 'resolution', 'automation', 'technicalStatus',
    'assignedTo', 'categoryId', 'categoryCode', 'typeId', 'typeCode', 'followUp', 'followUpAt',
    'summary', 'comments', 'language', 'transcription', 'recordingUrl'];
  const unknown = Object.keys(input).filter(k => !allowed.includes(k));
  if (unknown.length) throw new IngestError('UNKNOWN_CONVERSATION_FIELD', 'Unsupported conversation field');
  if (Object.hasOwn(input, 'categoryId') && Object.hasOwn(input, 'categoryCode'))
    throw new IngestError('CONFLICTING_CATEGORY', 'Pass categoryId or categoryCode, not both');
  if (Object.hasOwn(input, 'typeId') && Object.hasOwn(input, 'typeCode'))
    throw new IngestError('CONFLICTING_TYPE', 'Pass typeId or typeCode, not both');
  const patch: ConversationPatch = {};
  if (Object.hasOwn(input, 'subject')) patch.subject = nullableText(input.subject, 'subject', 500);
  if (Object.hasOwn(input, 'assignedTo')) patch.assignedTo = nullableText(input.assignedTo, 'assignedTo', 255);
  if (Object.hasOwn(input, 'tags')) {
    const values = stringArray(input.tags, 'tags', 5, 40).map(value => value.toUpperCase());
    if (values.some(value => !CONVERSATION_TAGS.includes(value as typeof CONVERSATION_TAGS[number])))
      throw new IngestError('INVALID_CONVERSATION_FIELD', 'Unknown conversation tag');
    patch.tags = [...new Set(values)] as ConversationPatch['tags'];
  }
  if (Object.hasOwn(input, 'customTags')) patch.customTags = stringArray(input.customTags, 'customTags', 30, 64);
  if (Object.hasOwn(input, 'resolution')) patch.resolution = enumValue(input.resolution, 'resolution', CONVERSATION_RESOLUTIONS);
  if (Object.hasOwn(input, 'automation')) patch.automation = enumValue(input.automation, 'automation', CONVERSATION_AUTOMATIONS);
  if (Object.hasOwn(input, 'technicalStatus')) patch.technicalStatus = enumValue(input.technicalStatus, 'technicalStatus', CONVERSATION_TECHNICAL_STATUSES);
  if (Object.hasOwn(input, 'status')) patch.status = enumValue(input.status, 'status', CONVERSATION_STATUSES);
  if (Object.hasOwn(input, 'followUp')) patch.followUp = input.followUp === null ? null : enumValue(input.followUp, 'followUp', FOLLOW_UP_STATUSES);
  if (Object.hasOwn(input, 'followUpAt')) patch.followUpAt = optionalDate(input.followUpAt, 'followUpAt');
  for (const kind of ['type', 'category'] as const) {
    const idKey = (kind + 'Id') as 'typeId' | 'categoryId';
    const codeKey = (kind + 'Code') as 'typeCode' | 'categoryCode';
    if (Object.hasOwn(input, idKey)) {
      if (input[idKey] === null) patch[idKey] = null;
      else {
        const candidate = string(input[idKey]);
        if (!UUID.test(candidate)) throw new IngestError('INVALID_' + kind.toUpperCase(), idKey + ' must be a UUID or null');
        patch[idKey] = candidate;
      }
    }
    if (Object.hasOwn(input, codeKey)) {
      if (input[codeKey] === null) patch[codeKey] = null;
      else {
        const candidate = string(input[codeKey]);
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(candidate))
          throw new IngestError('INVALID_' + kind.toUpperCase(), codeKey + ' must be a valid code or null');
        patch[codeKey] = candidate;
      }
    }
  }
  for (const key of ['summary', 'comments', 'transcription'] as const) {
    if (Object.hasOwn(input, key)) patch[key] = nullableText(input[key], key, 100000);
  }
  if (Object.hasOwn(input, 'language')) {
    const value = nullableText(input.language, 'language', 48);
    if (value && !LANGUAGE.test(value)) throw new IngestError('INVALID_LANGUAGE', 'language must be a BCP 47 tag');
    patch.language = value;
  }
  if (Object.hasOwn(input, 'recordingUrl')) patch.recordingUrl = recordingUrl(input.recordingUrl, 'recordingUrl');
  return patch;
}

function jid(value: unknown): string {
  const candidate = lower(value).replace(/:\d+(?=@)/, '');
  return JID.test(candidate) ? candidate : '';
}

function status(value: unknown, direction: Direction): DeliveryStatus {
  const v = string(value).toUpperCase();
  if (!v) return direction === 'INBOUND' ? 'RECEIVED' : 'PENDING';
  if (!['RECEIVED', 'PENDING', 'SENT', 'DELIVERED', 'FAILED'].includes(v)) {
    throw new IngestError('INVALID_STATUS', 'Invalid deliveryStatus');
  }
  return v as DeliveryStatus;
}

export function normalizeEvent(raw: unknown, now = new Date(), makeId = randomUUID): IngestEvent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new IngestError('INVALID_BODY', 'Expected a JSON object');
  }
  const top = object(raw);
  const contact = object(top.contact);
  const message = object(top.message);
  const code = max(lower(top.channelCode), 120, 'channelCode');
  if (!code) throw new IngestError('MISSING_CHANNEL', 'channelCode is required');
  const suppliedType = string(top.channelType).toUpperCase();
  if (suppliedType && !['EMAIL', 'WHATSAPP', 'INSTAGRAM', 'TELEGRAM', 'PHONE'].includes(suppliedType)) {
    throw new IngestError('INVALID_CHANNEL', 'Unsupported channelType');
  }
  const directionValue = string(message.direction ?? top.direction).toUpperCase() || (top.eventType === 'message.sent' ? 'OUTBOUND' : 'INBOUND');
  if (directionValue !== 'INBOUND' && directionValue !== 'OUTBOUND') {
    throw new IngestError('INVALID_DIRECTION', 'Direction must be INBOUND or OUTBOUND');
  }
  const direction = directionValue as Direction;
  const typeRaw = string(top.eventType) || (direction === 'OUTBOUND' ? 'message.sent' : 'message.received');
  if (!['message.received', 'message.sent', 'message.status'].includes(typeRaw)) {
    throw new IngestError('INVALID_EVENT_TYPE', 'Unsupported eventType');
  }
  const eventType = typeRaw as IngestEvent['eventType'];
  const conversation = normalizeConversation(top.conversation);
  if (eventType === 'message.status' && Object.keys(conversation).length) {
    throw new IngestError('CONVERSATION_ON_DELIVERY_EVENT', 'Update conversation only with a message event');
  }
  const externalId = max(string(message.externalId ?? message.messageId ?? message.providerMessageId ?? top.messageId ?? top.externalMessageId ?? top.providerMessageId), 300, 'messageId') || null;
  const fallbackId = max(string(message.idempotencyKey ?? top.idempotencyKey), 300, 'idempotencyKey');
  if (eventType === 'message.status' && !externalId) {
    throw new IngestError('MISSING_MESSAGE_ID', 'A status event requires the original provider message ID');
  }
  if (eventType === 'message.status' && !(message.deliveryStatus ?? top.deliveryStatus)) {
    throw new IngestError('MISSING_STATUS', 'A status event must include deliveryStatus');
  }
  let proposedReply: ProposedReply | undefined;
  if (top.proposedReply !== undefined) {
    if (eventType !== 'message.received' || direction !== 'INBOUND' || (suppliedType && suppliedType !== 'EMAIL')) {
      throw new IngestError('INVALID_PROPOSAL_EVENT', 'Only incoming email events can include a proposed reply');
    }
    if (!externalId && !fallbackId) {
      throw new IngestError('PROPOSAL_REQUIRES_MESSAGE_ID', 'A proposed reply requires a stable message ID');
    }
    proposedReply = normalizeProposedReply(top.proposedReply);
    conversation.status ??= 'IN_PROGRESS';
  }

  const fromAddress = max(string(message.fromAddress ?? message.from ?? top.fromAddress), 500, 'fromAddress');
  const toAddress = max(string(message.toAddress ?? message.to ?? top.toAddress), 500, 'toAddress');
  const email = lower(contact.email ?? top.customerEmail ??
    (suppliedType === 'EMAIL' ? (direction === 'OUTBOUND' ? toAddress : fromAddress) : ''));
  if (email && !EMAIL.test(email)) throw new IngestError('INVALID_EMAIL', 'Invalid contact.email');
  const type = suppliedType as ChannelType | '';
  // Outbound WhatsApp automations often know only the E.164 recipient number.
  // Canonicalize it to the same PN JID used by inbound Evolution API events.
  // Never derive a WhatsApp identity from an unvalidated/short phone string.
  const phoneForIdentity = string(contact.phone ?? top.originPhone);
  const phoneDigits = phoneForIdentity.startsWith('+') && /^\+[1-9]\d{7,14}$/.test(phoneForIdentity)
    ? phoneForIdentity.slice(1) : '';
  const phoneJid = suppliedType === 'WHATSAPP' && phoneDigits
    ? phoneDigits + '@s.whatsapp.net' : '';
  const userId = max(lower(contact.externalId ?? contact.externalUserId ?? top.externalUserId) ||
    (type === 'EMAIL' ? email : phoneJid), 300, 'externalUserId');

  const primaryJid = jid(contact.remoteJid ?? message.remoteJid ?? top.remoteJid);
  const altJid = jid(contact.remoteJidAlt ?? message.remoteJidAlt ?? top.remoteJidAlt);
  const rawJid = lower(contact.remoteJid ?? message.remoteJid ?? top.remoteJid);
  const rawAltJid = lower(contact.remoteJidAlt ?? message.remoteJidAlt ?? top.remoteJidAlt);
  if (rawJid.endsWith('@g.us') || rawAltJid.endsWith('@g.us')) {
    throw new IngestError('UNSUPPORTED_GROUP', 'WhatsApp groups are not supported by the person ingestion endpoint');
  }
  const aliases = [...new Set([primaryJid, altJid].filter(Boolean))].map(aliasValue => ({
    externalKey: '',
    aliasType: (aliasValue.endsWith('@lid') ? 'WHATSAPP_LID' : 'WHATSAPP_PN') as 'WHATSAPP_PN' | 'WHATSAPP_LID',
    aliasValue,
  }));
  const occurredInput = message.occurredAt ?? top.occurredAt;
  const occurred = occurredInput ? new Date(String(occurredInput)) : now;
  if (!Number.isFinite(occurred.getTime())) throw new IngestError('INVALID_DATE', 'Invalid occurredAt');
  const sender = string(message.senderType ?? top.senderType).toUpperCase() ||
    (direction === 'INBOUND' ? 'CUSTOMER' : 'AGENT');
  if (!['CUSTOMER', 'BOT', 'AGENT'].includes(sender)) throw new IngestError('INVALID_SENDER', 'Invalid senderType');

  let body = messageText(message.text ?? top.text);
  if (!body.trim()) body = messageText(message.body ?? top.body);
  if (!body.trim()) {
    const html = [message.html, message.bodyHtml, message.textHtml, top.html, top.bodyHtml, top.textHtml]
      .find(value => typeof value === 'string' && value.trim());
    body = messageText(html, 'html');
  }
  body = max(body.trim() ? body : '', 100000, 'body');
  const subject = max(string(message.subject ?? top.subject), 500, 'subject');
  const contactFirstName = max(string(contact.firstName ?? top.firstName), 255, 'contact.firstName');
  const contactLastName = max(string(contact.lastName ?? top.lastName), 255, 'contact.lastName');
  const contactName = max(string(contact.name ?? top.displayName) ||
    [contactFirstName, contactLastName].filter(Boolean).join(' '), 500, 'contact.name');
  const localId = externalId || fallbackId || 'generated-' + makeId();
  if (!externalId && !fallbackId && localId.length > 330) throw new IngestError('INVALID_ID', 'Invalid fallback ID');

  return {
    kind: eventType === 'message.status' ? 'status' : 'message',
    eventType,
    channelCode: code,
    channelType: type || null,
    provider: max(lower(top.provider), 120, 'provider'),
    accountId: max(lower(top.accountId ?? top.account), 300, 'accountId'),
    externalId,
    messageKey: localId,
    stableId: Boolean(externalId || fallbackId),
    externalUserId: userId || primaryJid || altJid,
    contactEmail: email,
    contactPhone: max(string(contact.phone ?? top.originPhone), 80, 'contact.phone'),
    contactName,
    contactFirstName,
    contactLastName,
    personId: string(contact.personId ?? top.personId) || null,
    personVerified: contact.verified === true,
    conversation,
    ...(proposedReply ? { proposedReply } : {}),
    aliases,
    message: {
      direction,
      senderType: sender as IngestEvent['message']['senderType'],
      deliveryStatus: status(message.deliveryStatus ?? top.deliveryStatus ?? (eventType === 'message.sent' ? 'SENT' : undefined), direction),
      body: body || (type === 'PHONE' ? (direction === 'OUTBOUND' ? 'Llamada saliente' : 'Llamada entrante')
        : '[Message without text or with attachment]'),
      subject: subject || (type === 'PHONE' ? 'Llamada telefónica' : 'Support enquiry'),
      fromAddress, toAddress,
      occurredAt: occurred.toISOString(),
      threadId: max(string(message.threadId ?? top.threadId), 350, 'threadId'),
      issueKey: max(string(message.issueKey ?? top.issueKey), 350, 'issueKey'),
      caseId: string(message.caseId ?? top.caseId),
      replyToExternalId: max(string(message.replyToExternalId ?? top.replyToMessageId), 300, 'replyToExternalId'),
      providerChatId: max(string(message.providerChatId ?? top.remoteJid), 300, 'providerChatId'),
      providerChatIdAlt: max(string(message.providerChatIdAlt ?? top.remoteJidAlt), 300, 'providerChatIdAlt'),
      providerAddressingMode: max(string(message.providerAddressingMode ?? top.providerAddressingMode), 80, 'providerAddressingMode'),
      callTranscription: message.callTranscription === undefined ? null : nullableText(message.callTranscription, 'message.callTranscription', 100000),
      callRecordingUrl: message.callRecordingUrl === undefined ? null : recordingUrl(message.callRecordingUrl, 'message.callRecordingUrl'),
    },
  };
}

/** Scope all external identifiers to one channel type, provider, and account. */
export function keys(event: IngestEvent, channel: { channelType: string; provider?: string; externalIdentifier?: string }) {
  const channelType = channel.channelType as ChannelType;
  if (event.channelType && event.channelType !== channelType) {
    throw new IngestError('CHANNEL_TYPE_MISMATCH', 'channelType does not match configured channel');
  }
  const configuredProvider = lower(channel.provider);
  if (configuredProvider && event.provider && configuredProvider !== event.provider) {
    throw new IngestError('PROVIDER_MISMATCH', 'Provider does not match the configured channel');
  }
  const provider = configuredProvider || event.provider || channelType.toLowerCase();
  const accountId = event.accountId || lower(channel.externalIdentifier);
  if (!accountId) throw new IngestError('MISSING_ACCOUNT', 'accountId or channel.externalIdentifier is required');
  if (event.accountId && channel.externalIdentifier && lower(channel.externalIdentifier) !== event.accountId) {
    throw new IngestError('ACCOUNT_MISMATCH', 'accountId does not match the configured channel');
  }
  const ns = [channelType, provider, accountId].join(':');
  const identityKey = event.externalUserId ? ns + ':USER:' + event.externalUserId : '';
  const messageKey = ns + ':MESSAGE:' + event.messageKey;
  const aliases = channelType === 'WHATSAPP'
    ? event.aliases.map(a => ({ ...a, externalKey: ns + ':' + a.aliasValue }))
    : [];
  return { channelType, provider, accountId, ns, identityKey, messageKey, aliases };
}
