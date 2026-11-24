const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
	buildMessageRequest,
	messageProperties,
} = require('../dist/nodes/OmnichannelSupport/messageV2.js');

function request(operation, channelType, fields = {}) {
	const parameters = {
		body: '  line one\nline two  ',
		channelCode: 'support',
		contactIdentifier: 'contact',
		messageKey: 'provider-message-1',
		...fields,
	};
	const context = {
		getNodeParameter(name, itemIndex, fallback) {
			assert.equal(itemIndex, 2, 'resolve expressions for the current input item');
			return Object.hasOwn(parameters, name) ? parameters[name] : fallback;
		},
	};
	return buildMessageRequest(context, operation, 2, channelType);
}

test('WhatsApp phone and Meta wa_id produce the same verified-format PN alias as a Baileys PN JID', () => {
	for (const identifier of ['+34600111222', '34600111222', '34600111222@s.whatsapp.net']) {
		const { path, body } = request('receive', 'WHATSAPP', { contactIdentifier: identifier });
		assert.equal(path, '/ingest');
		assert.equal(body.routingMode, 'CHAT');
		assert.deepEqual(body.conversation, { status: 'IN_PROGRESS' });
		assert.equal(body.contact.remoteJid, '34600111222@s.whatsapp.net');
		assert.equal(body.contact.verified, undefined);
		assert.equal(body.message.externalId, 'provider-message-1');
		assert.equal(body.message.body, '  line one\nline two  ');
		assert.equal(body.eventType, 'message.received');
	}
	for (const invalid of ['+abc', '123', '123@g.us', 'name@lid']) {
		assert.throws(() => request('receive', 'WHATSAPP', { contactIdentifier: invalid }), /WhatsApp/);
	}
});

test('keeps the original Baileys JIDs for the message and identity resolution without inventing a phone from a LID', () => {
	const { body } = request('send', 'WHATSAPP', {
		contactIdentifier: '12345:2@lid',
		contactFields: { remoteJidAlt: '34600111222@s.whatsapp.net' },
		messageFields: { providerAddressingMode: 'lid' },
	});
	assert.equal(body.contact.remoteJid, '12345:2@lid');
	assert.equal(body.contact.phone, undefined);
	assert.equal(body.message.providerChatId, '12345:2@lid');
	assert.equal(body.message.providerChatIdAlt, '34600111222@s.whatsapp.net');
	assert.equal(body.message.providerAddressingMode, 'lid');
	assert.equal(body.eventType, 'message.sent');
	assert.equal(body.conversation, undefined);
});

test('Telegram and Instagram use the provider contact ID and pass explicit references through to the server', () => {
	for (const type of ['TELEGRAM', 'INSTAGRAM']) {
		const routingFields = {
			caseId: 'case',
			issueKey: 'issue',
			threadId: 'thread',
			replyToExternalId: 'reply',
		};
		const { body } = request('receive', type, { routingFields, contactIdentifier: '9001' });
		assert.equal(body.contact.externalId, '9001');
		assert.equal(body.routingMode, 'CHAT');
		for (const [key, value] of Object.entries(routingFields))
			assert.equal(body.message[key], value);
	}
	const { body } = request('receive', 'TELEGRAM', { routingFields: { routingMode: 'CHANNEL' } });
	assert.equal(body.routingMode, undefined);
	assert.equal(body.conversation, undefined);
});

test('email and telephone contacts follow channel policy and scope, with no social case defaults', () => {
	const email = request('receive', 'EMAIL', {
		contactIdentifier: 'user@example.com',
		contactFields: { firstName: 'Sara', verified: false },
		scopeFields: { provider: 'gmail', accountId: 'account' },
		routingFields: { threadId: 'thread' },
		messageFields: { idSource: 'idempotencyKey', html: '<p>Hello</p>' },
	}).body;
	assert.deepEqual(email.contact, {
		email: 'user@example.com',
		firstName: 'Sara',
		verified: false,
	});
	assert.deepEqual(email.message, {
		idempotencyKey: 'provider-message-1',
		body: '  line one\nline two  ',
		threadId: 'thread',
		html: '<p>Hello</p>',
	});
	assert.equal(email.provider, 'gmail');
	assert.equal(email.accountId, 'account');
	assert.equal(email.routingMode, undefined);
	assert.equal(email.conversation, undefined);
	const phone = request('receive', 'PHONE', { contactIdentifier: '+34600111222' }).body;
	assert.deepEqual(phone.contact, { phone: '+34600111222', externalId: '+34600111222' });
});

