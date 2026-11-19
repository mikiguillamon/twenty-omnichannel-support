import { RestApiClient } from 'twenty-client-sdk/rest';

export type FaqStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type FaqLanguage = 'ES' | 'CA' | 'EN';

export type SupportFaq = {
  id: string;
  question: string | null;
  answer: string | null;
  variants?: string | null;
  language?: FaqLanguage | null;
  status?: FaqStatus | null;
  categoryId?: string | null;
  scopeTags?: string[] | null;
  tags?: string[] | null;
  customTags?: string[] | null;
  sourceUrl?: string | null;
  updatedByReference?: string | null;
  revision?: number | null;
  publishedAt?: string | null;
  lastSyncedAt?: string | null;
};

export type SupportFaqCategory = {
  id: string;
  name?: string | null;
  code?: string | null;
  enabled?: boolean | null;
};

export type FaqEditor = {
  question: string;
  answer: string;
  categoryId: string;
  language: FaqLanguage;
  status: FaqStatus;
  variants: string;
  scopeTags: string;
  tags: string[];
  customTags: string;
  sourceUrl: string;
  updatedByReference: string;
};

export const FAQ_FIELDS = [
  'id', 'question', 'answer', 'category', 'status', 'language', 'scopeTags',
  'variants', 'tags', 'customTags', 'sourceUrl', 'updatedByReference',
  'revision', 'publishedAt', 'lastSyncedAt',
].join(',');

// REST depth=0 returns the join column categoryId for the relation field category.
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
  resource: 'supportFaqs' | 'supportCategories',
  fields: string,
): Promise<T[]> {
  const output: T[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const query: Record<string, string | number> = {
      fields, depth: 0, limit: PAGE_SIZE, order_by: 'id[AscNullsLast]',
    };
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

export function normalizeFaqText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/\s+/g, ' ').trim();
}

export function filterFaqs(
  faqs: SupportFaq[],
  options: { query: string; status: string; language: string; scope: string },
): SupportFaq[] {
  const query = normalizeFaqText(options.query);
  return faqs.filter(faq => {
    if (options.status === 'active' && faq.status === 'ARCHIVED') return false;
    if (options.status !== 'active' && options.status !== 'all' && faq.status !== options.status) return false;
    if (options.language !== 'all' && faq.language !== options.language) return false;
    if (options.scope === 'none' && (faq.scopeTags?.length ?? 0) !== 0) return false;
    if (options.scope !== 'all' && options.scope !== 'none' &&
      !faq.scopeTags?.some(value => normalizeFaqText(value) === normalizeFaqText(options.scope))) return false;
    if (!query) return true;
    return normalizeFaqText([
      faq.question ?? '', faq.answer ?? '', faq.variants ?? '',
      ...(faq.scopeTags ?? []), ...(faq.customTags ?? []),
    ].join(' ')).includes(query);
  });
}

export function parseFaqList(value: string, maxItems = 30): string[] {
  const items: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.split(/[,\n]/)) {
    const item = candidate.trim();
    if (!item) continue;
    if (item.length > 64 || /[\u0000-\u001f]/.test(item)) throw new Error('INVALID_FAQ_TAG');
    const key = normalizeFaqText(item);
    if (!seen.has(key)) { items.push(item); seen.add(key); }
    if (items.length > maxItems) throw new Error('TOO_MANY_FAQ_TAGS');
  }
  return items;
}

export function blankFaqEditor(): FaqEditor {
  return {
    question: '', answer: '', categoryId: '', language: 'CA', status: 'DRAFT',
    variants: '', scopeTags: 'GENERAL', tags: [], customTags: '',
    sourceUrl: '', updatedByReference: '',
  };
}

export function editorFromFaq(faq: SupportFaq): FaqEditor {
  return {
    question: faq.question ?? '', answer: faq.answer ?? '',
    categoryId: faq.categoryId ?? '', language: faq.language ?? 'CA',
    status: faq.status ?? 'DRAFT', variants: faq.variants ?? '',
    scopeTags: (faq.scopeTags ?? []).join('\n'), tags: faq.tags ?? [],
    customTags: (faq.customTags ?? []).join('\n'),
    sourceUrl: faq.sourceUrl ?? '', updatedByReference: faq.updatedByReference ?? '',
  };
}

export function faqEditorPayload(editor: FaqEditor, previous?: SupportFaq): Record<string, unknown> {
  const question = editor.question.trim();
  const answer = editor.answer.trim();
  if (!question || !answer) throw new Error('QUESTION_ANSWER_REQUIRED');
  if (question.length > 2000 || answer.length > 25000 || editor.variants.length > 12000)
    throw new Error('FAQ_TOO_LONG');
  if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(editor.status) ||
      !['ES', 'CA', 'EN'].includes(editor.language)) throw new Error('FAQ_INVALID_SELECTION');
  const scopes = parseFaqList(editor.scopeTags);
  const customTags = parseFaqList(editor.customTags);
  const sourceUrl = editor.sourceUrl.trim();
  if (sourceUrl && (!/^https:\/\//i.test(sourceUrl) || sourceUrl.length > 2000))
    throw new Error('INVALID_FAQ_URL');
  const payload: Record<string, unknown> = {
    question, answer, categoryId: editor.categoryId || null, language: editor.language,
    status: editor.status, variants: editor.variants.trim(), scopeTags: scopes,
    tags: editor.tags, customTags, sourceUrl,
    updatedByReference: editor.updatedByReference.trim(),
  };
  if (editor.status === 'PUBLISHED' && !previous?.publishedAt)
    payload.publishedAt = new Date().toISOString();
  return payload;
}
