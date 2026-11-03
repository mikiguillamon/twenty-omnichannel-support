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
