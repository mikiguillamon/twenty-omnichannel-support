import { defineLogicFunction } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';
import { IDS } from '../constants/ids.ts';
import { integrationResponse } from '../lib/ingestion/integration-response.ts';
import { TwentyRestIngestionStore } from '../lib/ingestion/twenty-rest-store.ts';
import { proposalKeyHeader, proposeReply, requireProposalKey } from '../lib/proposals/create.ts';

export default defineLogicFunction({
  universalIdentifier: IDS.PROPOSAL_CREATE_LOGIC_FUNCTION,
  name: 'omnichannel-proposal-create',
  timeoutSeconds: 30,
  handler: request => integrationResponse(request, async () => {
    requireProposalKey(process.env.OMNICHANNEL_N8N_PROPOSAL_SECRET, request.headers[proposalKeyHeader],
      process.env.OMNICHANNEL_N8N_CREDENTIAL_FINGERPRINT);
    return proposeReply(request.body, new TwentyRestIngestionStore(), kv, process.env.OMNICHANNEL_N8N_ORIGIN);
  }, 'PROPOSAL_CREATION_FAILED'),
  httpRouteTriggerSettings: {
    path: '/omnichannel/v1/proposals/create',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: [proposalKeyHeader],
  },
});
