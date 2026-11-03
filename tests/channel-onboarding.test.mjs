import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('channels start disabled',()=>{
  assert.match(read('src/objects/support-channel.object.ts'),/name: 'status'[^\n]+defaultValue:"'DISABLED'"/);
});
test('channel page is installed in navigation',()=>{
  assert(read('src/page-layouts/channel-setup.page.ts').includes('FRONT_CHANNEL_SETUP'));
  assert(read('src/navigation-menu-items/menu-channels.menu.ts').includes('LAYOUT_CHANNEL_SETUP'));
});
test('email and whatsapp views remain while fixed sidebar links are removed',()=>{
  for(const path of ['menu-email.menu.ts','menu-whatsapp.menu.ts','menu-human.menu.ts','menu-case-errors.menu.ts','menu-evaluations-bad.menu.ts','menu-messages.menu.ts'])
    assert(!existsSync(new URL('../src/navigation-menu-items/'+path,import.meta.url)));
  for(const path of ['case-email.view.ts','case-whatsapp.view.ts'])
    assert(existsSync(new URL('../src/views/'+path,import.meta.url)));
});
test('channel updates use Twenty REST rather than direct provider calls',()=>{
  const source=read('src/lib/support-channels.ts');
  assert(source.includes("new RestApiClient().patch("));
  assert(!source.includes('https://n8n'));
});
