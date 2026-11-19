import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorizeFaqBot, candidateFilter, conceptsFor, normalizeText, parseFaqSearchRequest,
  rankFaq, searchFaqs, FaqSearchError } from '../src/lib/faq-search.ts';

const secret='a'.repeat(43);
const bot={id:'bot1',code:'EGORA_EMAIL',enabled:true,allowedScopes:['VERANO'],
  secretHash:createHash('sha256').update(secret).digest('hex')};
const faq=(id,question,answer,language='CA',scopeTags=['GENERAL'],status='PUBLISHED',variants='')=>
  ({id,question,answer,language,scopeTags,status,variants});

class MemoryFaqStore {
  constructor(rows=[],configuredBot=bot) {
    this.rows=rows; this.bot=configuredBot;this.calls=0;this.filters=[];
  }
  async lookupBot(code) {this.calls++;return this.bot?.code===code?this.bot:null;}
  async searchCandidates(filter,limit,cursor) {
    this.calls++;this.filters.push(filter);
    const start=cursor?this.rows.findIndex(r=>r.id===cursor)+1:0;
    const rows=this.rows.slice(start,start+limit);
    return {records:rows,nextCursor:rows.length===limit?rows.at(-1).id:null};
  }
}
const req=(query,overrides={})=>parseFaqSearchRequest({query,botCode:'EGORA_EMAIL',...overrides});

test('normalization removes accents, case, punctuation; validates strict parameters',()=>{
  assert.equal(normalizeText('INSCRIPCIÓ · BAIXA!'),'inscripcio baixa');
  assert.deepEqual(parseFaqSearchRequest({query:'  baixa  ',botCode:'EGORA_EMAIL'}),
    {query:'baixa',botCode:'EGORA_EMAIL',language:'auto',limit:5});
  for(const payload of [
    {query:'hola',botCode:'EGORA_EMAIL',scopeTags:['SECRET']},
    {query:'hola',botCode:'EGORA_EMAIL',limit:11},
    {query:'hola',botCode:'EGORA_EMAIL',limit:1.5},
    {query:'hola',botCode:'EGORA_EMAIL',language:'es'},
    {query:'a'.repeat(321),botCode:'EGORA_EMAIL'},
    {query:'ok',botCode:'../../PRIVATE'},
  ])assert.throws(()=>parseFaqSearchRequest(payload),FaqSearchError);
});

test('a bot code alone cannot authorize access, wrong secrets fail closed',()=>{
  assert.throws(()=>authorizeFaqBot(bot,undefined),/credentials/);
  assert.throws(()=>authorizeFaqBot(bot,'b'.repeat(43)),/credentials/);
  assert.throws(()=>authorizeFaqBot({...bot,secretHash:'bad'},secret),/credentials/);
  assert.throws(()=>authorizeFaqBot({...bot,allowedScopes:null},secret),/credentials/);
  assert.throws(()=>authorizeFaqBot({...bot,enabled:false},secret),/credentials/);
  assert.deepEqual(authorizeFaqBot(bot,secret),['GENERAL','VERANO']);
  assert.deepEqual(authorizeFaqBot({...bot,allowedScopes:[]},secret),['GENERAL']);
});

test('candidate filter is always composed from published, authorized scopes and server terms',()=>{
  const filter=candidateFilter('Com puc donar-me de baixa?', ['GENERAL','VERANO']);
  assert(filter.startsWith('and(status[eq]:"PUBLISHED",scopeTags[containsAny]:["GENERAL","VERANO"],or('));
  assert(filter.includes('question[ilike]:'));
  assert(filter.includes('variants[ilike]:'));
  assert(filter.includes('answer[ilike]:'));
  assert(!filter.includes('INTERNAS'));
  const injected=candidateFilter('hello") OR id[neq]:"', ['GENERAL']);
  assert(injected.startsWith('and(status[eq]:"PUBLISHED"'));
  assert(!injected.includes('id[neq]'));
  assert.throws(()=>candidateFilter('hola',['SECRET']),/general/);
});

test('bilingual Spanish-Catalan equivalents and FAQ variants rank correctly',()=>{
  assert(conceptsFor('¿Cómo puedo darme de baja del abono?').some(list=>list.includes('baixa')));
  const exact=rankFaq(faq('exact','¿Cómo puedo darme de baja?','Información para darte de baja','ES'),
    '¿Cómo puedo darme de baja?',conceptsFor('¿Cómo puedo darme de baja?'));
  const alternative=rankFaq(faq('variant','Com puc donar-me de baixa?','Consulta de abonament','CA',
    ['GENERAL'],'PUBLISHED','¿Cómo puedo darme de baja?'),
    '¿Cómo puedo darme de baja?',conceptsFor('¿Cómo puedo darme de baja?'));
  assert(exact && alternative);
  assert(exact.score>100);
  assert(alternative.matchedFields.includes('variants'));
  const ca=rankFaq(faq('ca','Com puc donar-me de baixa de l’abonament?','La baixa es tramita al web'),
    '¿Cómo puedo darme de baja del abono?',conceptsFor('¿Cómo puedo darme de baja del abono?'));
  assert(ca && ca.score>0);
});

