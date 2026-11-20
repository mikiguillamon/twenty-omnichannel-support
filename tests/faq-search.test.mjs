import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateFilter, conceptsFor, normalizeText, parseFaqSearchRequest,
  rankFaq, searchFaqs, FaqSearchError } from '../src/lib/faq-search.ts';

const faq=(id,question,answer,language='CA',scopeTags=['GENERAL'],status='PUBLISHED',variants='')=>
  ({id,question,answer,language,scopeTags,status,variants});

class MemoryFaqStore {
  constructor(rows=[]) {this.rows=rows;this.calls=0;this.filters=[];}
  async searchCandidates(filter,limit,cursor) {
    this.calls++;this.filters.push(filter);
    const start=cursor?this.rows.findIndex(r=>r.id===cursor)+1:0;
    const rows=this.rows.slice(start,start+limit);
    return {records:rows,nextCursor:rows.length===limit?rows.at(-1).id:null};
  }
}
const req=(query,overrides={})=>parseFaqSearchRequest({query,...overrides});

test('normalizes Unicode, verifies scope array and validates strict parameters',()=>{
  assert.equal(normalizeText('INSCRIPCIÓ · BAIXA!'),'inscripcio baixa');
  assert.deepEqual(req('  baixa  '),{query:'baixa',scopeTags:[],language:'auto',limit:5});
  assert.deepEqual(req('hola',{scopeTags:['Verano','verano']}),{
    query:'hola',scopeTags:['VERANO'],language:'auto',limit:5});
  for(const payload of [
    {query:'hola',scopeTags:'VERANO'}, {query:'hola',scopeTags:[123]},
    {query:'hola',scopeTags:['']}, {query:'hola',scopeTags:['x") OR true']},
    {query:'hola',scopeTags:Array.from({length:13},(_,i)=>'scope'+i)},
    {query:'hola',filter:'status[eq]:"DRAFT"'},
    {query:'hola',limit:11}, {query:'hola',limit:1.5},
    {query:'hola',language:'es'}, {query:'a'.repeat(321)},
  ])assert.throws(()=>parseFaqSearchRequest(payload),FaqSearchError);
});

