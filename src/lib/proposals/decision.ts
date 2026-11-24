import { createHash } from 'node:crypto';
import { IngestError, PROPOSAL_BODY_LIMIT } from '../ingestion/contract.ts';
import { normalizeLineEndings } from '../message-text.ts';
import type { DbRecord, IngestionStore } from '../ingestion/processor.ts';
import { proposalStorageKey, type PrivateProposalStorage, type StoredProposalCallback } from './create.ts';
import { n8nWaitUrl } from './n8n-wait.ts';

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export type ProposalDecision = { messageId: string } & (
  { confirmed: true; message: string } | { confirmed: false }
);
export type WaitPayload = { proposalMessageId: string; caseId: string } & (
  { confirmed: true; message: string } | { confirmed: false }
);
export type WaitOutcome = 'accepted' | 'retryable' | 'uncertain';
export type ProposalDecisionResult = { ok: true; messageId: string; proposalStatus: 'CONFIRMED' | 'DISCARDED' };

export function parseProposalDecision(value: unknown): ProposalDecision {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const { messageId, confirmed, message } = record;
  if (Object.keys(record).some(key => key !== 'messageId' && key !== 'confirmed' && key !== 'message') ||
      typeof messageId !== 'string' || !uuid.test(messageId) || typeof confirmed !== 'boolean') {
    throw new IngestError('INVALID_PROPOSAL_DECISION', 'Expected messageId and a boolean confirmed');
  }
  if (confirmed && typeof message === 'string' && message.trim() && message.length <= PROPOSAL_BODY_LIMIT) {
    return { messageId, confirmed: true, message: normalizeLineEndings(message) };
  }
  if (!confirmed && !Object.hasOwn(record, 'message')) return { messageId, confirmed: false };
  throw new IngestError('INVALID_PROPOSAL_DECISION', 'Confirm with nonempty message text or discard without message');
}

type Dependencies = {
  caller: Pick<IngestionStore, 'get' | 'update'>;
  decisionWriter: Pick<IngestionStore, 'get' | 'update'>;
  settings: Pick<IngestionStore, 'list' | 'create' | 'update'>;
  storage: PrivateProposalStorage;
  allowedOrigin?: string;
  notify(url: URL, payload: WaitPayload, idempotencyKey: string): Promise<WaitOutcome>;
};

// Each attempt has a unique, immutable key. The database index elects one sender
// across invocations and replicas. Settings only contain a digest and a receipt.
const sending = 0;
const accepted = 1;
const retryable = 2;
const uncertain = 3;
const maxAttempts = 5;
const claimResource = 'supportSettings';
const messageResource = 'supportMessages';

function uncertainDecision(): IngestError {
  return new IngestError('N8N_WAIT_UNCERTAIN', 'Check the n8n execution before trying again; Wait did not confirm the decision', 409);
}

