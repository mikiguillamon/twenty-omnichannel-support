import { createHash, timingSafeEqual } from 'node:crypto';
import { normalizeFaqScopes } from './faq-scopes.ts';

export type FaqLanguage = 'ES' | 'CA' | 'EN' | 'auto';
export type FaqSearchRequest = { query: string; botCode: string; language: FaqLanguage; limit: number };
export type FaqRecord = { id: string; question?: string; answer?: string; variants?: string; language?: string;
  status?: string; scopeTags?: string[] | null };
export type FaqBotRecord = { id: string; code?: string; secretHash?: string; enabled?: boolean;
  allowedScopes?: string[] | null };
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
  if (Object.keys(r).some(k => !['query','botCode','language','limit'].includes(k)))
    throw new FaqSearchError('INVALID_REQUEST', 'Unsupported search parameter.');
  if (typeof r.query !== 'string' || !r.query.trim() || r.query.length > MAX_QUERY_LENGTH || /[\u0000-\u001f]/.test(r.query))
    throw new FaqSearchError('INVALID_QUERY', 'Query must contain 1 to 320 characters.');
  if (typeof r.botCode !== 'string' || !/^[A-Z][A-Z0-9_]{2,63}$/.test(r.botCode))
    throw new FaqSearchError('INVALID_BOT', 'Invalid botCode.');
  const language = r.language ?? 'auto';
  if (!['auto','ES','CA','EN'].includes(String(language)))
    throw new FaqSearchError('INVALID_LANGUAGE', 'Expected auto, ES, CA or EN.');
  const limit = r.limit ?? 5;
  if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 10)
    throw new FaqSearchError('INVALID_LIMIT', 'Limit must be between 1 and 10.');
  return {query:r.query.trim(),botCode:r.botCode,language:language as FaqLanguage,limit:Number(limit)};
}

/** The secret must be independently generated and kept in the bot's credential vault. */
export function authorizeFaqBot(bot: FaqBotRecord | null, suppliedSecret: string | undefined): string[] {
  if (!bot || bot.enabled !== true || !bot.secretHash || !Array.isArray(bot.allowedScopes))
    throw new FaqSearchError('BOT_NOT_AUTHORIZED','Bot credentials or scope configuration not available.',403);
  if (!suppliedSecret || !/^[A-Za-z0-9_-]{43,128}$/.test(suppliedSecret))
    throw new FaqSearchError('BOT_NOT_AUTHORIZED','Bot credentials or scope configuration not available.',403);
  if (!/^[a-f0-9]{64}$/i.test(bot.secretHash))
    throw new FaqSearchError('BOT_NOT_AUTHORIZED','Bot credentials or scope configuration not available.',403);
  const actual = createHash('sha256').update(suppliedSecret,'utf8').digest();
  const expected = Buffer.from(bot.secretHash,'hex');
  if (!timingSafeEqual(actual,expected))
    throw new FaqSearchError('BOT_NOT_AUTHORIZED','Bot credentials or scope configuration not available.',403);
  let scopes: string[];
  try { scopes = normalizeFaqScopes(bot.allowedScopes); } catch {
    throw new FaqSearchError('BOT_NOT_AUTHORIZED','Bot credentials or scope configuration not available.',403);
  }
  if (scopes.some(scope=>scope !== 'GENERAL' && !/^[A-Z0-9_]{1,64}$/.test(scope)))
    throw new FaqSearchError('BOT_NOT_AUTHORIZED','Bot credentials or scope configuration not available.',403);
  return [...new Set(['GENERAL',...scopes])];
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
export function candidateFilter(query: string, authorizedScopes: string[]): string {
  const scopes = normalizeFaqScopes(authorizedScopes);
  if(!scopes.includes('GENERAL'))
    throw new FaqSearchError('BOT_NOT_AUTHORIZED','Missing general scope.',403);
  const concepts=conceptsFor(query);
  // Keep accent-bearing spellings and stems: PostgreSQL ILIKE is not inherently
  // accent-insensitive (ES inscripción / CA inscripció), even if local ranking is.
  const terms=[...new Set(concepts.flatMap(list=>list.flatMap(term=>{
    const roots=term.length>=7?[stem(term)]:[];
    const spellings=Object.values(EQUIVALENCES).flat().filter(value=>normalizeText(value)===term);
    return [term,...roots,...spellings];
  })))].filter(term=>term.length>=3).slice(0,20);
  const clauses=terms.flatMap(t=>['question','variants','answer']
    .map(field=>field+'[ilike]:'+JSON.stringify('%'+safeIlikeTerm(t)+'%')));
  return 'and(status[eq]:"PUBLISHED",scopeTags[containsAny]:'+JSON.stringify(scopes)+
    ',or('+clauses.join(',')+'))';
}
export function isAllowedFaq(faq: FaqRecord, scopes: string[]): boolean {
  return faq.status==='PUBLISHED' && Array.isArray(faq.scopeTags) &&
    faq.scopeTags.some(s=>scopes.includes(s));
}
export interface FaqSearchStore {
  lookupBot(code: string): Promise<FaqBotRecord | null>;
  searchCandidates(filter: string, limit: number, cursor: string | null): Promise<{records:FaqRecord[];nextCursor:string|null}>;
}
export async function searchFaqs(request: FaqSearchRequest, secret: string | undefined, store: FaqSearchStore)
: Promise<SearchResponse> {
  const bot = await store.lookupBot(request.botCode);
  const scopes=authorizeFaqBot(bot,secret);
  const concepts=conceptsFor(request.query);
  const filter=candidateFilter(request.query,scopes);
  const seen=new Set<string>(), candidates: FaqRecord[]=[];
  let cursor:string|null=null;
  for(let page=0;page<MAX_CANDIDATES/PAGE_SIZE;page++) {
    const result=await store.searchCandidates(filter,PAGE_SIZE,cursor);
    for(const faq of result.records){
      if(faq.id && !seen.has(faq.id) && isAllowedFaq(faq,scopes)){seen.add(faq.id);candidates.push(faq);}
    }
    if(!result.nextCursor){cursor=null;break;}
    if(result.nextCursor===cursor)throw new FaqSearchError('SEARCH_UNAVAILABLE','Invalid pagination cursor.',502);
    cursor=result.nextCursor;
  }
  // Never pretend a partial candidate set represents a complete ranked search.
  if(cursor)throw new FaqSearchError('SEARCH_TOO_BROAD',
    'Too many matching FAQs; try a more specific question.',422);
  const results=candidates.map(faq=>rankFaq(faq,request.query,concepts))
    .filter((row):row is FaqResult=>Boolean(row))
    .filter(row=>row.score>=12)
    .sort((a,b)=>b.score-a.score||a.question.localeCompare(b.question)||a.id.localeCompare(b.id))
    .slice(0,request.limit);
  return {ok:true,query:request.query,results,count:results.length};
}
