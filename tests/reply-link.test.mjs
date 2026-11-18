import test from 'node:test';
import assert from 'node:assert/strict';
import { replyLinkFor, replyUnavailableReason } from '../src/lib/reply-link.ts';

const base = { id: 'case-1', subject: 'Consulta de ayuda' };

test('WhatsApp opens the conversation phone, never an account or LID', () => {
  assert.equal(replyLinkFor({ ...base, channel:'WHATSAPP', originPhone:'+34 600 111 222' })?.href,
    'https://wa.me/34600111222');
  assert.equal(replyLinkFor({ ...base, channel:'WHATSAPP', originPhone:'600111222' }), null);
  assert.equal(replyLinkFor({ ...base, channel:'WHATSAPP' }, { externalUserId:'123456789012345@lid' }), null);
  assert.equal(replyLinkFor({ ...base, channel:'WHATSAPP' }, null, [
    { aliasType:'WHATSAPP_PN', aliasValue:'34600111222@s.whatsapp.net' },
    { aliasType:'WHATSAPP_LID', aliasValue:'123456789012345@lid' },
  ])?.href, 'https://wa.me/34600111222');
  assert.equal(replyLinkFor({ ...base, channel:'WHATSAPP' }, null, [
    { aliasType:'WHATSAPP_PN', aliasValue:'34600111222@s.whatsapp.net' },
    { aliasType:'WHATSAPP_PN', aliasValue:'34600999888@s.whatsapp.net' },
  ]), null);
});

test('email uses the customer email, encodes subject and never allows CRLF injection', () => {
  assert.deepEqual(replyLinkFor({ ...base, channel:'EMAIL', originEmail:'cliente@example.com', subject:'Re: Pedido\r\nBcc:other@example.com' }), {
    channel:'EMAIL', href:'mailto:cliente@example.com?subject=Re%3A%20Pedido%20Bcc%3Aother%40example.com',
    destination:'cliente@example.com', newTab:false,
  });
  assert.equal(replyLinkFor({ ...base, channel:'EMAIL', originEmail:'not an address' }), null);
  assert.equal(replyLinkFor({ ...base, channel:'EMAIL' }, { externalUserId:'cliente@example.com' })?.href,
    'mailto:cliente@example.com?subject=Re%3A%20Consulta%20de%20ayuda');
});

test('Telegram and Instagram require public usernames rather than opaque provider IDs', () => {
  assert.equal(replyLinkFor({ ...base, channel:'TELEGRAM' }, { externalUserId:'@cliente_demo' })?.href,
    'https://t.me/cliente_demo');
  assert.equal(replyLinkFor({ ...base, channel:'TELEGRAM' }, { externalUserId:'123456789012' }), null);
  assert.equal(replyLinkFor({ ...base, channel:'INSTAGRAM' }, { externalUserId:'cliente.demo' })?.href,
    'https://ig.me/m/cliente.demo');
  assert.equal(replyLinkFor({ ...base, channel:'INSTAGRAM' }, { externalUserId:'123456789012345' }), null);
});

test('phone can open an international dialer and unsupported channels stay disabled', () => {
  assert.equal(replyLinkFor({ ...base, channel:'PHONE', originPhone:'+34 600111222' })?.href,'tel:+34600111222');
  assert.equal(replyLinkFor({ ...base, channel:'OTHER' }), null);
  assert.match(replyUnavailableReason('WHATSAPP'), /número internacional/);
});

test('conversation component contains a visible reply action and avoids outbound API writes', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/front-components/case-timeline.tsx',import.meta.url),'utf8');
  assert.match(source, /replyLinkFor\(replyCase, replyIdentity, replyAliases\)/);
  assert.match(source, /Responder ·/);
  assert.match(source, /href=\{reply.href\}/);
  assert.doesNotMatch(source, /api\.post\(|api\.patch\(/);
});
