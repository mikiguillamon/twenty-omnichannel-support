import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConversationFilter, conversationRecordHref, loadConversationPage, normalizeConversationFilters,
  parseConversationView, saveConversationView,
} from '../src/lib/conversation-inbox.ts';
import {
  conversationViewLink, readConversationViewId, publishConversationViewLink,
} from '../src/lib/conversation-inbox-navigation.ts';

const viewId = '811d0d5e-d23c-4f25-95cf-fc545087b8d9';
const pageId = 'ed1f2cc5-aeda-46ae-825d-de0bfc614020';
const accountId = '189c6526-82f7-4f44-b825-a2e8022f20fe';

test('combina filtros de conversación y búsqueda de forma literal en el servidor', () => {
  const filter = buildConversationFilter({ channel: 'EMAIL', channelInstanceId: accountId, status: 'IN_PROGRESS', search: '  A_B%  ' });
  assert.match(filter, /^and\(channel\[eq\]:"EMAIL",status\[eq\]:"IN_PROGRESS",channelInstanceId\[eq\]:/);
  assert.ok(filter.includes('subject[ilike]:"%A\\_B\\%%"'));
  assert.ok(filter.includes('originEmail[ilike]'));
  assert.equal(buildConversationFilter({ sort: 'oldest' }), undefined);
});

test('las comillas en asuntos y nombres se mantienen dentro de valores de búsqueda REST', () => {
  const quoted = buildConversationFilter({ search: 'Cambio de "envío, mañana"' });
  assert.ok(quoted.includes(`subject[ilike]:'%Cambio de "envío, mañana"%'`));
  const mixed = buildConversationFilter({ search: `Pedido de "O'Connor"` });
  assert.match(mixed, /^and\(or\(subject\[ilike\]:"%Pedido de%"/);
  assert.ok(mixed.includes('subject[ilike]:"%Connor%"'));
});

test('normaliza únicamente opciones admitidas y descarta identificadores de filtros inválidos', () => {
  assert.deepEqual(normalizeConversationFilters({
    channel: 'EMAIL', status: '__proto__', caseTypeId: accountId, categoryId: 'invalid', sort: 'unknown', search: '  factura  ',
  }), { channel: 'EMAIL', caseTypeId: accountId, sort: 'recent', search: 'factura' });
});

test('pagina resultados con cursor de Twenty, selección de campos y orden estable', async () => {
  const input = { status: 'NEW', sort: 'oldest' };
  const client = { get: async (path, options) => {
    assert.equal(path, '/rest/supportCases');
    assert.equal(options.query.limit, 20);
    assert.equal(options.query.starting_after, 'cursor-1');
    assert.equal(options.query.order_by, 'lastMessageAt[AscNullsLast],id[AscNullsLast]');
    assert.equal(options.query.filter, 'status[eq]:"NEW"');
    assert.ok(options.query.fields.includes('caseType'));
    return { totalCount: 23, data: { supportCases: [{ id: viewId }] }, pageInfo: { hasNextPage: true, endCursor: 'cursor-2' } };
  } };
  assert.deepEqual(await loadConversationPage(client, input, 'cursor-1'), { rows: [{ id: viewId }], totalCount: 23, nextCursor: 'cursor-2' });
});

test('rechaza una página incompleta que anuncia más registros sin cursor', async () => {
  const client = { get: async () => ({ data: { supportCases: [] }, pageInfo: { hasNextPage: true } }) };
  await assert.rejects(loadConversationPage(client, {}), /CURSOR/);
});

test('filtra etiquetas de array en páginas de origen distintas, con coincidencia de elemento', async () => {
  const filters = { channel: 'EMAIL', tag: 'VIP', customTag: ' verano ' };
  const pages = {
    start: [{ id: 'wrong-prefix', tags: ['VIP'], customTags: ['Verano Plus'] }],
    next: [{ id: 'match', tags: ['VIP', 'URGENT'], customTags: ['VERANO', 'Campus'] }],
  };
  const calls = [];
  const api = { async get(path, { query }) {
    assert.equal(path, '/rest/supportCases');
    assert.equal(query.filter, 'channel[eq]:"EMAIL"');
    assert.match(query.fields, /tags,customTags/);
    const cursor = query.starting_after ?? 'start';
    calls.push(cursor);
    return { data: { supportCases: pages[cursor] }, pageInfo: { hasNextPage: cursor === 'start', endCursor: 'next' } };
  } };
  const page = await loadConversationPage(api, filters);
  assert.deepEqual(page.rows.map(row => row.id), ['match']);
  assert.equal(page.nextCursor, null);
  assert.deepEqual(calls, ['start', 'next']);
  assert.deepEqual(normalizeConversationFilters(filters), { channel: 'EMAIL', sort: 'recent', tag: 'VIP', customTag: 'verano' });
});

test('continúa una página filtrada antes del primer registro de la página siguiente', async () => {
  const sourcePages = [Array.from({ length: 20 }, (_, index) => ({ id: String(index), customTags: ['Verano'] })),
    [{ id: 'next', customTags: ['Verano'] }]];
  const api = { async get(_, { query }) {
    const second = query.starting_after === 'source-page-2';
    return { data: { supportCases: sourcePages[second ? 1 : 0] }, pageInfo: { hasNextPage: !second, endCursor: 'source-page-2' } };
  } };
  const filters = { customTag: 'Verano' };
  const first = await loadConversationPage(api, filters);
  assert.equal(first.rows.length, 20);
  assert.ok(first.nextCursor);
  const second = await loadConversationPage(api, filters, first.nextCursor);
  assert.deepEqual(second.rows.map(row => row.id), ['next']);
  assert.equal(second.nextCursor, null);
});

test('enlaza la ficha nativa de una conversación por UUID sin depender del panel', () => {
  assert.equal(conversationRecordHref(viewId), '/object/supportCase/' + viewId);
  assert.equal(conversationRecordHref('../settings'), null);
});

test('un filtro poco frecuente ofrece continuar aunque las primeras páginas no coincidan', async () => {
  const api = { async get(_, { query }) {
    const index = Number(query.starting_after ?? 0);
    return { data: { supportCases: [{ id: String(index), customTags: index === 12 ? ['Encontrada'] : [] }] },
      pageInfo: { hasNextPage: index < 12, endCursor: String(index + 1) } };
  } };
  const filter = { customTag: 'Encontrada' };
  const first = await loadConversationPage(api, filter);
  assert.deepEqual(first.rows, []);
  assert.equal(first.totalCount, null);
  assert.ok(first.nextCursor);
  const next = await loadConversationPage(api, filter, first.nextCursor);
  assert.deepEqual(next.rows.map(row => row.id), ['12']);
  assert.equal(next.nextCursor, null);
});

test('la ficha nativa abre el hilo y sus vistas incluyen las etiquetas propias', async () => {
  const { readFileSync } = await import('node:fs');
  const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  assert.match(source('src/page-layouts/support-case-record.page.ts'), /LAYOUT_SUPPORT_CASE_TAB_THREAD[^\n]*position:0/);
  assert.match(source('src/page-layouts/support-case-record.page.ts'), /fieldMetadataId:IDS.CASE_CUSTOM_TAGS/);
  for (const name of ['case-all', 'case-email', 'case-whatsapp', 'case-human', 'cases-technical-errors']) {
    assert.match(source('src/views/' + name + '.view.ts'), /fieldMetadataUniversalIdentifier: IDS\.CASE_CUSTOM_TAGS/);
  }
});

test('las vistas versionadas eliminan configuraciones inválidas y mantienen su identificador al editar', async () => {
  const valid = { id: viewId, viewName: '  Correo  ', configJson: '{"version":1,"filters":{"channel":"EMAIL"}}' };
  assert.deepEqual(parseConversationView(valid), { id: viewId, name: 'Correo', filters: { channel: 'EMAIL', sort: 'recent' } });
  assert.equal(parseConversationView({ ...valid, configJson: '{"version":2}' }), null);
  assert.equal(parseConversationView({ ...valid, id: 'broken' }), null);
  const client = { patch: async (path, payload) => {
    assert.equal(path, '/rest/supportConversationViews/' + viewId);
    assert.equal(payload.viewName, 'Pendientes');
    assert.deepEqual(JSON.parse(payload.configJson), { version: 1, filters: { status: 'HUMAN_REQUIRED', sort: 'recent' } });
  } };
  assert.equal((await saveConversationView(client, ' Pendientes ', { status: 'HUMAN_REQUIRED' }, viewId)).id, viewId);
});

test('las rutas de vistas usan únicamente UUID de una página operativa del workspace', () => {
  const path = '/page/' + pageId;
  assert.equal(conversationViewLink(path, viewId), `${path}?omniView=${viewId}`);
  assert.equal(conversationViewLink('/settings/applications/' + pageId, viewId), null);
  assert.equal(conversationViewLink('https://example.com/page/' + pageId, viewId), null);
  assert.equal(readConversationViewId('?omniView=' + viewId), viewId);
  assert.equal(readConversationViewId(`?omniView=${viewId}&omniView=${accountId}`), null);
});

test('publica un acceso compartido de una vista y reutiliza el mismo enlace tras un reintento', async () => {
  const path = '/page/' + pageId;
  const link = `${path}?omniView=${viewId}`;
  const view = { id: viewId, name: 'Correo', filters: {} };
  const items = [];
  const client = {
    query: async () => ({ navigationMenuItems: items, currentWorkspace: { workspaceCustomApplicationId: accountId } }),
    mutation: async ({ createNavigationMenuItem }) => {
      assert.deepEqual(createNavigationMenuItem.__args.input, {
        name: 'Correo', link, icon: 'IconInbox', type: 'LINK', position: 0, userWorkspaceId: null,
      });
      const item = { id: viewId, link, folderId: null, userWorkspaceId: null, applicationId: accountId, type: 'LINK' };
      items.push(item);
      return { createNavigationMenuItem: item };
    },
  };
  assert.equal(await publishConversationViewLink(path, view, client), 'created');
  assert.equal(await publishConversationViewLink(path, view, client), 'existing');
});
