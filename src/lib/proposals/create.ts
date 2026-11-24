import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { IngestError, isRecordId, normalizeProposedReply, type ProposedReply } from '../ingestion/contract.ts';
import type { DbRecord, IngestionStore } from '../ingestion/processor.ts';
import { n8nWaitUrl } from './n8n-wait.ts';

export type StoredProposalCallback = { externalKey: string; caseId: string; callbackUrl: string };
export type ProposalReceipt = {
  proposalMessageId: string;
  proposalStatus: 'PENDING' | 'CONFIRMED' | 'DISCARDED';
};

export interface PrivateProposalStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete?(key: string): Promise<boolean>;
}

export const proposalStorageKey = (token: string) => `omnichannel:proposal:${token}`;
export const proposalKeyHeader = 'x-omnichannel-proposal-key';

export function requireProposalKey(legacyKey: string | undefined, received: string | undefined, fingerprint?: string): void {
  const paired = fingerprint?.trim().toLowerCase() ?? '';
  if (!legacyKey?.trim() && !/^[a-f0-9]{64}$/.test(paired)) {
    throw new IngestError('N8N_PROPOSAL_KEY_NOT_CONFIGURED', 'Pair the Twenty credential in Omnichannel application settings', 503);
  }
  if (received) {
    const digest = (value: string) => createHash('sha256').update(value).digest();
    const actual = digest(received);
    if (legacyKey?.trim() && timingSafeEqual(digest(legacyKey), actual)) return;
    if (/^twenty-v2\.[a-f0-9]{64}$/.test(received) && /^[a-f0-9]{64}$/.test(paired) &&
        timingSafeEqual(Buffer.from(paired, 'hex'), actual)) return;
  }
  throw new IngestError('N8N_PROPOSAL_KEY_FORBIDDEN', 'The n8n integration credential is invalid', 403);
}

export async function proposeReply(
  value: unknown, store: IngestionStore, storage: PrivateProposalStorage, allowedOrigin?: string,
): Promise<ProposalReceipt & { caseId: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new IngestError('INVALID_PROPOSAL', 'Expected messageId, body and callbackUrl');
  }
  const { messageId, ...fields } = value as Record<string, unknown>;
  if (!isRecordId(messageId)) {
    throw new IngestError('INVALID_PROPOSAL', 'messageId must be the Twenty ID of an incoming message');
  }
  const proposal = normalizeProposedReply(fields);
  proposal.callbackUrl = n8nWaitUrl(proposal.callbackUrl, allowedOrigin).href;
  const source = await store.get('supportMessages', messageId);
  if (!source || source.direction !== 'INBOUND') {
    throw new IngestError('PROPOSAL_SOURCE_NOT_FOUND', 'The incoming message could not be found', 404);
  }
  const caseId = source.supportCaseId;
  if (typeof caseId !== 'string' || !caseId || !await store.get('supportCases', caseId)) {
    throw new IngestError('PROPOSAL_CASE_MISSING', 'The incoming message has no accessible conversation', 409);
  }
  return { ...await createProposal(store, storage, source, proposal), caseId };
}

export async function createProposal(
  store: IngestionStore,
  storage: PrivateProposalStorage,
  inbound: DbRecord,
  proposal: ProposedReply,
): Promise<ProposalReceipt> {
  const caseId = inbound.supportCaseId;
  if (typeof caseId !== 'string' || !caseId) {
    throw new IngestError('PROPOSAL_CASE_MISSING', 'The incoming message has no conversation', 409);
  }
  const externalKey = 'omnichannel:proposal:v1:' + createHash('sha256').update(inbound.id).digest('hex');
  const existing = async () => {
    const [record] = await store.list('supportMessages', { externalKey }, 1);
    if (record && (record.supportCaseId !== caseId || !record.proposalUpdateToken)) {
      throw new IngestError('PROPOSAL_CONFLICT', 'The proposal references a different conversation', 409);
    }
    return record;
  };
  async function receipt(record: DbRecord): Promise<ProposalReceipt> {
    const { proposalStatus, proposalUpdateToken } = record;
    if (proposalStatus === 'CONFIRMED' || proposalStatus === 'DISCARDED') {
      return { proposalMessageId: record.id, proposalStatus };
    }
    if (proposalStatus !== 'PENDING' || typeof proposalUpdateToken !== 'string') {
      throw new IngestError('PROPOSAL_CONFLICT', 'The proposed reply is unavailable', 409);
    }
    const callback = await storage.get<StoredProposalCallback>(proposalStorageKey(proposalUpdateToken));
    if (!callback || callback.caseId !== caseId || callback.externalKey !== externalKey) {
      throw new IngestError('PROPOSAL_CALLBACK_UNAVAILABLE', 'The Wait URL for this proposal is unavailable', 409);
    }
    if (callback.callbackUrl !== proposal.callbackUrl) {
      throw new IngestError('PROPOSAL_CALLBACK_CONFLICT', 'The pending proposal belongs to another n8n execution', 409);
    }
    return { proposalMessageId: record.id, proposalStatus };
  }
  const saved = await existing();
  if (saved) return receipt(saved);

  const token = randomUUID();
  const privateKey = proposalStorageKey(token);
  await storage.set<StoredProposalCallback>(privateKey, { callbackUrl: proposal.callbackUrl, externalKey, caseId });
  try {
    const receivedAt = typeof inbound.occurredAt === 'string' ? Date.parse(inbound.occurredAt) : NaN;
    const occurredAt = new Date(Math.max(Date.now(), Number.isFinite(receivedAt) ? receivedAt + 1 : 0)).toISOString();
    const message = await store.create('supportMessages', {
      externalKey,
      supportCaseId: caseId,
      direction: 'OUTBOUND',
      senderType: 'BOT',
      deliveryStatus: 'PENDING',
      replyDecision: 'PENDING_REVIEW',
      proposalStatus: 'PENDING',
      proposalUpdateToken: token,
      draftBody: proposal.body,
      occurredAt,
      ...(inbound.externalKey ? { replyToExternalKey: inbound.externalKey } : {}),
      ...(inbound.subject ? { subject: inbound.subject } : {}),
      ...(inbound.provider ? { provider: inbound.provider } : {}),
      ...(inbound.fromAddress ? { toAddress: inbound.fromAddress } : {}),
      ...(inbound.toAddress ? { fromAddress: inbound.toAddress } : {}),
    });
    return { proposalMessageId: message.id, proposalStatus: 'PENDING' };
  } catch (error) {
    // A concurrent request or a write whose response was lost can win the unique insert.
    const winner = await existing();
    if (!winner) throw error;
    if (winner.proposalUpdateToken !== token) await storage.delete?.(privateKey).catch(() => {});
    return receipt(winner);
  }
}
