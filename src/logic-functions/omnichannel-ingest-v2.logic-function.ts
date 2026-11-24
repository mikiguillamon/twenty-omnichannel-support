import { defineLogicFunction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
import { ingestRequest } from '../lib/ingestion/route.ts';
import { proposalKeyHeader } from '../lib/proposals/create.ts';

export default defineLogicFunction({
  universalIdentifier: IDS.INGEST_V2_LOGIC_FUNCTION,
  name: 'omnichannel-ingest-message-v2',
  timeoutSeconds: 30,
  handler: ingestRequest,
  httpRouteTriggerSettings: {
    path: '/omnichannel/v2/ingest',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: [proposalKeyHeader],
  },
});
