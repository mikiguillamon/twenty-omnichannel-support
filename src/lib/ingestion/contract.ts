import { randomUUID } from 'node:crypto';

/** The public contract is intentionally provider-agnostic. Old flat n8n payloads also work. */
export type ChannelType = 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'TELEGRAM';
export type Direction = 'INBOUND' | 'OUTBOUND';
export type DeliveryStatus = 'RECEIVED' | 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
export type GroupingMode = 'THREAD' | 'MESSAGE' | 'HYBRID' | 'SESSION' | 'MANUAL';

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
  personId: string | null;
  personVerified: boolean;
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
  };
  aliases: { externalKey: string; aliasType: 'WHATSAPP_PN' | 'WHATSAPP_LID'; aliasValue: string }[];
};

export class IngestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = 'IngestError';
  }
}

type Dict = Record<string, unknown>;
const object = (value: unknown): Dict =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : {};
const string = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const lower = (value: unknown): string => string(value).toLowerCase();

function max(value: string, limit: number, name: string): string {
  if (value.length > limit) throw new IngestError('FIELD_TOO_LONG', name + ' exceeds ' + limit + ' characters');
  return value;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JID = /^[0-9]+@(s\.whatsapp\.net|lid)$/;
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
  if (suppliedType && !['EMAIL', 'WHATSAPP', 'INSTAGRAM', 'TELEGRAM'].includes(suppliedType)) {
    throw new IngestError('INVALID_CHANNEL', 'Unsupported channelType');
  }
  const directionValue = string(message.direction ?? top.direction).toUpperCase() || 'INBOUND';
  if (directionValue !== 'INBOUND' && directionValue !== 'OUTBOUND') {
    throw new IngestError('INVALID_DIRECTION', 'Direction must be INBOUND or OUTBOUND');
  }
  const direction = directionValue as Direction;
  const typeRaw = string(top.eventType) || (direction === 'OUTBOUND' ? 'message.sent' : 'message.received');
  if (!['message.received', 'message.sent', 'message.status'].includes(typeRaw)) {
    throw new IngestError('INVALID_EVENT_TYPE', 'Unsupported eventType');
  }
  const eventType = typeRaw as IngestEvent['eventType'];
  const externalId = max(string(message.externalId ?? message.messageId ?? top.messageId ?? top.externalMessageId), 300, 'messageId') || null;
  const fallbackId = max(string(message.idempotencyKey ?? top.idempotencyKey), 300, 'idempotencyKey');
  if (eventType === 'message.status' && !externalId) {
    throw new IngestError('MISSING_MESSAGE_ID', 'A status event requires the original provider message ID');
  }

  const fromAddress = max(string(message.fromAddress ?? message.from ?? top.fromAddress), 500, 'fromAddress');
  const toAddress = max(string(message.toAddress ?? message.to ?? top.toAddress), 500, 'toAddress');
  const email = lower(contact.email ?? top.customerEmail ??
    (suppliedType === 'EMAIL' ? (direction === 'OUTBOUND' ? toAddress : fromAddress) : ''));
  if (email && !EMAIL.test(email)) throw new IngestError('INVALID_EMAIL', 'Invalid contact.email');
  const type = suppliedType as ChannelType | '';
  const userId = max(lower(contact.externalId ?? contact.externalUserId ?? top.externalUserId) ||
    (type === 'EMAIL' ? email : ''), 300, 'externalUserId');

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

  const body = max(string(message.body ?? message.text ?? top.body), 100000, 'body');
  const subject = max(string(message.subject ?? top.subject), 500, 'subject');
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
    contactName: max(string(contact.name ?? top.displayName), 500, 'contact.name'),
    personId: string(contact.personId ?? top.personId) || null,
    personVerified: contact.verified === true,
    aliases,
    message: {
      direction,
      senderType: sender as IngestEvent['message']['senderType'],
      deliveryStatus: status(message.deliveryStatus ?? top.deliveryStatus, direction),
      body: body || '[Message without text or with attachment]',
      subject: subject || 'Support enquiry',
      fromAddress, toAddress,
      occurredAt: occurred.toISOString(),
      threadId: max(string(message.threadId ?? top.threadId), 350, 'threadId'),
      issueKey: max(string(message.issueKey ?? top.issueKey), 350, 'issueKey'),
      caseId: string(message.caseId ?? top.caseId),
      replyToExternalId: max(string(message.replyToExternalId ?? top.replyToMessageId), 300, 'replyToExternalId'),
      providerChatId: max(string(message.providerChatId ?? top.remoteJid), 300, 'providerChatId'),
      providerChatIdAlt: max(string(message.providerChatIdAlt ?? top.remoteJidAlt), 300, 'providerChatIdAlt'),
      providerAddressingMode: max(string(message.providerAddressingMode ?? top.providerAddressingMode), 80, 'providerAddressingMode'),
    },
  };
}

/** Scope all external identifiers to one channel type, provider, and account. */
export function keys(event: IngestEvent, channel: { channelType: string; provider?: string; externalIdentifier?: string }) {
  const channelType = channel.channelType as ChannelType;
  if (event.channelType && event.channelType !== channelType) {
    throw new IngestError('CHANNEL_TYPE_MISMATCH', 'channelType does not match configured channel');
  }
  const provider = event.provider || lower(channel.provider) || channelType.toLowerCase();
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
