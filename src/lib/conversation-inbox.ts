import type { RestApiClient } from 'twenty-client-sdk/rest';
import { fetchAllRestRecords } from './rest-collections.ts';

export const conversationChannels = {
  EMAIL: 'Correo',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  TELEGRAM: 'Telegram',
  PHONE: 'Llamadas',
} as const;

export const conversationStatuses = {
  NEW: 'Nueva',
  IN_PROGRESS: 'En curso',
  WAITING_CUSTOMER: 'Esperando al cliente',
  HUMAN_REQUIRED: 'Pendiente humano',
  WAITING_INTERNAL: 'Gestión interna',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
  AUTOMATED: 'Automática',
  INFORMATIONAL: 'Informativa',
} as const;

export const conversationFollowUps = {
  NONE: 'Sin seguimiento',
  REQUIRED: 'Requiere seguimiento',
  SCHEDULED: 'Programado',
  WAITING_RESPONSE: 'Esperando respuesta',
  IN_PROGRESS: 'En seguimiento',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
} as const;

export type ConversationChannel = keyof typeof conversationChannels;
export type ConversationStatus = keyof typeof conversationStatuses;
export type ConversationFollowUp = keyof typeof conversationFollowUps;
export type ConversationFilters = {
  search?: string;
  channel?: ConversationChannel;
  status?: ConversationStatus;
  followUp?: ConversationFollowUp;
  channelInstanceId?: string;
  caseTypeId?: string;
  categoryId?: string;
  sort?: 'recent' | 'oldest';
};

export type ConversationRow = {
  id: string;
  subject?: string | null;
  channel?: ConversationChannel | null;
  status?: ConversationStatus | null;
  followUp?: ConversationFollowUp | null;
  channelInstanceId?: string | null;
  categoryId?: string | null;
  caseTypeId?: string | null;
  assignedTo?: string | null;
  lastMessageAt?: string | null;
  createdAt?: string | null;
  originEmail?: string | null;
  originPhone?: string | null;
};

export type ConversationDetails = {
  id: string;
  summary?: string | null;
  transcription?: string | null;
  recording?: { primaryLinkUrl?: string | null } | null;
};

export type ConversationCatalogItem = {
  id: string;
  name?: string | null;
  code?: string | null;
  channelType?: ConversationChannel | null;
};

export type ConversationView = { id: string; name: string; filters: ConversationFilters };
export type ConversationPage = { rows: ConversationRow[]; nextCursor: string | null; totalCount: number | null };
type RestEnvelope = { data?: Record<string, unknown>; pageInfo?: unknown; totalCount?: unknown };

export const CONVERSATION_PAGE_SIZE = 20;
export const CONVERSATION_SEARCH_LIMIT = 120;
export const CONVERSATION_VIEW_NAME_LIMIT = 80;

export function isRecordUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isOption<T extends string>(options: Record<T, string>, value: unknown): value is T {
  return typeof value === 'string' && Object.hasOwn(options, value);
}

export function normalizeConversationFilters(value: unknown): ConversationFilters {
  const candidate = asRecord(value) ?? {};
  const filters: ConversationFilters = {};
  if (isOption(conversationChannels, candidate.channel)) filters.channel = candidate.channel;
  if (isOption(conversationStatuses, candidate.status)) filters.status = candidate.status;
  if (isOption(conversationFollowUps, candidate.followUp)) filters.followUp = candidate.followUp;
  for (const field of ['channelInstanceId', 'caseTypeId', 'categoryId'] as const) {
    if (isRecordUuid(candidate[field])) filters[field] = candidate[field];
  }
  filters.sort = candidate.sort === 'oldest' ? 'oldest' : 'recent';
  const search = typeof candidate.search === 'string'
    ? candidate.search.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, CONVERSATION_SEARCH_LIMIT)
    : '';
  if (search) filters.search = search;
  return filters;
}

