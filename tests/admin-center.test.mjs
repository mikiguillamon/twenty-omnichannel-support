import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path,import.meta.url),'utf8');

test('administration center is registered in native Twenty app settings',()=>{
  const manifest=read('src/settings-menu-items/omnichannel-admin.settings.ts');
  const ids=read('src/constants/ids.ts');
  assert(manifest.includes('defineSettingsMenuItem'));
  assert(manifest.includes('IDS.FRONT_ADMIN_CENTER'));
  assert(manifest.includes("scope: 'WORKSPACE'"));
  assert(ids.includes('FRONT_ADMIN_CENTER:'));
  assert(ids.includes('SETTINGS_MENU_ADMIN:'));
});

test('all administrative surfaces remain reachable without overwriting workspace shortcuts',()=>{
  const hub=read('src/front-components/admin-center.tsx');
  for(const component of ['Dashboards','FaqManagerEntry','ChannelSetup','ChannelPolicies']) {
    assert(hub.includes('<'+component) && hub.includes("import { "+component+" }"),component);
  }
  for(const object of ['supportCases','supportMessages','supportFaqs','supportChannels','supportCategories',
    'supportTypes','supportEvaluations','supportExternalIdentities','supportIdentityAliases','supportSettings']){
    assert(hub.includes("'"+object+"'"),object);
  }
  assert(hub.includes('AppPath.RecordIndexPage'));
  assert(!hub.includes('runAs:'));
  assert(!hub.includes('localStorage'));
  assert(!hub.includes('window.location.reload'));
});

test('dashboard edit mode exposes only configure and remove buttons on each widget',()=>{
  const ui=read('src/ui/dashboard-page.tsx');
  assert(ui.includes('onPointerMove={e=>moveResize(e.clientX,e.clientY)}'));
  assert(ui.includes('startResize(w.id,w.width,w.height,e.clientX,e.clientY)'));
  assert(ui.includes("title=\"Configurar\""));
  assert(ui.includes("title=\"Eliminar\""));
  assert(!ui.includes('title="Mover antes"'));
  assert(!ui.includes('title="Mover después"'));
  assert(!ui.includes('title="Reducir anchura"'));
  assert(!ui.includes('title="Ampliar anchura"'));
});
