import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';
import { IDS } from '../constants/ids.ts';
import { IngestError, normalizeEvent } from '../lib/ingestion/contract.ts';
import { ingest } from '../lib/ingestion/processor.ts';
import { TwentyRestIngestionStore } from '../lib/ingestion/twenty-rest-store.ts';
import { requireProposalKey } from '../lib/proposals/create.ts';

const proposalKeyHeader = 'x-omnichannel-proposal-key';

const handler = async (request: RoutePayload) => {
  // Do not log request bodies: they contain customer email addresses and messages.
  try {
    if (request.rawBody && Buffer.byteLength(request.rawBody, 'utf8') > 256_000) {
      return new Response({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE' } }, { status: 413 });
    }
    const event = normalizeEvent(request.body);
    if (event.proposedReply) {
      requireProposalKey(process.env.OMNICHANNEL_N8N_PROPOSAL_SECRET, request.headers[proposalKeyHeader]);
    }
    const result = await ingest(event, new TwentyRestIngestionStore(), {
      storage: kv, allowedOrigin: process.env.OMNICHANNEL_N8N_ORIGIN,
    });
    return new Response(result, {
      status: result.status === 'created' ? 201 : 200,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof IngestError) {
      return new Response(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status, headers: { 'cache-control': 'no-store' } },
      );
    }
    // A REST/SDK error must not expose credentials, URLs or private record content.
    console.error('[omnichannel-ingest] Unexpected processing failure', error instanceof Error ? error.name : 'UnknownError');
    return new Response(
      { ok: false, error: { code: 'INGESTION_FAILED', message: 'The event could not be saved; retry with the same stable message ID' } },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: IDS.INGEST_LOGIC_FUNCTION,
  name: 'omnichannel-ingest-message',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/omnichannel/v1/ingest',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: [proposalKeyHeader],
  },
});
