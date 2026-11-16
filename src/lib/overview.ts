/** Twenty REST find-many returns a top-level totalCount, not a GraphQL connection. */
export function readTotalCount(response: unknown): number | null {
  if (!response || typeof response !== 'object') return null;
  const value = (response as Record<string,unknown>).totalCount;
  return typeof value==='number' && Number.isSafeInteger(value) && value>=0 ? value : null;
}
