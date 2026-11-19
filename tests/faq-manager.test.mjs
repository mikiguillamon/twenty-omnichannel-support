import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('FAQ manager is a standalone page with native table fallback', () => {
  const layout = read('src/page-layouts/faq-manager.page.ts');
  const nav = read('src/navigation-menu-items/menu-faqs.menu.ts');
  const fallback = read('src/navigation-menu-items/menu-faqs-table.menu.ts');
  assert(layout.includes("type: 'STANDALONE_PAGE'"));
  assert(layout.includes("type: 'FRONT_COMPONENT'"));
  assert(layout.includes('IDS.FRONT_FAQ_MANAGER'));
  assert(nav.includes('NavigationMenuItemType.PAGE_LAYOUT'));
  assert(fallback.includes('NavigationMenuItemType.OBJECT'));
  assert(fallback.includes('IDS.FAQ_OBJECT'));
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
  assert(ui.includes("updateStatus(faq, 'ARCHIVED')"));
  assert(ui.includes("updateStatus(faq, 'DRAFT')"));
  assert(!ui.includes('.delete('));
  assert(rest.includes("faq.categoryId ?? ''"));
});
