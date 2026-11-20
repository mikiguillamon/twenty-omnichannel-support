import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDS } from '../src/constants/ids.ts';
import * as navigation from '../src/lib/omnichannel-navigation.ts';
import { publishConversationViewLink } from '../src/lib/conversation-inbox-navigation.ts';

const id = (number) => `f0000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const [owner, inbox, dashboard, cases, view, folder] = [1, 2, 3, 4, 5, 6].map(id);
const row = (number, input) => ({
  applicationId: owner, id: id(number), position: number,
  userWorkspaceId: null, folderId: null, icon: null,
  ...input,
});
const viewLink = `/objects/supportCases?viewId=${view}`;

function makeClient(entries) {
  const mutations = [];
  const client = {
    async query() {
      return {
        currentWorkspace: { workspaceCustomApplicationId: owner, workspaceUrls: {
          customUrl: 'https://support.example', subdomainUrl: 'https://support.twenty.example',
        } },
        navigationMenuItems: structuredClone(entries),
        getPageLayouts: [
          { id: inbox, universalIdentifier: IDS.LAYOUT_CONVERSATION_INBOX, name: 'Conversaciones Omnichannel' },
          { id: dashboard, universalIdentifier: IDS.LAYOUT_SUPPORT_HOME, name: 'Dashboards Omnichannel' },
          { id: id(7), universalIdentifier: id(8), name: 'Un panel ajeno' },
        ],
        objects: { edges: [{ node: {
          id: cases, universalIdentifier: IDS.CASE_OBJECT, namePlural: 'supportCases', labelPlural: 'Conversaciones',
        } }] },
        getViews: [{ id: view, objectMetadataId: cases, name: 'Pendiente Humano' }],
      };
    },
    async mutation(selection) {
      mutations.push(selection);
      if (selection.updateNavigationMenuItem) {
        const { id: entryId, update } = selection.updateNavigationMenuItem.__args.input;
        const entry = entries.find(item => item.id === entryId);
        Object.assign(entry, update);
        return { updateNavigationMenuItem: structuredClone(entry) };
      }
      const input = selection.createNavigationMenuItem.__args.input;
      const entry = row(90, input);
      entries.push(entry);
      return { createNavigationMenuItem: structuredClone(entry) };
    },
  };
  return { client, mutations };
}

test('discovers workspace entries for Omnichannel pages, saved views and native views', async () => {
  const { client } = makeClient([
    row(11, { type: 'PAGE_LAYOUT', pageLayoutId: inbox, name: 'Bandeja' }),
    row(12, { type: 'LINK', folderId: folder, name: 'Pedidos', link: `/page/${inbox}?omniView=${id(31)}` }),
    row(13, { type: 'VIEW', viewId: view, name: 'Nombre que Twenty no muestra' }),
    row(14, { type: 'OBJECT', targetObjectMetadataId: cases }),
    row(15, { type: 'LINK', link: `/page/${dashboard}?omniDashboard=my-dashboard&omniShortcut=managed-v1` }),
    row(16, { type: 'LINK', userWorkspaceId: id(9), link: `/page/${inbox}` }),
    row(17, { type: 'PAGE_LAYOUT', applicationId: id(9), pageLayoutId: inbox }),
    row(18, { type: 'PAGE_LAYOUT', pageLayoutId: id(7) }),
    row(19, { type: 'LINK', link: `https://outside.example/page/${inbox}` }),
    row(20, { type: 'VIEW', viewId: id(9) }),
    row(21, { type: 'LINK', link: `https://support.example/page/${inbox}/` }),
  ]);
  const entries = await navigation.listOmnichannelMenuEntries(client);
  assert.deepEqual(entries.map(({ id, type }) => [id, type]), [
    [id(11), 'PAGE_LAYOUT'], [id(12), 'LINK'], [id(13), 'VIEW'], [id(14), 'OBJECT'], [id(15), 'LINK'], [id(21), 'LINK'],
  ]);
  assert.equal(entries[2].name, 'Pendiente Humano');
  assert.equal(entries[2].target, viewLink);
  assert.equal(entries[1].canUnpublish, false);
  assert.equal(entries[4].canUnpublish, true);
});

