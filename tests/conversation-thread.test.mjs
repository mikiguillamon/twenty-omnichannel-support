import assert from 'node:assert/strict';
import test from 'node:test';
import { decideConversationProposal, loadConversationMessages, mergeConversationMessages } from '../src/lib/conversation-thread.ts';

test('loads the newest messages first and can page backwards using the Twenty cursor', async () => {
  const calls = [];
  const api = {
    async get(path, { query }) {
      calls.push({ path, query });
      return {
        data: { supportMessages: [{ id: 'newest' }] },
        pageInfo: { hasNextPage: true, endCursor: 'next-page' },
      };
    },
  };
  const page = await loadConversationMessages(api, 'case-a');
  assert.deepEqual(page, { records: [{ id: 'newest' }], nextCursor: 'next-page' });
  await loadConversationMessages(api, 'case-a', page.nextCursor);
  assert.equal(calls[0].path, '/rest/supportMessages');
  assert.equal(calls[0].query.filter, 'supportCaseId[eq]:"case-a"');
  assert.match(calls[0].query.order_by, /^occurredAt\[DescNullsLast\]/);
  assert.equal(calls[1].query.starting_after, 'next-page');
});

test('merges overlapping message pages chronologically and keeps the current message state', () => {
  const first = { id: 'first', occurredAt: '2026-11-19T12:00:00Z' };
  const last = { id: 'last', occurredAt: '2026-11-19T13:00:00Z', proposalStatus: 'CONFIRMED' };
  assert.deepEqual(mergeConversationMessages([last], [first, { ...last, proposalStatus: 'PENDING' }]), [first, last]);
});

test('reads previously saved HTML bodies and drafts as text with line breaks', async () => {
  const api = { async get() {
    return { data: { supportMessages: [{ id: 'old', body: '<p>Hola<br>Adiós</p>', draftBody: '<div>Un &amp; dos</div>' }] } };
  } };
  const page = await loadConversationMessages(api, 'case-a');
  assert.deepEqual(page.records, [{ id: 'old', body: 'Hola\nAdiós', draftBody: 'Un & dos' }]);
});

test('posts approval with edited text and discards without a message or a callback URL', async () => {
  const calls = [];
  const api = {
    async post(path, body) {
      calls.push({ path, body });
      return { ok: true, messageId: body.messageId, proposalStatus: body.confirmed ? 'CONFIRMED' : 'DISCARDED' };
    },
  };
  assert.equal(await decideConversationProposal(api, 'proposal-a', true, 'Texto revisado'), 'CONFIRMED');
  assert.equal(await decideConversationProposal(api, 'proposal-b', false, 'Texto que se descarta'), 'DISCARDED');
  assert.deepEqual(calls, [
    { path: '/s/omnichannel/v1/proposals/decide', body: { messageId: 'proposal-a', confirmed: true, message: 'Texto revisado' } },
    { path: '/s/omnichannel/v1/proposals/decide', body: { messageId: 'proposal-b', confirmed: false } },
  ]);
});

test('an ambiguous approval response never updates the local sent or approved state', async () => {
  const api = { post: async () => ({ ok: true, messageId: 'other', proposalStatus: 'CONFIRMED' }) };
  await assert.rejects(decideConversationProposal(api, 'proposal', true, 'Respuesta'), /PROPOSAL_RESPONSE_INVALID/);
});
