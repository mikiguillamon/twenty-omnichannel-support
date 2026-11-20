import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('FAQ manager is a standalone page with native table fallback', () => {
  const layout = read('src/page-layouts/faq-manager.page.ts');
  const native = read('src/navigation-menu-items/menu-faqs.menu.ts');
  const visual = read('src/navigation-menu-items/menu-faqs-visual.menu.ts');
  assert(layout.includes("type: 'STANDALONE_PAGE'"));
  assert(layout.includes("type: 'FRONT_COMPONENT'"));
  assert(layout.includes('IDS.FRONT_FAQ_MANAGER'));
  assert(native.includes('NavigationMenuItemType.OBJECT'));
  assert(native.includes('IDS.FAQ_OBJECT'));
  assert(native.includes('IDS.MENU_FAQS'));
  assert(visual.includes('NavigationMenuItemType.PAGE_LAYOUT'));
  assert(visual.includes('IDS.LAYOUT_FAQ_MANAGER'));
  assert(visual.includes('IDS.MENU_FAQS_MANAGER'));
});

test('installed FAQs navigation retains its UUID and type across app upgrades', () => {
  const ids = read('src/constants/ids.ts');
  const native = read('src/navigation-menu-items/menu-faqs.menu.ts');
  const visual = read('src/navigation-menu-items/menu-faqs-visual.menu.ts');
  assert(ids.includes("MENU_FAQS: '0f7e43b6-8d2f-5bee-94b8-528ac0c88726'"));
  assert(ids.includes("MENU_FAQS_MANAGER: '84de8680-4e40-42b8-b3c7-7120b050cb54'"));
  assert(native.includes('universalIdentifier: IDS.MENU_FAQS,'));
  assert(native.includes('type: NavigationMenuItemType.OBJECT'));
  assert(visual.includes('universalIdentifier: IDS.MENU_FAQS_MANAGER,'));
  assert(visual.includes('type: NavigationMenuItemType.PAGE_LAYOUT'));
  assert(!visual.includes('universalIdentifier: IDS.MENU_FAQS,'));
  assert(!ids.includes('MENU_FAQS_TABLE:'));
});

test('FAQ manager runs as current user, not as application', () => {
  const ui = read('src/front-components/faq-manager.tsx');
  const rest = read('src/lib/faq-manager.ts');
  assert(ui.includes('new RestApiClient()'));
  assert(!ui.includes("runAs: 'application'"));
  assert(ui.includes('openCommandConfirmationModal'));
  assert(!ui.includes('window.localStorage'));
  assert(rest.includes('starting_after'));
  assert(rest.includes('endCursor'));
  assert(rest.includes('REST_TOO_MANY_RECORDS'));
});

test('FAQ editor preserves existing fields and uses safe archive state', () => {
  const ui = read('src/front-components/faq-manager.tsx');
  const rest = read('src/lib/faq-manager.ts');
  for (const field of ['question','answer','categoryId','status','language','variants','scopeTags',
    'tags','customTags','sourceUrl','updatedByReference']) assert(rest.includes(field));
  for (const status of ['DRAFT','PUBLISHED','ARCHIVED']) assert(ui.includes(status));
  assert(ui.includes("faq.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED'"));
  assert(ui.includes("isPublished ? 'DRAFT' : 'PUBLISHED'"));
  assert(!ui.includes('.delete('));
  assert(rest.includes("faq.categoryId ?? ''"));
});

test('FAQ actions use an accessible toggle, icons and native side panel', () => {
  const ui = read('src/front-components/faq-manager.tsx');
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