test('retrieval rejects unauthorized scopes, drafts, archives, and unscoped FAQs',async()=>{
  const store=new MemoryFaqStore([
    faq('a','Baixa de l abonament','Pots donar-te de baixa','CA',['GENERAL']),
    faq('b','Baja de abono','Información de la baja','ES',['VERANO']),
    faq('c','Baja de abono','FAQ confidencial','ES',['INTERNAS']),
    faq('d','Baja de abono','Borrador','ES',['GENERAL'],'DRAFT'),
    faq('e','Baja de abono','Archivada','ES',['GENERAL'],'ARCHIVED'),
    faq('f','Baja de abono','Sin alcance','ES',[]),
  ]);
  const result=await searchFaqs(req('baja abono'),secret,store);
  assert.deepEqual(result.results.map(x=>x.id).sort(),['a','b']);
  assert.equal(result.count,2);
  assert.equal(store.calls,2);
  assert.equal(store.filters.length,1);
  assert(store.filters[0].includes('scopeTags[containsAny]:["GENERAL","VERANO"]'));
});

test('query ranking favors exact, variants, multiple concepts and question over answer',async()=>{
  const rows=[
    faq('answer','Pregunta general','Inscripción cuota horarios baja abonament','ES'),
    faq('question','Cuota y horario de inscripción','Detalles de inscripción','ES'),
    faq('variant','Pregunta de ayuda','Detalles','ES',['GENERAL'],'PUBLISHED','Cuota y horario de inscripción'),
    faq('exact','Cuota y horario de inscripción?','Más detalles','ES'),
  ];
  const result=await searchFaqs(req('Cuota y horario de inscripción?',{limit:3}),secret,new MemoryFaqStore(rows));
  assert.equal(result.results[0].id,'exact');
  assert(result.results.some(x=>x.id==='variant'));
  assert(!result.results.some(x=>x.id==='answer'));
  assert.equal(result.count,3);
  assert(result.results.every(x=>Number.isInteger(x.score)&&x.matchedFields.length>0));
});

test('empty results return ok true, not an error',async()=>{
  const result=await searchFaqs(req('renovación'),secret,
    new MemoryFaqStore([faq('a','Saludo','Hola','ES',['GENERAL'])]));
  assert.deepEqual(result,{ok:true,query:'renovación',results:[],count:0});
});

test('pagination, deduplication, caps and query counts are bounded',async()=>{
  const rows=Array.from({length:97},(_,i)=>faq(String(i+1).padStart(4,'0'),
    'Baja de abonament '+i,'Tramitar baixa','CA',['GENERAL']));
  const store=new MemoryFaqStore(rows);
  const out=await searchFaqs(req('baja abonament',{limit:5}),secret,store);
  assert.equal(out.results.length,5);
  assert.equal(new Set(out.results.map(x=>x.id)).size,5);
  assert.equal(store.calls,3); // one lookup + two pages of candidates
  const huge=new MemoryFaqStore(Array.from({length:201},(_,i)=>
    faq(String(i+1).padStart(4,'0'),'Abonament '+i,'Abonament','CA',['GENERAL'])));
  await assert.rejects(()=>searchFaqs(req('abonament'),secret,huge),
    e=>e instanceof FaqSearchError && e.code==='SEARCH_TOO_BROAD');
  assert.equal(huge.calls,5); // bounded: bot + four 50-record pages
});

test('workspace isolation is enforced by per-workspace store and second credential',async()=>{
  const a=new MemoryFaqStore([faq('a','Baixa del abono','A','CA',['GENERAL'])]);
  const b=new MemoryFaqStore([faq('b','Baixa del abono','B','CA',['GENERAL'])],
    {...bot,secretHash:createHash('sha256').update('b'.repeat(43)).digest('hex')});
  const first=await searchFaqs(req('baixa abono'),secret,a);
  assert.equal(first.results[0].id,'a');
  await assert.rejects(()=>searchFaqs(req('baixa abono'),secret,b),
    e=>e instanceof FaqSearchError && e.code==='BOT_NOT_AUTHORIZED');
  assert.equal(b.calls,1); // authorization precedes FAQ search
});

test('store failures propagate without disclosing private FAQ details',async()=>{
  const store=new MemoryFaqStore();
  store.searchCandidates=async()=>{throw Error('private token or FAQ details');};
  await assert.rejects(()=>searchFaqs(req('abono'),secret,store),/private token/);
  // HTTP handler returns a sanitized generic 502; it does not send the underlying message.
});
