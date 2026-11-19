import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('app is publicly distributable under MIT',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.notEqual(pkg.private,true);
  assert.equal(pkg.license,'MIT');
  assert.equal(pkg.name,'twenty-omnichannel-support');
  assert(pkg.keywords.includes('twenty-app'));
  assert(pkg.engines.twenty.includes('2.50.0'));
});
test('multichannel types and per-channel policies are preserved',()=>{
  const channel=read('src/objects/support-channel.object.ts');
  const cases=read('src/objects/support-case.object.ts');
  for(const type of ['EMAIL','WHATSAPP','INSTAGRAM','TELEGRAM']){
    assert(channel.includes(`value:'${type}'`));
    assert(cases.includes(`value: "${type}"`));
  }
  for(const field of ['groupingMode','continuationHours','reopenHours','semanticClassification','minClassificationConfidence','ambiguousAction','autoCloseEnabled','autoCloseDays'])assert(channel.includes(field));
  assert(read('src/objects/support-external-identity.object.ts').includes('externalKey'));
  assert(read('src/indexes/external-identity-unique.index.ts').includes('isUnique: true'));
  assert(read('src/front-components/channel-policies.tsx').includes('updateChannelPolicy'));
});
test('WhatsApp PN and LID can map to the same identity through aliases',()=>{
  const aliases=read('src/objects/support-identity-alias.object.ts');
  for(const value of ['WHATSAPP_PN','WHATSAPP_LID','externalKey','aliasValue'])assert(aliases.includes(value));
  assert(read('src/indexes/identity-alias-external-unique.index.ts').includes('isUnique: true'));
  assert(read('src/fields/identity-alias-identity.field.ts').includes("joinColumnName: 'externalIdentityId'"));
  const message=read('src/objects/support-message.object.ts');
  for(const field of ['providerChatId','providerChatIdAlt','providerMessageId'])assert(message.includes(field));
});
test('required case data dimensions remain independent',()=>{
  const src=read('src/objects/support-case.object.ts');
  for(const name of ['technicalStatus','resolution','automation','status'])assert(src.includes(`name: "${name}"`) || src.includes(`name: '${name}'`));
});
test('messages preserve generated draft separately from sent body',()=>{
  const src=read('src/objects/support-message.object.ts');
  for(const name of ['draftBody','body','deliveryStatus','replyDecision'])assert(src.includes(name));
});
test('human evaluation captures corrections and source reference',()=>{
  const src=read('src/objects/support-evaluation.object.ts');
  for(const name of ['proposedCorrection','targetScope','verdict','linkedTaskId'])assert(src.includes(name));
});

test('new omnichannel fields, person relations and labels are stable',()=>{
  const source=read('src/objects/support-case.object.ts');
  for(const field of ['followUp','followUpAt','comments','language','transcription','recording'])assert(source.includes("name: '"+field+"'"));
  assert(source.includes("labelPlural: 'Conversaciones'"));
  assert(read('src/page-layouts/person-omnichannel.page.ts').includes('personRecordPage'));
  assert(read('src/front-components/support-overview.tsx').includes('/rest/supportCases'));
});


test('conversation types mirror categories and FAQ scope tags are independent', () => {
  const type = read('src/objects/support-type.object.ts');
  const faq = read('src/objects/support-faq.object.ts');
  const caseType = read('src/fields/case-type.field.ts');
  const typeCases = read('src/fields/type-cases.field.ts');
  const ingestion = read('src/lib/ingestion/contract.ts');
  assert(type.includes("nameSingular: 'supportType'"));
  assert(caseType.includes("joinColumnName: 'caseTypeId'"));
  assert(typeCases.includes('IDS.CASE_TYPE_RELATION'));
  assert(faq.includes("name: 'scopeTags'"));
  assert(ingestion.includes("'typeCode'"));
  assert(ingestion.includes("'subject'"));
  assert(ingestion.includes("'tags'"));
  assert(read('src/front-components/faq-scope-editor.tsx').includes('Guardar alcance'));
  assert(read('src/page-layouts/support-faq-record.page.ts').includes('IDS.FRONT_FAQ_SCOPE_EDITOR'));
});

test('FAQ detail view retains existing editorial and publication fields', () => {
  const source = read('src/page-layouts/support-faq-record.page.ts');
  for (const field of ['FAQ_VARIANTS', 'FAQ_TAGS', 'FAQ_CUSTOM_TAGS', 'FAQ_SOURCEURL',
    'FAQ_UPDATEDBYREFERENCE', 'FAQ_REVISION', 'FAQ_PUBLISHED_AT', 'FAQ_SYNCED_AT']) {
    assert(source.includes('IDS.' + field), 'Missing ' + field);
  }
});

test('FAQ search route and configurable bot authorization stay workspace scoped',()=>{
  const f=read('src/logic-functions/omnichannel-faq-search.logic-function.ts');
  assert(f.includes("path:'/omnichannel/v1/faqs/search'"));
  assert(f.includes("isAuthRequired:true"));
  assert(!f.includes('x-omnichannel-bot-secret'));
  assert(read('src/lib/faq-search.ts').includes('scopeTags'));
  assert(read('src/lib/faq-search.ts').includes('status[eq]:"PUBLISHED"'));
});
