import { RestApiClientError } from 'twenty-client-sdk/rest';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { IngestError } from './contract.ts';

const headers = { 'cache-control': 'no-store' };

export async function integrationResponse(
  request: RoutePayload, run: () => Promise<object>, failureCode: string,
) {
  try {
    if (Buffer.byteLength(request.rawBody ?? JSON.stringify(request.body ?? null), 'utf8') > 256_000) {
      throw new IngestError('PAYLOAD_TOO_LARGE', 'The request exceeds the payload size limit', 413);
    }
    const result = await run();
    return new Response({ ...result, ok: true }, {
      status: 'status' in result && result.status === 'created' ? 201 : 200,
      headers,
    });
  } catch (error) {
    if (error instanceof IngestError) {
      return new Response({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status, headers });
    }
    if (error instanceof RestApiClientError && [401, 403].includes(error.status ?? 0)) {
      return new Response({ ok: false, error: { code: 'INSUFFICIENT_PERMISSIONS' } }, { status: 403, headers });
    }
    // Neither REST errors nor request bodies belong in integration responses.
    return new Response({ ok: false, error: { code: failureCode } }, { status: 502, headers });
  }
}
