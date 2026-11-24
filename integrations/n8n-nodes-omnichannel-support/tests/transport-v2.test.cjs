const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const {
	OmnichannelSupport,
} = require('../dist/nodes/OmnichannelSupport/OmnichannelSupport.node.js');

function workflow(fields, replies = [], count = 1) {
	const requests = [];
	const context = {
		getInputData: () => Array.from({ length: count }, () => ({ json: {} })),
		getNodeParameter: (name, i, fallback) => fields[name] ?? fallback,
		getNode: () => ({ name: 'Test', typeVersion: 2 }),
		getCredentials: async (name) => {
			assert.equal(name, 'twentyApi');
			return { baseUrl: 'https://crm.example/prefix/rest/metadata/', apiKey: 'unit-test-api-key' };
		},
		continueOnFail: () => false,
		helpers: {
			async httpRequestWithAuthentication(type, options) {
				assert.equal(type, 'twentyApi');
				requests.push(options);
				return { statusCode: 200, body: replies.shift() };
			},
		},
	};
	return {
		requests,
		execute: () => new OmnichannelSupport().getNodeType(2).execute.call(context),
		context,
	};
}

test('saved nodes keep v1 and new nodes default to the existing Twenty API credential', () => {
	const node = new OmnichannelSupport();
	assert.equal(node.getNodeType().description.version, 2);
	assert.deepEqual(node.getNodeType().description.credentials, [
		{ name: 'twentyApi', required: true },
	]);
	assert.equal(node.getNodeType(1).description.credentials[0].name, 'omnichannelSupportApi');
});

test('a protected request derives a private proof, only its fingerprint appears in the pairing operation', async () => {
	const pair = workflow({ resource: 'connection', operation: 'fingerprint' });
	const propose = workflow(
		{
			resource: 'message',
			operation: 'propose',
			messageId: 'msg',
			replyText: 'Hola',
			callbackUrl: 'https://n8n.test/webhook-waiting/1',
		},
		[{ publicFunctionDomain: null }, { ok: true, proposalStatus: 'PENDING' }],
	);
	const [[item]] = await pair.execute();
	await propose.execute();
	assert.equal(pair.requests.length, 0);
	const { url, headers, disableFollowRedirect } = propose.requests[1];
	assert.equal(url, 'https://crm.example/prefix/s/omnichannel/v1/proposals/create');
	assert.equal(disableFollowRedirect, true);
	const digest = (s) => createHash('sha256').update(s).digest('hex');
	const proof = 'twenty-v2.' + digest('omnichannel-support:n8n:v2\0unit-test-api-key');
	assert.equal(headers['X-Omnichannel-Proposal-Key'], proof);
	assert.deepEqual(item.json, { fingerprint: digest(proof) });
});

test('resolves the configured channel once per batch and uses the versioned ingest endpoint', async () => {
	const f = workflow(
		{
			resource: 'message',
			operation: 'receive',
			channelCode: 'wa',
			contactIdentifier: '+34600111222',
			messageKey: 'test',
			body: 'Hola',
		},
		[
			{ data: { supportChannels: [{ code: 'wa', channelType: 'WHATSAPP' }] } },
			{ publicFunctionDomain: null },
			{ ok: true },
			{ ok: true },
		],
		2,
	);
	const [items] = await f.execute();
	assert.equal(f.requests.length, 4);
	assert.equal(f.requests[0].url, 'https://crm.example/prefix/rest/supportChannels');
	assert.equal(f.requests[2].url, 'https://crm.example/prefix/s/omnichannel/v2/ingest');
	assert.equal(f.requests[2].body.routingMode, 'CHAT');
	assert.equal(f.requests[2].headers?.['X-Omnichannel-Proposal-Key'], undefined);
	assert.deepEqual(
		items.map((i) => i.pairedItem.item),
		[0, 1],
	);
});

test('a shared Wait callback rejects the whole batch before the first write', async () => {
	const f = workflow({ resource: 'message', operation: 'receive', includeProposal: true }, [], 2);
	await assert.rejects(f.execute(), /one item/i);
	assert.equal(f.requests.length, 0);
});

test('discovers the workspace functions host from trusted Twenty configuration once per execution', async () => {
	const f = workflow(
		{ resource: 'faq', operation: 'searchFaq', query: 'Horarios' },
		[
			{ publicFunctionDomain: 'functions.example.net' },
			{ data: { currentWorkspace: { subdomain: 'support' } } },
			{ ok: true, results: [] },
			{ ok: true, results: [] },
		],
		2,
	);
	await f.execute();
	assert.deepEqual(
		f.requests.map((r) => r.url),
		[
			'https://crm.example/prefix/client-config',
			'https://crm.example/prefix/metadata',
			'https://support.functions.example.net/omnichannel/v1/faqs/search',
			'https://support.functions.example.net/omnichannel/v1/faqs/search',
		],
	);
	assert.ok(f.requests.every((r) => r.disableFollowRedirect));
});
test('refuses a function domain containing credentials, URLs or paths before sending a proof', async () => {
	const f = workflow(
		{
			resource: 'message',
			operation: 'propose',
			messageId: 'msg',
			replyText: 'a',
			callbackUrl: 'https://n8n.test/webhook-waiting/1',
		},
		[{ publicFunctionDomain: 'example.net@other.test/path' }],
	);
	await assert.rejects(f.execute(), /function domain/i);
	assert.equal(f.requests.length, 1);
	assert.equal(f.requests[0].headers?.['X-Omnichannel-Proposal-Key'], undefined);
});