test('sparse conversation updates preserve explicit clears, status overrides and custom tag lists', () => {
	const { body } = request('receive', 'TELEGRAM', {
		conversationFields: {
			status: 'WAITING_INTERNAL',
			tags: ['VIP'],
			customTags: ['  Spring Promo ', 'a,b'],
			additionalCustomTags: 'Spring Promo\nNew\n',
			comments: '  note  ',
			categoryCode: 'FESTIVAL',
			typeId: 'type',
			clearFields: ['assignedTo', 'followUpAt'],
		},
	});
	assert.deepEqual(body.conversation, {
		status: 'WAITING_INTERNAL',
		tags: ['VIP'],
		customTags: ['Spring Promo', 'a,b', 'New'],
		comments: '  note  ',
		categoryCode: 'FESTIVAL',
		typeId: 'type',
		assignedTo: null,
		followUpAt: null,
	});
	assert.deepEqual(
		request('send', 'INSTAGRAM', { conversationFields: { clearFields: ['customTags'] } }).body
			.conversation,
		{ customTags: [] },
	);
	assert.throws(
		() => request('send', 'INSTAGRAM', { conversationFields: { typeId: 'id', typeCode: 'CODE' } }),
		/type/i,
	);
});

test('proposal-bearing requests flag the protected route and carry the exact draft and Wait URL', () => {
	const replyText = ' A draft\n ';
	const callbackUrl = 'https://n8n.example/webhook-waiting/42';
	const { body, protected: guarded } = request('receive', 'TELEGRAM', {
		includeProposal: true,
		replyText,
		callbackUrl,
	});
	assert.equal(guarded, true);
	assert.deepEqual(body.proposedReply, { body: replyText, callbackUrl });
	assert.deepEqual(
		request('propose', undefined, { messageId: 'twenty-message', replyText, callbackUrl }),
		{
			path: '/proposals/create',
			protected: true,
			body: { messageId: 'twenty-message', body: replyText, callbackUrl },
		},
	);
	assert.equal(request('receive', 'TELEGRAM').protected, undefined);
	assert.equal(
		request('send', 'TELEGRAM', { includeProposal: true, replyText, callbackUrl }).body
			.proposedReply,
		undefined,
	);
});

test('append and delivery emit only fields accepted by their endpoints', () => {
	const input = {
		caseId: 'case',
		direction: 'INBOUND',
		messageFields: {
			idSource: 'idempotencyKey',
			replyToExternalId: 'provider-id',
			senderType: 'BOT',
		},
		scopeFields: { accountId: 'inbox' },
		conversationFields: { status: 'CLOSED' },
	};
	assert.deepEqual(request('append', undefined, input), {
		path: '/messages/append',
		protected: true,
		body: {
			caseId: 'case',
			accountId: 'inbox',
			message: {
				body: '  line one\nline two  ',
				idempotencyKey: 'provider-message-1',
				replyToExternalId: 'provider-id',
				senderType: 'BOT',
				direction: 'INBOUND',
			},
		},
	});
	for (const deliveryStatus of ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED']) {
		assert.deepEqual(request('updateDelivery', undefined, { ...input, deliveryStatus }), {
			path: '/ingest',
			body: {
				eventType: 'message.status',
				channelCode: 'support',
				accountId: 'inbox',
				message: { externalId: 'provider-message-1', deliveryStatus },
			},
		});
	}
	for (const op of ['receive', 'send', 'append', 'updateDelivery']) {
		assert.throws(() => request(op, 'TELEGRAM', { messageKey: ' ' }), /identifier/i);
	}
});

test('FAQ search sends the query and optional language, limit, selected and manual scopes', () => {
	assert.deepEqual(request('searchFaq', undefined, { query: 'Horario' }), {
		path: '/faqs/search',
		body: { query: 'Horario' },
	});
	assert.deepEqual(
		request('searchFaq', undefined, {
			query: 'Horario',
			searchFields: {
				language: 'CA',
				limit: 8,
				scopeTags: ['GENERAL', 'VERANO'],
				additionalScopeTags: 'GENERAL,EVENTOS',
			},
		}),
		{
			path: '/faqs/search',
			body: {
				query: 'Horario',
				language: 'CA',
				limit: 8,
				scopeTags: ['GENERAL', 'VERANO', 'EVENTOS'],
			},
		},
	);
});

