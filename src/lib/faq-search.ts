import { normalizeFaqScopes, faqScopePredicate } from './faq-scopes.ts';

export type FaqLanguage = 'ES' | 'CA' | 'EN' | 'auto';
export type FaqSearchRequest = { query: string; scopeTags: string[]; language: FaqLanguage; limit: number };
export type FaqRecord = { id: string; question?: string; answer?: string; variants?: string; language?: string;
  status?: string; scopeTags?: string[] | null };
export type FaqResult = { id: string; question: string; answer: string; language: string;
  score: number; matchedFields: string[] };
export type SearchResponse = { ok: true; query: string; results: FaqResult[]; count: number };

export class FaqSearchError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const MAX_QUERY_LENGTH = 320;
const MAX_CANDIDATES = 200;
const PAGE_SIZE = 50;
const STOPWORDS = new Set(('a al els las los les el la l de del des dels d en per por para con contra ' +
  'i y o u un una unos unas uns unes es son se ser estar està està com como cómo que què qui quien quien ' +
  'puedo puedo-me puedo puedo com puc puedo puedo hacer fer vull quiero voldria voldría ' +
  'mi mis me meu meus seva seva la seva ho lo a sobre sobre si sí no ' +
  'the are how can i my do does what where please to for with of is it').split(/\s+/));

/** Curated spelling/linguistic equivalents supplement, but never replace, user-authored FAQ variants. */
const EQUIVALENCES: Record<string, string[]> = {
  baja: ['baixa', 'cancelar', 'cancel·lació', 'cancelacion'],
  baixa: ['baja', 'cancelar', 'cancel·lacio', 'cancelación'],
  abono: ['abonament', 'abonnement', 'subscripcion', 'suscripcion', 'suscripción'],
  abonament: ['abono', 'suscripcion', 'subscripció'],
  cuota: ['quota', 'mensualidad', 'mensualitat'],
  quota: ['cuota', 'mensualitat'],
  horario: ['horari', 'horarios', 'horaris'],
  horari: ['horario', 'horarios', 'horaris'],
  inscripcion: ['inscripció', 'inscripcion', 'inscripcions', 'apuntarse', 'apuntar'],
  inscripcio: ['inscripción', 'inscripcions', 'inscripcion', 'apuntar'],
  reserva: ['reservar', 'reserves', 'reservas'],
  pago: ['pagament', 'pagar', 'pagos'],
  pagament: ['pago', 'pagar', 'pagos'],
  precio: ['preu', 'precio', 'precios', 'preus'],
  preu: ['precio', 'precios', 'preus'],
  socios: ['socis', 'soci', 'socio'],
  soci: ['socio', 'socios', 'socis'],
  cancelacion: ['cancel·lacio', 'cancelación', 'baixa', 'baja'],
  devolucion: ['devolució', 'reemborsament', 'reembolso'],
  renovacion: ['renovació', 'renovar'],
  entrada: ['entrades', 'entradas', 'tickets'],
};
export function normalizeText(input: string): string {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/ł/g,'l').replace(/·/g,'').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function stem(term: string): string {
  if (term.length < 5) return term;
  return term.replace(/(ments|ciones|cions|ments|mente|idades|itat|idad|acions|acion|acio|cios|cias|es|s)$/,'');
}
export function tokenize(value: string): string[] {
  return [...new Set(normalizeText(value).split(' ').filter(w => w.length >= 2 && !STOPWORDS.has(w)))].slice(0, 12);
}
export function parseFaqSearchRequest(raw: unknown): FaqSearchRequest {
  if (!raw || Array.isArray(raw) || typeof raw !== 'object')
    throw new FaqSearchError('INVALID_REQUEST', 'Expected a JSON object.');
  const r = raw as Record<string, unknown>;
  if (Object.keys(r).some(k => !['query','scopeTags','language','limit'].includes(k)))
    throw new FaqSearchError('INVALID_REQUEST', 'Unsupported search parameter.');
  if (typeof r.query !== 'string' || !r.query.trim() || r.query.length > MAX_QUERY_LENGTH || /[\u0000-\u001f]/.test(r.query))
    throw new FaqSearchError('INVALID_QUERY', 'Query must contain 1 to 320 characters.');
  // Scope is a retrieval filter controlled by the authenticated caller, NOT a permission.
  // Missing or empty scopes restrict the search to GENERAL only.
  let scopeTags: string[];
  if (r.scopeTags === undefined) scopeTags = [];
  else {
    if (!Array.isArray(r.scopeTags) || r.scopeTags.length > 12 ||
        r.scopeTags.some(scope => typeof scope !== 'string' || !scope.trim())) {
      throw new FaqSearchError('INVALID_SCOPE', 'scopeTags must be an array of up to 12 nonempty strings.');
    }
    try { scopeTags = normalizeFaqScopes(r.scopeTags); }
    catch { throw new FaqSearchError('INVALID_SCOPE', 'Invalid scopeTags values.'); }
  }
  const language = r.language ?? 'auto';
  if (!['auto','ES','CA','EN'].includes(String(language)))
    throw new FaqSearchError('INVALID_LANGUAGE', 'Expected auto, ES, CA or EN.');
  const limit = r.limit ?? 5;
  if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 10)
    throw new FaqSearchError('INVALID_LIMIT', 'Limit must be between 1 and 10.');
  return {query:r.query.trim(),scopeTags,language:language as FaqLanguage,limit:Number(limit)};
}

