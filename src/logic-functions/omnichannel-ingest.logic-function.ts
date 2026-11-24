import { defineLogicFunction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
import { ingestRequest } from '../lib/ingestion/route.ts';
import { proposalKeyHeader } from '../lib/proposals/create.ts';

export default defineLogicFunction({
  universalIdentifier: IDS.INGEST_LOGIC_FUNCTION,
  name: 'omnichannel-ingest-message',
  timeoutSeconds: 30,
  handler: ingestRequest,
  httpRouteTriggerSettings: {
    path: '/omnichannel/v1/ingest',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: [proposalKeyHeader],
  },
});
