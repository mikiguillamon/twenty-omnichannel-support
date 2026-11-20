import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {normalizeFaqScope, normalizeFaqScopes, publishedFaqScopeFilter} from '../src/lib/faq-scopes.ts';

test('FAQ scopes normalize and deduplicate human labels', () => {
  assert.deepEqual(normalizeFaqScopes(['General', 'Verano', 'verano', 'Campaña 2027']),
    ['GENERAL', 'VERANO', 'CAMPANA_2027']);
  assert.equal(normalizeFaqScope('Atención cliente'), 'ATENCION_CLIENTE');
});

test('bot scope filter requires published and validates requested scope codes', () => {
  assert.equal(publishedFaqScopeFilter(['Verano']),
    'status[eq]:"PUBLISHED"');
  assert.throws(() => publishedFaqScopeFilter(['x") OR true']), /alcance/);
});

test('FAQ scope arrays cannot include empty values or huge collections', () => {
  assert.throws(() => normalizeFaqScopes(['']), /alcance/);
  assert.throws(() => normalizeFaqScopes(Array.from({length:31},(_,i)=>'TAG'+i)), /30/);
});

test('REST filter never uses unsupported ARRAY operators', () => {
  assert.equal(publishedFaqScopeFilter(['Campus Hivern']), 'status[eq]:"PUBLISHED"');
});

test('the scope editor enables editing only when the selected FAQ scopes were loaded', () => {
  const source = readFileSync(new URL('../src/front-components/faq-scope-editor.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(!faqId \|\| scopes === null \|\| saving\) return;/);
  assert.match(source, /disabled=\{!canEdit\} onClick=\{\(\)=>void save\(\)\}/);
});
