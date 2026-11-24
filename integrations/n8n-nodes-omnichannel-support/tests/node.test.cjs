const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
	OmnichannelSupport,
} = require('../dist/nodes/OmnichannelSupport/OmnichannelSupport.node.js');

function fixture(
	fields,
	{ items = 1, statusCode = 200, response, continueOnFail = false, functionsUrl } = {},
) {
	const requests = [];
	const result = response ?? { ok: true, caseId: 'case-1', messageId: 'message-1' };
	const context = {
		getInputData: () => Array.from({ length: items }, () => ({ json: {} })),
		getNodeParameter: (name, _itemIndex, fallback) => fields[name] ?? fallback,
		getNode: () => ({ name: 'Omnichannel Support', type: 'omnichannelSupport', typeVersion: 1 }),
		getCredentials: async () => ({
			baseUrl: 'https://twenty.example.com/',
			functionsUrl,
			integrationSecret: 'test-secret',
		}),
		continueOnFail: () => continueOnFail,
		helpers: {
			async httpRequestWithAuthentication(name, options) {
				requests.push({ name, ...options });
				return { statusCode, body: result };
			},
		},
	};
	return { requests, execute: () => new OmnichannelSupport().getNodeType(1).execute.call(context) };
}

test('registers an incoming message and preserves the receipt and item pairing', async () => {
	const { execute, requests } = fixture({
		operation: 'receive',
		channelCode: 'wa-main',
		channelType: 'WHATSAPP',
		messageKey: 'wamid-1',
		body: 'Hola',
		receivedFields: {
			externalUserId: '123@lid',
			remoteJidAlt: '34600111222@s.whatsapp.net',
			threadId: 'chat-1',
		},
	});
	assert.deepEqual(await execute(), [
		[{ json: { ok: true, caseId: 'case-1', messageId: 'message-1' }, pairedItem: { item: 0 } }],
	]);
	assert.equal(requests[0].url, 'https://twenty.example.com/s/omnichannel/v1/ingest');
	assert.deepEqual(requests[0].body, {
		eventType: 'message.received',
		channelCode: 'wa-main',
		channelType: 'WHATSAPP',
		contact: { externalUserId: '123@lid', remoteJidAlt: '34600111222@s.whatsapp.net' },
		message: { externalId: 'wamid-1', body: 'Hola', threadId: 'chat-1' },
	});
	assert.equal(requests[0].headers['X-Omnichannel-Proposal-Key'], undefined);
});

test('proposes a reply for the saved message with the per-execution Wait URL and private credential', async () => {
	const callbackUrl = 'https://n8n.example.com/webhook-waiting/241?signature=test';
	const response = {
		ok: true,
		caseId: 'case-1',
		proposalMessageId: 'proposal-1',
		proposalStatus: 'PENDING',
	};
	const { execute, requests } = fixture(
		{
			operation: 'propose',
			messageId: 'message-1',
			replyText: 'Hola, [nombre]',
			callbackUrl,
		},
		{ response },
	);
	assert.deepEqual((await execute())[0][0].json, response);
	assert.equal(requests[0].url, 'https://twenty.example.com/s/omnichannel/v1/proposals/create');
	assert.equal(requests[0].headers['X-Omnichannel-Proposal-Key'], 'test-secret');
	assert.equal(requests[0].disableFollowRedirect, true);
	assert.deepEqual(requests[0].body, {
		messageId: 'message-1',
		body: 'Hola, [nombre]',
		callbackUrl,
	});
});

test('appends by caseId and records delivery by provider message ID', async () => {
	const append = fixture({
		operation: 'append',
		caseId: 'case-1',
		messageKey: 'sent-1',
		body: 'Aprobado',
	});
	await append.execute();
	assert.equal(
		append.requests[0].url,
		'https://twenty.example.com/s/omnichannel/v1/messages/append',
	);
	assert.equal(append.requests[0].headers['X-Omnichannel-Proposal-Key'], 'test-secret');
	assert.deepEqual(append.requests[0].body, {
		caseId: 'case-1',
		message: {
			externalId: 'sent-1',
			direction: 'OUTBOUND',
			body: 'Aprobado',
		},
	});
	const delivery = fixture({
		operation: 'updateDelivery',
		channelCode: 'wa-main',
		messageKey: 'sent-1',
		deliveryStatus: 'DELIVERED',
	});
	await delivery.execute();
	assert.deepEqual(delivery.requests[0].body, {
		eventType: 'message.status',
		channelCode: 'wa-main',
		message: { externalId: 'sent-1', deliveryStatus: 'DELIVERED' },
	});
});

test('uses a separate Twenty functions URL when configured', async () => {
	const { execute, requests } = fixture(
		{
			operation: 'append',
			caseId: 'case-1',
			messageKey: 'sent-1',
			body: 'Aprobado',
		},
		{ functionsUrl: 'https://functions.example.com/omnichannel/v1/' },
	);
	await execute();
	assert.equal(requests[0].url, 'https://functions.example.com/omnichannel/v1/messages/append');
});

test('a single Wait execution cannot be used for multiple items in the same proposal operation', async () => {
	const { execute, requests } = fixture({ operation: 'propose' }, { items: 2 });
	await assert.rejects(execute, /one item per execution/i);
	assert.equal(requests.length, 0);
});

test('returns an auditable API error code without exposing raw request or response content', async () => {
	const { execute } = fixture(
		{
			operation: 'append',
			caseId: 'case-1',
			messageKey: 'sent-1',
			body: 'Private draft',
		},
		{
			continueOnFail: true,
			statusCode: 409,
			response: { ok: false, error: { code: 'MESSAGE_CASE_CONFLICT', message: 'Private data' } },
		},
	);
	const [[item]] = await execute();
	assert.match(item.json.error, /409.*MESSAGE_CASE_CONFLICT/);
	assert.doesNotMatch(item.json.error, /Private/);
});
