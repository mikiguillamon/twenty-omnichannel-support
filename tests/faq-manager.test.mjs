import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterFaqs } from '../src/lib/faq-manager.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('FAQ filters combine scope, standard tag and a literal custom tag', () => {
  const base = { scopeTags: ['GENERAL'], tags: ['URGENTE'], question: 'Ayuda', answer: 'Respuesta' };
  const rows = [
    { ...base, id: 'matching', customTags: ['VERANO', 'Campus A'] },
    { ...base, id: 'prefix', customTags: ['Verano Plus'] },
    { ...base, id: 'different-tag', tags: ['REVISAR'], customTags: ['Verano'] },
  ];
  assert.deepEqual(filterFaqs(rows, {
    query: '', scope: 'GENERAL', status: 'all', language: 'all', tag: 'URGENTE', customTag: 'verano',
  }).map(faq => faq.id), ['matching']);
});

test('FAQ manager remains an installed standalone page without app-owned sidebar entries', () => {
  const layout = read('src/page-layouts/faq-manager.page.ts');
  const admin = read('src/front-components/admin-center.tsx');
  assert(layout.includes("type: 'STANDALONE_PAGE'"));
  assert(layout.includes("type: 'FRONT_COMPONENT'"));
  assert(layout.includes('IDS.FRONT_FAQ_MANAGER'));
  assert.match(admin, /<FaqManagerEntry\s*\/>/);
  assert.match(admin, /plural:\s*'supportFaqs'/);
});

test('retired FAQ navigation UUIDs are reserved and never reused for another type', () => {
  const ids = read('src/constants/ids.ts');
  assert(ids.includes("MENU_FAQS: '0f7e43b6-8d2f-5bee-94b8-528ac0c88726'"));
  assert(ids.includes("MENU_FAQS_MANAGER: '84de8680-4e40-42b8-b3c7-7120b050cb54'"));
  assert(!ids.includes('MENU_FAQS_TABLE:'));
});

test('FAQ manager runs as current user, not as application', () => {
  const ui = read('src/ui/faq-manager-page.tsx');
  const rest = read('src/lib/rest-collections.ts');
  assert(ui.includes('new RestApiClient()'));
  assert(ui.includes("from '../lib/rest-collections.ts'"));
  assert(!ui.includes("runAs: 'application'"));
  assert(ui.includes('openCommandConfirmationModal'));
  assert(!ui.includes('window.localStorage'));
  assert(rest.includes('starting_after'));
  assert(rest.includes('endCursor'));
  assert(rest.includes('REST_TOO_MANY_RECORDS'));
});

test('FAQ editor preserves existing fields and uses safe archive state', () => {
  const ui = read('src/ui/faq-manager-page.tsx');
  const rest = read('src/lib/faq-manager.ts');
  for (const field of ['question','answer','categoryId','status','language','variants','scopeTags',
    'tags','customTags','sourceUrl','updatedByReference']) assert(rest.includes(field));
  for (const status of ['DRAFT','PUBLISHED','ARCHIVED']) assert(ui.includes(status));
  assert(ui.includes("faq.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED'"));
  assert(ui.includes("isPublished ? 'DRAFT' : 'PUBLISHED'"));
  assert(!ui.includes('api.delete('));
  assert(!ui.includes('RestApiClient().delete('));
  assert(rest.includes("faq.categoryId ?? ''"));
});

test('FAQ actions use an accessible toggle, icons and native side panel', () => {
  const ui = read('src/ui/faq-manager-page.tsx');
  for (const key of [
    'role="switch"',
    'aria-checked={isPublished}',
    '<span>Activa</span>',
    '<ActionIcon icon="edit" />',
    'SidePanelPages.ViewFrontComponent',
    "objectNameSingular: 'supportFaq'",
    'selectedRecordIds: recordId ? [recordId] : []',
    '<FaqEditorSidePanel',
    'await closeSidePanel()',
    "await api.post('/rest/supportFaqs', payload)",
  ]) assert(ui.includes(key), key);
  assert(!ui.includes('<dialog'));
  assert(!ui.includes('createPortal('));
});

test('active switch optimistically patches one FAQ without reloading the list',()=>{
  const ui=read('src/ui/faq-manager-page.tsx');
  assert(ui.includes('statusRequests.current.add(faq.id)'));
  assert(ui.includes('setFaqs(current => current.map(row => row.id === faq.id'));
  assert(ui.includes('setFaqs(current => current.map(row => row.id === faq.id ? faq : row))'));
  assert(ui.includes('busyIds.has(faq.id)'));
  assert(ui.includes("role=\"switch\""));
  assert(!ui.includes('setRefresh(value => value + 1)'));
  assert(!ui.includes('window.location.reload'));
});
