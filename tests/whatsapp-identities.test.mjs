import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsappJid, whatsappAliases, resolveAliasLookup } from '../src/lib/whatsapp-identities.ts';

test('normalizes device JID and preserves LID distinction',()=>{
  assert.deepEqual(normalizeWhatsappJid('34600111222:12@s.whatsapp.net'),{value:'34600111222@s.whatsapp.net',kind:'WHATSAPP_PN'});
  assert.deepEqual(normalizeWhatsappJid('123456789012345@lid'),{value:'123456789012345@lid',kind:'WHATSAPP_LID'});
  assert.equal(normalizeWhatsappJid('a-group@g.us'),null);
  assert.equal(normalizeWhatsappJid(null),null);
});
test('captures both addresses irrespective of their order',()=>{
  const original=whatsappAliases('Evolution','instance-1','123456789012345@lid','34600111222@s.whatsapp.net');
  const reversed=whatsappAliases('Evolution','instance-1','34600111222@s.whatsapp.net','123456789012345@lid');
  assert.deepEqual(new Set(original.map(x=>x.externalKey)),new Set(reversed.map(x=>x.externalKey)));
  assert.equal(original.length,2);
  assert.equal(original[0].aliasType,'WHATSAPP_LID');
});
test('one alias existing is reused and its paired alias can be added',()=>{
  const aliases=whatsappAliases('evolution','instance-1','34600111222@s.whatsapp.net','123456789012345@lid');
  const decision=resolveAliasLookup(aliases.map(x=>x.externalKey),[
    {externalKey:aliases[0].externalKey,externalIdentityId:'person-ext-1'},
  ]);
  assert.deepEqual(decision,{action:'REUSE',externalIdentityId:'person-ext-1'});
});
test('conflicting aliases must not automatically merge identities',()=>{
  const aliases=whatsappAliases('evolution','instance-1','34600111222@s.whatsapp.net','123456789012345@lid');
  assert.deepEqual(resolveAliasLookup(aliases.map(x=>x.externalKey),[
    {externalKey:aliases[0].externalKey,externalIdentityId:'one'},
    {externalKey:aliases[1].externalKey,externalIdentityId:'two'},
  ]),{action:'REVIEW_CONFLICT',externalIdentityId:null});
});
test('separate provider accounts keep separate alias keys',()=>{
  const a=whatsappAliases('evolution','instance-1','123456789012345@lid',null);
  const b=whatsappAliases('evolution','instance-2','123456789012345@lid',null);
  assert.notEqual(a[0].externalKey,b[0].externalKey);
});
test('new and repeated aliases resolve predictably',()=>{
  const aliases=whatsappAliases('evolution','instance-1','123456789012345@lid','123456789012345@lid');
  assert.equal(aliases.length,1);
  assert.equal(resolveAliasLookup(aliases.map(x=>x.externalKey),[]).action,'CREATE');
});