test('renames a native page and a manual link with only the name mutation', async () => {
  const link = `https://support.twenty.example/page/${inbox}/?omniView=${id(31)}`;
  const entries = [
    row(11, { type: 'PAGE_LAYOUT', pageLayoutId: inbox, name: 'Bandeja' }),
    row(12, { type: 'LINK', folderId: folder, name: 'Pedidos', link }),
  ];
  const { client, mutations } = makeClient(entries);
  await navigation.renameOmnichannelMenuEntry(id(11), '  Conversaciones del equipo  ', client);
  await navigation.renameOmnichannelMenuEntry(id(12), 'Pedidos nuevos', client);
  assert.deepEqual(mutations.map((query) => query.updateNavigationMenuItem.__args.input), [
    { id: id(11), update: { name: 'Conversaciones del equipo' } },
    { id: id(12), update: { name: 'Pedidos nuevos' } },
  ]);
  assert.equal(entries[0].pageLayoutId, inbox);
  assert.equal(entries[1].link, link);
  assert.equal(entries[1].folderId, folder);
});

test('refuses renames for outside targets, personal links, and native views', async () => {
  const { client, mutations } = makeClient([
    row(11, { type: 'PAGE_LAYOUT', pageLayoutId: id(7) }),
    row(12, { type: 'LINK', userWorkspaceId: id(9), link: `/page/${inbox}` }),
    row(13, { type: 'VIEW', viewId: view }),
  ]);
  for (const number of [11, 12, 13]) {
    await assert.rejects(navigation.renameOmnichannelMenuEntry(id(number), 'Nuevo nombre', client), /MENU_ENTRY_NOT_RENAMABLE/);
  }
  assert.equal(mutations.length, 0);
});

test('creates an independently named link to the native view in the same folder', async () => {
  const original = row(11, { type: 'VIEW', viewId: view, folderId: folder, icon: 'IconInbox' });
  const entries = [original];
  const { client, mutations } = makeClient(entries);
  await navigation.createOmnichannelMenuAlias(id(11), '  Trabajo pendiente  ', client);
  assert.deepEqual(mutations[0].createNavigationMenuItem.__args.input, {
    type: 'LINK', name: 'Trabajo pendiente', link: viewLink, icon: 'IconInbox',
    position: 12, folderId: folder, userWorkspaceId: null,
  });
  assert.equal(original.type, 'VIEW');
  assert.equal(original.viewId, view);
  await assert.rejects(navigation.createOmnichannelMenuAlias(id(11), 'Trabajo pendiente', client), /MENU_ALIAS_ALREADY_EXISTS/);
  assert.equal(mutations.length, 1);
  await navigation.renameOmnichannelMenuEntry(entries[1].id, 'Pendientes urgentes', client);
  assert.equal(entries[1].link, viewLink);
});

test('publishes a saved inbox view with a menu name independent of the view name', async () => {
  const { client, mutations } = makeClient([]);
  const savedView = { id: view, name: 'Pendiente Humano', filters: { status: 'PENDING' } };
  await publishConversationViewLink(`/page/${inbox}`, savedView, client, ' Trabajo pendiente ');
  assert.equal(mutations[0].createNavigationMenuItem.__args.input.name, 'Trabajo pendiente');
  assert.equal(mutations[0].createNavigationMenuItem.__args.input.link, `/page/${inbox}?omniView=${view}`);
  assert.equal(savedView.name, 'Pendiente Humano');
});

test('does not create a duplicate alias for a relative or same-workspace link in the same folder', async () => {
  const { client, mutations } = makeClient([
    row(11, { type: 'VIEW', viewId: view, folderId: folder }),
    row(12, { type: 'LINK', folderId: folder, link: `https://support.example/objects/supportCases/?viewId=${view}` }),
  ]);
  await assert.rejects(navigation.createOmnichannelMenuAlias(id(11), 'Otro nombre', client), /MENU_ALIAS_ALREADY_EXISTS/);
  assert.equal(mutations.length, 0);
});