export async function decideProposal(decision: ProposalDecision, dependencies: Dependencies): Promise<ProposalDecisionResult> {
  const { caller, decisionWriter, settings, storage, allowedOrigin, notify } = dependencies;
  const { messageId, confirmed } = decision;
  const proposal = await caller.get(messageResource, messageId);
  if (!proposal || proposal.direction !== 'OUTBOUND' || proposal.senderType !== 'BOT' ||
      typeof proposal.supportCaseId !== 'string' || typeof proposal.proposalUpdateToken !== 'string' ||
      !uuid.test(proposal.proposalUpdateToken)) {
    throw new IngestError('PROPOSAL_NOT_FOUND', 'The proposed reply could not be found', 404);
  }
  const caseId = proposal.supportCaseId;
  const supportCase = await caller.get('supportCases', caseId);
  if (!supportCase) {
    throw new IngestError('PROPOSAL_NOT_FOUND', 'The conversation could not be found', 404);
  }
  const proposalStatus = confirmed ? 'CONFIRMED' : 'DISCARDED';
  const result: ProposalDecisionResult = { ok: true, messageId, proposalStatus };
  const privateKey = proposalStorageKey(proposal.proposalUpdateToken);
  function assertSameProposal(message: DbRecord | null): asserts message is DbRecord {
    if (!message || message.id !== messageId || message.supportCaseId !== caseId ||
        message.externalKey !== proposal?.externalKey || message.proposalUpdateToken !== proposal?.proposalUpdateToken ||
        message.direction !== 'OUTBOUND' || message.senderType !== 'BOT') {
      throw new IngestError('PROPOSAL_BINDING_CHANGED', 'The message no longer matches the original proposal', 409);
    }
  }
  function isFinal(message: DbRecord): boolean {
    if (message.proposalStatus === 'PENDING') return false;
    if (message.proposalStatus === proposalStatus && (!confirmed || message.draftBody === decision.message)) return true;
    throw new IngestError('PROPOSAL_ALREADY_DECIDED', 'The proposed reply already has a decision', 409);
  }

  if (isFinal(proposal)) return result;
  // The caller's own REST credential checks record and field-level write access.
  // This PATCH preserves an existing value and occurs before any callback.
  const authorized = await caller.update(messageResource, messageId, { direction: 'OUTBOUND' });
  assertSameProposal(authorized);
  if (isFinal(authorized)) return result;
  const callback = await storage.get<StoredProposalCallback>(privateKey);
  if (!callback || callback.caseId !== caseId || callback.externalKey !== proposal.externalKey) {
    throw new IngestError('PROPOSAL_CALLBACK_UNAVAILABLE', 'The Wait URL for this proposal is unavailable', 409);
  }

  const payload: WaitPayload = confirmed
    ? { confirmed: true, message: decision.message, proposalMessageId: messageId, caseId }
    : { confirmed: false, proposalMessageId: messageId, caseId };
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  async function finalize(): Promise<ProposalDecisionResult> {
    // The caller already proved write permission. Only the app's decision fields
    // use app access, after verifying this is still the same pending proposal.
    const latest = await decisionWriter.get(messageResource, messageId);
    assertSameProposal(latest);
    if (!isFinal(latest)) {
      await decisionWriter.update(messageResource, messageId, {
        proposalStatus, replyDecision: confirmed ? 'REPLY' : 'SKIP',
      });
    }
    await storage.delete?.(privateKey).catch(() => {});
    return result;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const key = `omnichannel.internal.proposal-decision.${messageId}.${attempt}`;
    const readClaim = async () => (await settings.list(claimResource, { key }, 1))[0];
    let claim = await readClaim();
    let ownedClaim: DbRecord | undefined;
    let url: URL | undefined;
    if (!claim) {
      url = n8nWaitUrl(callback.callbackUrl, allowedOrigin);
      try {
        ownedClaim = await settings.create(claimResource, {
          key, valueType: 'TEXT', valueText: digest, valueNumber: sending, enabled: false,
        });
      } catch (error) {
        // A commit can win even if its response was interrupted. A reread never
        // starts another callback unless that winner recorded definite rejection.
        claim = await readClaim();
        if (!claim) throw error;
      }
    }
    if (ownedClaim && url) {
      if (confirmed) {
        try {
          // Keep the reviewed text visible for a retry after a page reload.
          const reviewed = await caller.update(messageResource, messageId, { draftBody: decision.message });
          assertSameProposal(reviewed);
        } catch (error) {
          await settings.update(claimResource, ownedClaim.id, { valueNumber: retryable });
          throw error;
        }
      }

      const outcome = await notify(url, payload, messageId).catch(() => 'uncertain');
      if (outcome === 'accepted') {
        // An accepted callback is never repeated, even when publishing the final
        // proposal status fails. Recording the receipt first makes that repairable.
        await settings.update(claimResource, ownedClaim.id, { valueNumber: accepted }).catch(() => {});
        return finalize();
      }
      await settings.update(claimResource, ownedClaim.id, { valueNumber: outcome === 'retryable' ? retryable : uncertain });
      if (outcome === 'retryable') {
        throw new IngestError('N8N_WAIT_RETRYABLE', 'Wait rejected the request. Check that n8n is waiting and retry the same decision', 502);
      }
      throw uncertainDecision();
    }
    if (!claim || claim.valueText !== digest) {
      throw new IngestError('PROPOSAL_DECISION_CONFLICT', 'A different decision already controls this proposal', 409);
    }
    if (claim.valueNumber === retryable) continue;
    if (claim.valueNumber === accepted) return finalize();
    const started = typeof claim.createdAt === 'string' ? Date.parse(claim.createdAt) : Date.now();
    if (claim.valueNumber === sending && Date.now() - started < 45000) {
      throw new IngestError('PROPOSAL_DECISION_IN_PROGRESS', 'The decision is already being sent to n8n', 409);
    }
    throw uncertainDecision();
  }
  throw new IngestError('N8N_WAIT_RETRY_LIMIT', 'Check the n8n execution. This proposal reached its retry limit', 409);
}
