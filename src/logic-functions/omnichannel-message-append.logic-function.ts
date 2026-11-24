import { defineLogicFunction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
import { integrationResponse } from '../lib/ingestion/integration-response.ts';
import { appendMessage } from '../lib/ingestion/processor.ts';
import { TwentyRestIngestionStore } from '../lib/ingestion/twenty-rest-store.ts';
import { proposalKeyHeader, requireProposalKey } from '../lib/proposals/create.ts';

export default defineLogicFunction({
  universalIdentifier: IDS.MESSAGE_APPEND_LOGIC_FUNCTION,
  name: 'omnichannel-message-append',
  timeoutSeconds: 30,
  handler: request => integrationResponse(request, () => {
    // API-key invocations in Twenty 2.50 run with the application token.
    requireProposalKey(process.env.OMNICHANNEL_N8N_PROPOSAL_SECRET, request.headers[proposalKeyHeader],
      process.env.OMNICHANNEL_N8N_CREDENTIAL_FINGERPRINT);
    return appendMessage(request.body, new TwentyRestIngestionStore());
  }, 'MESSAGE_APPEND_FAILED'),
  httpRouteTriggerSettings: {
    path: '/omnichannel/v1/messages/append',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: [proposalKeyHeader],
  },
});
