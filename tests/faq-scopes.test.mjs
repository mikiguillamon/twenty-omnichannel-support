import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFaqScope, normalizeFaqScopes, publishedFaqScopeFilter} from '../src/lib/faq-scopes.ts';

test('FAQ scopes normalize and deduplicate human labels', () => {
  assert.deepEqual(normalizeFaqScopes(['General', 'Verano', 'verano', 'Campaña 2027']),
    ['GENERAL', 'VERANO', 'CAMPANA_2027']);
  assert.equal(normalizeFaqScope('Atención cliente'), 'ATENCION_CLIENTE');
});

test('bot scope filter includes published general plus requested scopes only', () => {
  assert.equal(publishedFaqScopeFilter(['Verano']),
    'and(status[eq]:"PUBLISHED",scopeTags[containsAny]:["GENERAL","VERANO"])');
  assert.throws(() => publishedFaqScopeFilter(['x") OR true']), /alcance/);
});

test('FAQ scope arrays cannot include empty values or huge collections', () => {
  assert.throws(() => normalizeFaqScopes(['']), /alcance/);
  assert.throws(() => normalizeFaqScopes(Array.from({length:31},(_,i)=>'TAG'+i)), /30/);
});
