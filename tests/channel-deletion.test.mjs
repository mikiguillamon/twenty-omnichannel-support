import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('channel dependencies preserve historical cases and identities',()=>{
  for (const field of ['case-channel-instance','external-identity-channel']) {
    assert.match(read('src/fields/'+field+'.field.ts'),/OnDeleteAction\.SET_NULL/);
  }
});

test('deletion rechecks the identity and disabled state',()=>{
  const source=read('src/lib/support-channels.ts');
  assert.match(source,/destroyDisabledChannel/);
  assert.match(source,/channel\.id !== id/);
  assert.match(source,/channel\.status !== 'DISABLED'/);
  assert.match(source,/client\.delete\(path, \{ query: \{ soft_delete: 'false' \} \}\)/);
  assert.doesNotMatch(source,/delete\('\/rest\/support(?:Cases|Messages|ExternalIdentities)/);
});

test('confirmation requires stopped external workflows and exact code',()=>{
  const source=read('src/front-components/channel-setup.tsx');
  assert.match(source,/!externalStopped/);
  assert.match(source,/removalCode!==\(row\.code\|\|row\.id\)/);
  assert.match(source,/destroyDisabledChannel\(row\.id,row\.code\?\?null\)/);
});

test('app role grants Destroy only for channel records',()=>{
  const source=read('src/roles/default-role.ts');
  assert.match(source,/IDS\.CHANNEL_OBJECT, canReadObjectRecords: true, canUpdateObjectRecords: true, canSoftDeleteObjectRecords: false, canDestroyObjectRecords: true/);
  assert.match(source,/IDS\.CASE_OBJECT, canReadObjectRecords: true, canUpdateObjectRecords: true, canSoftDeleteObjectRecords: false, canDestroyObjectRecords: false/);
});
