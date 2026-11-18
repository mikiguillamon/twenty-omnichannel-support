/**
 * Message events can arrive from providers and n8n out of order.
 * Sort by the original event time, independently of API/ingestion order.
 * Missing or invalid dates belong at the end of the timeline.
 */
export type ChronologicalMessage = {
  id: string;
  occurredAt?: string | null;
};

const eventTimestamp = (value: string | null | undefined): number => {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

export function sortMessagesChronologically<T extends ChronologicalMessage>(messages: readonly T[]): T[] {
  return [...messages].sort((left, right) => {
    const leftTime = eventTimestamp(left.occurredAt);
    const rightTime = eventTimestamp(right.occurredAt);
    if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1;
    // A stable, deterministic tie-breaker for events sharing a timestamp.
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}
