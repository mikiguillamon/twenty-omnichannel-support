import test from 'node:test';
import assert from 'node:assert/strict';
import { sortMessagesChronologically } from '../src/lib/sort-support-messages.ts';

test('sorts provider messages by occurredAt, not arrival order', () => {
  const input = [
    { id: 'e', occurredAt: '2026-11-18T15:11:03+01:00' },
    { id: 'b', occurredAt: '2026-11-18T15:10:58+01:00' },
    { id: 'c', occurredAt: '2026-11-18T15:10:59+01:00' },
    { id: 'a', occurredAt: '2026-11-18T15:10:57+01:00' },
    { id: 'd', occurredAt: '2026-11-18T15:11:00+01:00' },
  ];
  assert.deepEqual(sortMessagesChronologically(input).map(message => message.id), ['a','b','c','d','e']);
  assert.deepEqual(input.map(message => message.id), ['e','b','c','a','d'], 'input is not mutated');
});

test('sorts across timezone offsets by absolute instant', () => {
  const messages = [
    { id: 'later', occurredAt: '2026-11-18T15:00:00+01:00' },
    { id: 'earlier', occurredAt: '2026-11-18T13:59:00Z' },
  ];
  assert.deepEqual(sortMessagesChronologically(messages).map(message => message.id), ['earlier','later']);
});

test('ties are deterministic and invalid dates appear last', () => {
  const messages = [
    { id: 'missing' }, { id: 'b', occurredAt: '2026-11-18T14:00:00Z' },
    { id: 'invalid', occurredAt: 'not-a-date' }, { id: 'a', occurredAt: '2026-11-18T14:00:00Z' },
  ];
  assert.deepEqual(sortMessagesChronologically(messages).map(message => message.id), ['a','b','invalid','missing']);
});

test('timeline applies API ordering and a local chronological fallback', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/front-components/case-timeline.tsx', import.meta.url), 'utf8');
  assert.match(source, /order_by: 'occurredAt\[AscNullsLast\]'/);
  assert.match(source, /setItems\(sortMessagesChronologically\(unwrap\(response\)\)\)/);
});