function relatedTerms(token: string): string[] {
  return [...new Set([token,...(EQUIVALENCES[token] ?? []),...(Object.entries(EQUIVALENCES)
    .filter(([,values])=>values.some(v=>normalizeText(v)===token)).map(([k])=>k))])]
    .map(normalizeText).filter(x=>x && !x.includes(' ')).slice(0,7);
}
export function conceptsFor(query: string): string[][] {
  const words = tokenize(query);
  if (!words.length) throw new FaqSearchError('INVALID_QUERY','Query has no searchable concepts.');
  return words.slice(0,6).map(relatedTerms);
}
function includesConcept(haystack: string, terms: string[]) {
  return terms.some(t=>haystack.includes(t) || (t.length>=5 && haystack.split(' ').some(w=>stem(w)===stem(t))));
}
export function rankFaq(faq: FaqRecord, query: string, concepts: string[][]): FaqResult | null {
  const q = normalizeText(query);
  const question = normalizeText(faq.question || '');
  const variants = (faq.variants || '').split(/\r?\n/).map(normalizeText).filter(Boolean);
  const answer = normalizeText(faq.answer || '');
  if (!faq.id || !question || !answer) return null;
  let score = 0;
  const fields: string[] = [];
  if (question === q) {score += 100;fields.push('question');}
  // A literal match wins a tie with a normalized punctuation/accent match.
  if ((faq.question || '').trim().toLocaleLowerCase() === query.trim().toLocaleLowerCase())
    score += 8;
  if (variants.includes(q)) {score += 85;fields.push('variants');}
  const qMatches=concepts.filter(c=>includesConcept(question,c)).length;
  const vMatches=concepts.filter(c=>variants.some(line=>includesConcept(line,c))).length;
  const aMatches=concepts.filter(c=>includesConcept(answer,c)).length;
  if (qMatches) {score+=qMatches*14; if(!fields.includes('question'))fields.push('question');}
  if (vMatches) {score+=vMatches*11;if(!fields.includes('variants'))fields.push('variants');}
  if (aMatches) {score+=aMatches*3;fields.push('answer');}
  const covered=concepts.filter(c=>includesConcept(question,c)||variants.some(v=>includesConcept(v,c))||includesConcept(answer,c)).length;
  if(!covered)return null;
  if(covered===concepts.length)score+=25;
  score+=Math.round(covered/concepts.length*15);
  if(q.length>3&&question.includes(q) && question!==q)score+=12;
  return {id:faq.id,question:faq.question||'',answer:faq.answer||'',
    language:faq.language||'',score,matchedFields:fields};
}
function safeIlikeTerm(term: string): string {
  return term.replace(/[%_\\]/g,'\\$&').slice(0,48);
}
/**
 * Server builds every predicate: status, scope and query remain inseparable.
 * A strict cap prevents user-supplied queries turning into expensive OR scans.
 */
