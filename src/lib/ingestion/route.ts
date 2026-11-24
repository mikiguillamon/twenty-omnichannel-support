import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';
import { IngestError, normalizeEvent } from './contract.ts';
import { ingest } from './processor.ts';
import { TwentyRestIngestionStore } from './twenty-rest-store.ts';
import { proposalKeyHeader, requireProposalKey } from '../proposals/create.ts';

export const ingestRequest = async (request: RoutePayload) => {
  // Do not log request bodies: they contain customer email addresses and messages.
  try {
    if (request.rawBody && Buffer.byteLength(request.rawBody, 'utf8') > 256_000) {
      return new Response({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE' } }, { status: 413 });
    }
    const event = normalizeEvent(request.body);
    if (event.proposedReply) {
      requireProposalKey(process.env.OMNICHANNEL_N8N_PROPOSAL_SECRET, request.headers[proposalKeyHeader],
        process.env.OMNICHANNEL_N8N_CREDENTIAL_FINGERPRINT);
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
