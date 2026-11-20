import type { RestApiClient } from 'twenty-client-sdk/rest';

const PAGE_SIZE = 60;
const MAX_PAGES = 50;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function readRestCollection<T>(response: unknown, resource: string): {
  records: T[];
  nextCursor: string | null;
} {
  const root = asRecord(response);
  const data = asRecord(root?.data) ?? root;
  const rows = data?.[resource];
  if (!Array.isArray(rows)) throw new Error('REST_COLLECTION_INVALID');
  const info = asRecord(root?.pageInfo) ?? asRecord(data?.pageInfo);
  if (!info) {
    if (rows.length === PAGE_SIZE) throw new Error('REST_CURSOR_MISSING');
    return { records: rows as T[], nextCursor: null };
  }
  if (typeof info.hasNextPage !== 'boolean') throw new Error('REST_PAGE_INFO_INVALID');
  if (!info.hasNextPage) return { records: rows as T[], nextCursor: null };
  if (typeof info.endCursor !== 'string' || !info.endCursor)
    throw new Error('REST_CURSOR_MISSING');
  return { records: rows as T[], nextCursor: info.endCursor };
}

export async function fetchAllRestRecords<T>(
  client: RestApiClient,
  resource: string,
  fields: string,
  filter?: string,
): Promise<T[]> {
  const output: T[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const query: Record<string, string | number> = {
      fields, depth: 0, limit: PAGE_SIZE, order_by: 'id[AscNullsLast]',
    };
    if (filter) query.filter = filter;
    if (cursor) query.starting_after = cursor;
    const response: unknown = await client.get('/rest/' + resource, { query });
    const result = readRestCollection<T>(response, resource);
    output.push(...result.records);
    if (!result.nextCursor) return output;
    if (seen.has(result.nextCursor)) throw new Error('REST_CURSOR_LOOP');
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error('REST_TOO_MANY_RECORDS');
}