export function candidateFilter(query: string, requestedScopes: string[]): string {
  // GENERAL is always included; never permit an unfiltered search.
  const scopes = normalizeFaqScopes(['GENERAL', ...requestedScopes]);
  const concepts=conceptsFor(query);
  // Keep accent-bearing spellings and stems: PostgreSQL ILIKE is not inherently
  // accent-insensitive (ES inscripción / CA inscripció), even if local ranking is.
  // Spread the bounded term budget across concepts, not only early synonyms.
  // Keep original spellings: PostgreSQL ILIKE is not accent-insensitive.
  const originalWords = query.normalize('NFC').match(/[\p{L}\p{N}·]+/gu) ?? [];
  const knownVariants = Object.values(EQUIVALENCES).flat();
  const perConcept = concepts.map(list => [...new Set(list.flatMap(term => [
    term,
    ...originalWords.filter(word => normalizeText(word) === term),
    ...knownVariants.filter(word => normalizeText(word) === term),
    ...(term.length >= 7 ? [stem(term)] : []),
  ]))].filter(term => normalizeText(term).length >= 3));
  const terms: string[] = [];
  const rounds = Math.max(...perConcept.map(group => group.length));
  for (let round = 0; round < rounds && terms.length < 24; round++) {
    for (const group of perConcept) {
      const term = group[round];
      if (term && !terms.includes(term) && terms.length < 24) terms.push(term);
    }
  }
  if (!terms.length) throw new FaqSearchError('INVALID_QUERY', 'No searchable terms.');
  const clauses=terms.flatMap(t=>['question','variants','answer']
    .map(field=>field+'[ilike]:'+JSON.stringify('%'+safeIlikeTerm(t)+'%')));
  return 'and(status[eq]:"PUBLISHED",'+faqScopePredicate(scopes)+
    ',or('+clauses.join(',')+'))';
}
export function isAllowedFaq(faq: FaqRecord, scopes: string[]): boolean {
  return faq.status==='PUBLISHED' && Array.isArray(faq.scopeTags) &&
    faq.scopeTags.some(s=>scopes.includes(s));
}
export interface FaqSearchStore {
  searchCandidates(filter: string, limit: number, cursor: string | null): Promise<{records:FaqRecord[];nextCursor:string|null}>;
}
export async function searchFaqs(request: FaqSearchRequest, store: FaqSearchStore)
: Promise<SearchResponse> {
  const scopes=normalizeFaqScopes(['GENERAL', ...request.scopeTags]);
  const concepts=conceptsFor(request.query);
  const filter=candidateFilter(request.query,scopes);
  const seen=new Set<string>(), candidates: FaqRecord[]=[];
  let cursor:string|null=null;
  for(let page=0;page<=MAX_CANDIDATES/PAGE_SIZE;page++) {
    const probing=page===MAX_CANDIDATES/PAGE_SIZE;
    // Probe one extra record to distinguish exactly 200 from >200 hits.
    const result=await store.searchCandidates(filter,probing?1:PAGE_SIZE,cursor);
    if(probing){
      if(result.records.length || result.nextCursor)
        throw new FaqSearchError('SEARCH_TOO_BROAD',
          'Too many matching FAQs; try a more specific question.',422);
      cursor=null; break;
    }
    for(const faq of result.records){
      if(faq.id && !seen.has(faq.id) && isAllowedFaq(faq,scopes)){seen.add(faq.id);candidates.push(faq);}
    }
    if(!result.nextCursor){cursor=null;break;}
    if(result.nextCursor===cursor)throw new FaqSearchError('SEARCH_UNAVAILABLE','Invalid pagination cursor.',502);
    cursor=result.nextCursor;
  }
  const results=candidates.map(faq=>rankFaq(faq,request.query,concepts))
    .filter((row):row is FaqResult=>Boolean(row))
    .filter(row=>row.score>=12)
    // Language is a ranking hint only; never hide a stronger ES/CA cross-language answer.
    .map(row=>request.language!=='auto' && row.language===request.language
      ? {...row,score:row.score+2} : row)
    .sort((a,b)=>b.score-a.score||a.question.localeCompare(b.question)||a.id.localeCompare(b.id))
    .slice(0,request.limit);
  return {ok:true,query:request.query,results,count:results.length};
}