test('append excludes conversation and ingest-only fields, and FAQ CRUD hides search-only fields', () => {
	const visible = (resource, operation) =>
		messageProperties.filter(
			(p) =>
				p.displayOptions?.show?.resource?.includes(resource) &&
				(!p.displayOptions.show.operation || p.displayOptions.show.operation.includes(operation)),
		);
	assert.ok(visible('message', 'append').some((p) => p.name === 'messageFields'));
	assert.ok(!visible('message', 'append').some((p) => p.name === 'conversationFields'));
	const append = visible('message', 'append').find((p) => p.name === 'messageFields');
	assert.ok(
		!append.options.some((p) => ['html', 'providerChatId', 'deliveryStatus'].includes(p.name)),
	);
	assert.ok(visible('faq', 'searchFaq').some((p) => p.name === 'query'));
	assert.deepEqual(visible('faq', 'create'), []);
});

test('a named social chat asks the app to create the Person unless explicitly disabled', () => {
	const contacts = { firstName: 'Noa', lastName: 'Ruiz', phone: '+34600111222' };
	for (const channel of ['WHATSAPP', 'TELEGRAM', 'INSTAGRAM']) {
		const identifier = channel === 'WHATSAPP' ? '54321@lid' : '1234';
		const { body } = request('receive', channel, {
			contactIdentifier: identifier,
			contactFields: contacts,
		});
		assert.equal(body.createPersonFromChat, true);
		assert.equal(body.contact.createPersonFromChat, undefined);
		assert.equal(body.contact.verified, undefined);
		assert.equal(
			request('receive', channel, {
				contactIdentifier: identifier,
				contactFields: { ...contacts, createPersonFromChat: false },
			}).body.createPersonFromChat,
			undefined,
		);
	}
	for (const fields of [
		{ contactFields: { name: 'Only a display name' } },
		{ contactFields: { lastName: ' ' } },
		{ contactFields: contacts, routingFields: { routingMode: 'CHANNEL' } },
	]) {
		assert.equal(request('receive', 'TELEGRAM', fields).body.createPersonFromChat, undefined);
	}
	assert.equal(
		request('receive', 'EMAIL', { contactIdentifier: 'test@example.com', contactFields: contacts })
			.body.createPersonFromChat,
		undefined,
	);
});

test('email with no reference can open its own provider-message thread without grouping unrelated mail by sender', () => {
	const fields = { contactIdentifier: 'user@example.com' };
	assert.equal(request('receive', 'EMAIL', fields).body.message.threadId, 'provider-message-1');
	assert.equal(
		request('send', 'EMAIL', { ...fields, messageKey: 'provider-message-2' }).body.message.threadId,
		'provider-message-2',
	);
	for (const key of ['caseId', 'issueKey', 'replyToExternalId']) {
		const { body } = request('receive', 'EMAIL', {
			...fields,
			routingFields: { [key]: 'explicit' },
		});
		assert.equal(body.message.threadId, undefined);
		assert.equal(body.message[key], 'explicit');
	}
	assert.equal(
		request('receive', 'EMAIL', { ...fields, messageFields: { idSource: 'idempotencyKey' } }).body
			.message.threadId,
		undefined,
	);
	assert.equal(
		request('receive', 'EMAIL', { ...fields, routingFields: { routingMode: 'CHANNEL' } }).body
			.message.threadId,
		undefined,
	);
});

test('private Telegram chats scope numeric message IDs and references to the chat', () => {
	for (const chatId of ['123', '456']) {
		const { body } = request('receive', 'TELEGRAM', {
			contactIdentifier: chatId,
			messageKey: '7',
			routingFields: { replyToExternalId: '6' },
		});
		assert.equal(body.message.externalId, chatId + '/7');
		assert.equal(body.message.replyToExternalId, chatId + '/6');
	}
	assert.throws(
		() => request('receive', 'TELEGRAM', { contactIdentifier: '-1001234' }),
		/private Telegram/i,
	);
	assert.equal(
		request('send', 'TELEGRAM', { contactIdentifier: '123', messageKey: '123/7' }).body.message
			.externalId,
		'123/7',
	);
	assert.equal(
		request('send', 'TELEGRAM', {
			contactIdentifier: '123',
			messageKey: '7',
			messageFields: { idSource: 'idempotencyKey' },
		}).body.message.idempotencyKey,
		'7',
	);
	for (const op of ['append', 'updateDelivery']) {
		const { body } = request(op, undefined, {
			caseId: 'case',
			messageKey: '7',
			scopeFields: { telegramChatId: '123' },
		});
		assert.equal(body.message.externalId, '123/7');
		assert.equal(body.telegramChatId, undefined);
	}
});