export function buildConversationFilter(value: unknown): string | undefined {
  const filters = normalizeConversationFilters(value);
  const predicates: string[] = [];
  for (const field of ['channel', 'status', 'followUp', 'channelInstanceId', 'caseTypeId', 'categoryId'] as const) {
    if (filters[field]) predicates.push(`${field}[eq]:${JSON.stringify(filters[field])}`);
  }
  if (filters.search) {
    // Twenty 2.50 strips the enclosing quotes without interpreting JSON escapes.
    const terms = filters.search.includes('"') && filters.search.includes("'")
      ? filters.search.split(/["']+/).map(term => term.trim()).filter(Boolean).slice(0, 6)
      : [filters.search];
    for (const term of terms) {
      const quote = term.includes('"') ? "'" : '"';
      const pattern = quote + '%' + term.replace(/[%_\\]/g, '\\$&') + '%' + quote;
      const fields = ['subject', 'originEmail', 'originPhone', 'summary'];
      predicates.push(`or(${fields.map(field => `${field}[ilike]:${pattern}`).join(',')})`);
    }
  }
  if (predicates.length > 1) return `and(${predicates.join(',')})`;
  return predicates[0];
}

export async function loadConversationPage(client: RestApiClient, filters: ConversationFilters, cursor?: string): Promise<ConversationPage> {
  const { sort } = normalizeConversationFilters(filters);
  const filter = buildConversationFilter(filters);
  const direction = sort === 'oldest' ? 'AscNullsLast' : 'DescNullsLast';
  const result = await client.get<RestEnvelope>('/rest/supportCases', {
    query: {
      fields: 'id,subject,channel,status,followUp,channelInstance,caseType,category,assignedTo,lastMessageAt,createdAt,originEmail,originPhone',
      depth: 0,
      order_by: `lastMessageAt[${direction}],id[AscNullsLast]`,
      limit: CONVERSATION_PAGE_SIZE,
      ...(filter ? { filter } : {}),
      ...(cursor ? { starting_after: cursor } : {}),
    },
  });
  const rows = result.data?.supportCases;
  if (!Array.isArray(rows)) throw new Error('CONVERSATION_RESPONSE_INVALID');
  const pagination = asRecord(result.pageInfo) ?? asRecord(result.data?.pageInfo);
  const rawTotal = result.totalCount ?? result.data?.totalCount;
  const totalCount = typeof rawTotal === 'number' && Number.isFinite(rawTotal) ? rawTotal : null;
  const nextCursor = pagination?.hasNextPage === true ? pagination.endCursor : null;
  if ((pagination && typeof pagination.hasNextPage !== 'boolean') ||
      (pagination?.hasNextPage === true && (typeof nextCursor !== 'string' || !nextCursor || nextCursor === cursor)) ||
      (!pagination && rows.length >= CONVERSATION_PAGE_SIZE)) throw new Error('CONVERSATION_CURSOR_INVALID');
  return { rows: rows as ConversationRow[], totalCount, nextCursor: typeof nextCursor === 'string' ? nextCursor : null };
}

export function loadConversationCatalog(client: RestApiClient, resource: 'supportChannels' | 'supportTypes' | 'supportCategories') {
  const fields = resource === 'supportChannels' ? 'id,name,code,channelType' : 'id,name,code';
  return fetchAllRestRecords<ConversationCatalogItem>(client, resource, fields);
}

export async function loadConversationDetails(client: RestApiClient, id: string): Promise<ConversationDetails> {
  if (!isRecordUuid(id)) throw new Error('CONVERSATION_ID_INVALID');
  const result = await client.get<RestEnvelope>('/rest/supportCases/' + id, {
    query: { fields: 'id,summary,transcription,recording', depth: 0 },
  });
  const record = asRecord(result.data?.supportCase);
  if (!record || record.id !== id) throw new Error('CONVERSATION_RESPONSE_INVALID');
  return record as ConversationDetails;
}

export function parseConversationView(value: unknown): ConversationView | null {
  const row = asRecord(value);
  if (!row || !isRecordUuid(row.id) || typeof row.viewName !== 'string' || typeof row.configJson !== 'string') return null;
  const name = row.viewName.trim();
  if (!name || name.length > CONVERSATION_VIEW_NAME_LIMIT || row.configJson.length > 2048) return null;
  try {
    const config = asRecord(JSON.parse(row.configJson));
    if (config?.version !== 1 || !asRecord(config.filters)) return null;
    return { id: row.id, name, filters: normalizeConversationFilters(config.filters) };
  } catch {
    return null;
  }
}

export async function loadConversationViews(client: RestApiClient): Promise<ConversationView[]> {
  const records = await fetchAllRestRecords<unknown>(client, 'supportConversationViews', 'id,viewName,configJson');
  return records.flatMap(record => {
    const view = parseConversationView(record);
    return view ? [view] : [];
  }).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

export async function saveConversationView(client: RestApiClient, inputName: string, inputFilters: ConversationFilters, id?: string): Promise<ConversationView> {
  const name = inputName.trim();
  if (!name || name.length > CONVERSATION_VIEW_NAME_LIMIT) throw new Error('CONVERSATION_VIEW_NAME_INVALID');
  const filters = normalizeConversationFilters(inputFilters);
  const payload = { viewName: name, configJson: JSON.stringify({ version: 1, filters }) };
  if (id !== undefined) {
    if (!isRecordUuid(id)) throw new Error('CONVERSATION_VIEW_ID_INVALID');
    await client.patch('/rest/supportConversationViews/' + id, payload);
    return { id, name, filters };
  }
  const response = await client.post<RestEnvelope>('/rest/supportConversationViews', payload);
  const savedId = asRecord(response.data?.createSupportConversationView)?.id;
  if (!isRecordUuid(savedId)) throw new Error('CONVERSATION_VIEW_DID_NOT_SAVE');
  return { id: savedId, name, filters };
}

export async function updateConversationStatus(client: RestApiClient, id: string, status: ConversationStatus): Promise<void> {
  if (!isRecordUuid(id) || !isOption(conversationStatuses, status)) throw new Error('CONVERSATION_STATUS_INVALID');
  await client.patch('/rest/supportCases/' + id, { status });
}
