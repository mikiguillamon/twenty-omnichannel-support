import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync as fsExistsSync, readdirSync as fsReaddirSync } from 'node:fs';
import { canManageApplications, findStandalonePageLayoutId } from '../src/lib/admin-navigation.ts';
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

test('administration opens the full-width standalone page and retains a dedicated Settings component', () => {
  const layout = read('src/page-layouts/omnichannel-admin.page.ts');
  assert.match(layout, /type:\s*'STANDALONE_PAGE'/);
  assert.match(layout, /heightBehavior:\s*'TAB_VIEWPORT'/);
  assert.match(layout, /frontComponentUniversalIdentifier:\s*IDS\.FRONT_ADMIN_FULL/);
  const hub = read('src/front-components/admin-center.tsx');
  assert.match(hub, /findStandalonePageLayoutId\(universalIdentifier\)/);
  assert.match(hub, /navigate\(AppPath\.PageLayoutPage, \{ pageLayoutId \}/);
  assert.match(hub, /IDS\.LAYOUT_CONVERSATION_INBOX/);
});

test('the full-width page resolves the installed ID independently of its manifest UUID and name', async () => {
  const client = { query: async (selection) => {
    assert.deepEqual(selection.getPageLayouts.__args, { pageLayoutType: 'STANDALONE_PAGE' });
    return { getPageLayouts: [
      { id: 'other-layout', universalIdentifier: 'other-uuid' },
      { id: 'configured-layout', universalIdentifier: 'manifest-uuid' },
    ] };
  }};
  assert.equal(await findStandalonePageLayoutId('manifest-uuid', client), 'configured-layout');
  assert.equal(await findStandalonePageLayoutId('missing-uuid', client), null);
});

test('standalone administration requires the native applications permission before rendering its tools', async () => {
  const mock = (permissionFlags) => ({ query: async (selection) => {
    assert.deepEqual(selection, { currentUser: { currentUserWorkspace: { permissionFlags: true } } });
    return { currentUser: { currentUserWorkspace: { permissionFlags } } };
  }});
  assert.equal(await canManageApplications(mock(['APPLICATIONS'])), true);
  assert.equal(await canManageApplications(mock(['LAYOUTS'])), false);
  assert.equal(await canManageApplications(mock(null)), false);
  await assert.rejects(canManageApplications({ query: async () => { throw new Error('offline'); } }), /offline/);
  const wrapper = read('src/front-components/admin-full.tsx');
  assert.match(wrapper, /canManageApplications\(\)/);
  assert.doesNotMatch(wrapper, /runAs:/);
});

test('shared dashboard shortcuts declare the layout permission required by Twenty', () => {
  const role = read('src/roles/default-role.ts');
  const navigation = read('src/lib/dashboard-navigation.ts');
  assert.match(role, /permissionFlagUniversalIdentifiers:\s*\[[^\]]*SystemPermissionFlag\.LAYOUTS/);
  assert.doesNotMatch(navigation, /runAs:/);
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

test('embedded dashboards fit the administration frame and reflow when their container narrows', () => {
  const hub = read('src/front-components/admin-center.tsx');
  const dashboards = read('src/ui/dashboard-page.tsx');
  assert.match(hub, /<Dashboards embedded /);
  assert.match(dashboards, /padding: embedded \? 0 :/);
  assert.match(dashboards, /container-type: inline-size/);
  assert.match(dashboards, /--omni-dashboard-columns: 2/);
  assert.match(dashboards, /--omni-dashboard-columns: 1/);
});

test('stable manifest retires the app-owned technical sidebar after preflight',()=>{
  const path=new URL('../src/navigation-menu-items/',import.meta.url);
  if(fsExistsSync(path))assert.deepEqual(fsReaddirSync(path).filter(file=>file.endsWith('.ts')),[]);
  const center=read('src/settings-menu-items/omnichannel-admin.settings.ts');
  assert(center.includes('IDS.FRONT_ADMIN_CENTER'));
  assert(read('src/front-components/admin-center.tsx').includes('<NavigationPreflight/>'));
});
