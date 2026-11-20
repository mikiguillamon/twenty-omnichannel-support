import { RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import { kv, Response, type RoutePayload, type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';
import { IDS } from '../constants/ids.ts';
import { IngestError } from '../lib/ingestion/contract.ts';
import { TwentyRestIngestionStore } from '../lib/ingestion/twenty-rest-store.ts';
import { decideProposal, parseProposalDecision } from '../lib/proposals/decision.ts';
import { notifyN8nWait } from '../lib/proposals/n8n-wait.ts';

const headers = { 'cache-control': 'no-store' };
const problem = (code: string, message: string, status: number) =>
  new Response({ ok: false, error: { code, message } }, { status, headers });

const handler = async (request: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId || !context.userWorkspaceId) {
    return problem('PROPOSAL_REQUIRES_MEMBER', 'Decide the proposal as a workspace member', 403);
  }
  try {
    if (Buffer.byteLength(request.rawBody ?? JSON.stringify(request.body ?? null), 'utf8') > 220000) {
      return problem('PAYLOAD_TOO_LARGE', 'The proposed reply exceeds the request size limit', 413);
    }
    const applicationStore = new TwentyRestIngestionStore();
    const result = await decideProposal(parseProposalDecision(request.body), {
      caller: new TwentyRestIngestionStore(new RestApiClient()),
      decisionWriter: applicationStore,
      settings: applicationStore,
      storage: kv,
      allowedOrigin: process.env.OMNICHANNEL_N8N_ORIGIN,
      notify: (url, payload, key) => notifyN8nWait(url, payload, key, process.env.OMNICHANNEL_N8N_WAIT_SECRET),
    });
    return new Response(result, { status: 200, headers });
  } catch (error) {
    if (error instanceof IngestError) return problem(error.code, error.message, error.status);
    if (error instanceof RestApiClientError && (error.status === 401 || error.status === 403)) {
      return problem('PROPOSAL_WRITE_FORBIDDEN', 'You need permission to edit the message in Twenty', 403);
    }
    // Callback URLs and message text are never included in logs or failures.
    return problem('PROPOSAL_DECISION_FAILED', 'The decision could not be completed. Reload the proposal and check n8n if needed', 502);
  }
};

export default defineLogicFunction({
  universalIdentifier: IDS.PROPOSAL_DECIDE_LOGIC_FUNCTION,
  name: 'omnichannel-proposal-decision',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/omnichannel/v1/proposals/decide',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