test('candidate filter always includes publication and GENERAL; request adds scopes',()=>{
  const filter=candidateFilter('Com puc donar-me de baixa?', ['VERANO']);
  assert(filter.startsWith('and(status[eq]:"PUBLISHED",or('));
  assert(filter.includes('question[ilike]:'));
  assert(filter.includes('variants[ilike]:'));
  assert(filter.includes('answer[ilike]:'));
  assert(!filter.includes('INTERNAS'));
  assert(!candidateFilter('baixa',[]).includes('scopeTags['));
  const injected=candidateFilter('hello") OR id[neq]:"', []);
  assert(injected.startsWith('and(status[eq]:"PUBLISHED"'));
  assert(!injected.includes('id[neq]'));
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

test('filters drafts, archives and unrelated or unscoped FAQs',async()=>{
  const store=new MemoryFaqStore([
    faq('a','Baixa de l abonament','Pots donar-te de baixa','CA',['GENERAL']),
    faq('b','Baja de abono','Información de la baja','ES',['VERANO']),
    faq('c','Baja de abono','FAQ confidencial','ES',['INTERNAS']),
    faq('d','Baja de abono','Borrador','ES',['GENERAL'],'DRAFT'),
    faq('e','Baja de abono','Archivada','ES',['GENERAL'],'ARCHIVED'),
    faq('f','Baja de abono','Sin alcance','ES',[]),
  ]);
  const onlyGeneral=await searchFaqs(req('baja abono'),store);
  assert.deepEqual(onlyGeneral.results.map(x=>x.id),['a']);
  const summer=await searchFaqs(req('baja abono',{scopeTags:['VERANO']}),store);
  assert.deepEqual(summer.results.map(x=>x.id).sort(),['a','b']);
  assert.equal(store.calls,2);
  assert(store.filters[0].includes('status[eq]:"PUBLISHED"'));
  assert(!store.filters[1].includes('scopeTags['));
});

test('query ranking favors exact match, variants, multiple concepts and questions',async()=>{
  const rows=[
    faq('answer','Pregunta general','Inscripción cuota horarios baja abonament','ES'),
    faq('question','Cuota y horario de inscripción','Detalles de inscripción','ES'),
    faq('variant','Pregunta de ayuda','Detalles','ES',['GENERAL'],'PUBLISHED','Cuota y horario de inscripción'),
    faq('exact','Cuota y horario de inscripción?','Más detalles','ES'),
  ];
  const result=await searchFaqs(req('Cuota y horario de inscripción?',{limit:3}),new MemoryFaqStore(rows));
  assert.equal(result.results[0].id,'exact');
  assert(result.results.some(x=>x.id==='variant'));
  assert(!result.results.some(x=>x.id==='answer'));
  assert(result.results.every(x=>Number.isInteger(x.score)&&x.matchedFields.length>0));
});

test('a natural question can contain a term that is also an object property', async () => {
  const question = '¿Quién es el constructor del edificio?';
  const result = await searchFaqs(req(question), new MemoryFaqStore([
    faq('construction', question, 'La obra la ejecutó la constructora del barrio.', 'ES'),
  ]));
  assert.deepEqual(result.results.map(row => row.id), ['construction']);
});

test('valid search with no match returns an empty result',async()=>{
  assert.deepEqual(await searchFaqs(req('renovación'),
    new MemoryFaqStore([faq('a','Saludo','Hola','ES',['GENERAL'])])),
    {ok:true,query:'renovación',results:[],count:0});
});

test('bounded pagination avoids incomplete ranking and duplicate records',async()=>{
  const rows=Array.from({length:97},(_,i)=>faq(String(i+1).padStart(4,'0'),
    'Baja de abonament '+i,'Tramitar baixa','CA',['GENERAL']));
  const store=new MemoryFaqStore(rows);
  const out=await searchFaqs(req('baja abonament',{limit:5}),store);
  assert.equal(out.results.length,5);
  assert.equal(new Set(out.results.map(x=>x.id)).size,5);
  assert.equal(store.calls,2);
  const huge=new MemoryFaqStore(Array.from({length:201},(_,i)=>
    faq(String(i+1).padStart(4,'0'),'Abonament '+i,'Abonament','CA',['GENERAL'])));
  await assert.rejects(()=>searchFaqs(req('abonament'),huge),
    e=>e instanceof FaqSearchError && e.code==='SEARCH_TOO_BROAD');
  assert.equal(huge.calls,5);
});

test('language is a rank hint, never a hard exclusion',async()=>{
  const store=new MemoryFaqStore([
    faq('es','Información sobre el abono','Información general','ES',['GENERAL']),
    faq('ca','Informació sobre l abonament','Informació general','CA',['GENERAL']),
  ]);
  const result=await searchFaqs(req('abono',{language:'ES'}),store);
  assert(result.results.some(row=>row.id==='ca'));
  assert(result.results.some(row=>row.id==='es'));
});

test('measures bounded in-memory search time and repository calls',async t=>{
  const store=new MemoryFaqStore(Array.from({length:76},(_,i)=>
    faq('r'+i,'Horario del abono '+i,'Horari abonament','CA',['GENERAL'])));
  const start=performance.now();
  const result=await searchFaqs(req('horario abono'),store);
  const elapsedMs=performance.now()-start;
  t.diagnostic('in-memory search: '+elapsedMs.toFixed(2)+' ms; '+store.calls+' repository calls');
  assert(elapsedMs>=0 && elapsedMs<1000);
  assert.equal(store.calls,2);
  assert.equal(result.count,5);
});

test('text filters preserve accented terms without invalid ARRAY operators',()=>{
 const f=candidateFilter('Quota matrícula discapacitat natació',['Campus Hivern']);
 assert(!f.includes('containsAny') && !f.includes('containsIlike'));
 assert(!f.includes('scopeTags['));
 assert(f.includes('status[eq]:"PUBLISHED"'));
 assert(f.includes('%matrícula%'));
 assert(f.includes('%matricula%'));
 assert(f.includes('%natació%'));
});
test('exactly 200 candidates are allowed after last page probe',async()=>{
 const rows=Array.from({length:200},(_,i)=>faq(String(i+1).padStart(4,'0'),'Abonament '+i,'Abonament','CA',['GENERAL']));
 const db=new MemoryFaqStore(rows);
 const r=await searchFaqs(req('abonament'),db);
 assert.equal(r.count,5);assert.equal(db.calls,5);
});

test('legacy display labels normalize only in the post-fetch scope guard',async()=>{
 const store = new MemoryFaqStore([
  faq('a','Quota del campus','Informació pública','CA',['General']),
  faq('b','Quota del campus','Informació hivern','CA',['Campus Hivern']),
  faq('c','Quota del campus','FAQ restringida','CA',['INTERNAS']),
  faq('d','Quota del campus','Sense etiquetes','CA',[]),
  faq('e','Quota del campus','FAQ borrador','CA',['General'],'DRAFT'),
  faq('f','Quota del campus','FAQ invalid','CA',['?? invalid']),
 ]);
 const general=await searchFaqs(req('quota campus'),store);
 assert.deepEqual(general.results.map(r=>r.id),['a']);
 const winter=await searchFaqs(req('quota campus',{scopeTags:['Campus Hivern']}),store);
 assert.deepEqual(winter.results.map(r=>r.id).sort(),['a','b']);
 assert(store.filters.every(f=>!f.includes('scopeTags[')));
});
