const assert = require('node:assert/strict');
const { test } = require('node:test');
const api = require('../dist/nodes/OmnichannelSupport/recordsV2.js');
const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const record = { id, question: 'Where?' };
const choice = (value, label) => ({ value, label, position: 0, color: 'blue' });
const textField = (name, extra = {}) => ({
	name,
	label: name,
	type: 'TEXT',
	isNullable: true,
	...extra,
});
const metadataFields = [
	textField('question', { label: 'Question', isNullable: false }),
	textField('status', {
		type: 'SELECT',
		defaultValue: "'DRAFT'",
		isNullable: false,
		options: [choice('CUSTOM', 'Workspace choice')],
	}),
	textField('colors', { type: 'MULTI_SELECT', options: [choice('TEAL', 'Team teal')] }),
	textField('revision', { type: 'NUMBER' }),
	textField('enabled', { type: 'BOOLEAN' }),
	textField('tagsArray', { type: 'ARRAY' }),
	textField('links', { type: 'LINKS' }),
	textField('category', {
		label: 'Category',
		type: 'RELATION',
		relation: { type: 'MANY_TO_ONE' },
		settings: { joinColumnName: 'categoryId' },
	}),
	textField('supportCases', { type: 'RELATION', relation: { type: 'ONE_TO_MANY' } }),
	textField('old', { isActive: false }),
	textField('generated', { isUIReadOnly: true }),
	textField('hidden', { isSystem: true }),
];
function fixture(params = {}, { fields = metadataFields, plural = 'supportFaqs', rest = [] } = {}) {
	const requests = [];
	const context = {
		getCredentials: async () => ({ baseUrl: 'https://twenty.example', apiKey: 'test' }),
		getNode: () => ({ typeVersion: 2, name: 'Omnichannel Support' }),
		getNodeParameter: (name, _index, fallback) => params[name] ?? fallback,
		getCurrentNodeParameter: (name) => params[name],
		helpers: {
			async httpRequestWithAuthentication(_credential, request) {
				requests.push(request);
				if (new URL(request.url).pathname === '/metadata') {
					const node = { namePlural: plural, isActive: true, fieldsList: fields };
					return { statusCode: 200, body: { data: { objects: { edges: [{ node }] } } } };
				}
				assert.ok(rest.length, 'Unexpected REST request');
				return { statusCode: 200, body: rest.shift() };
			},
		},
	};
	return { context, requests };
}

test('record resource menu covers all app objects and protects message lifecycle operations', () => {
	assert.ok(Array.isArray(api.recordResources), 'Record resources must be present');
	assert.equal(api.recordResources.length, 12);
	for (const { value } of api.recordResources) {
		const p = api.recordProperties.find(
			(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(value),
		);
		assert.ok(p, value);
		const options = p.options.map((o) => o.value);
		assert.ok(options.includes('get') && options.includes('getMany'), value);
		if (value === 'messageRecord') {
			assert.deepEqual(options.sort(), ['get', 'getMany', 'updateDetails']);
		} else {
			for (const op of ['create', 'update', 'delete']) assert.ok(options.includes(op), value);
		}
		if (value === 'faq') assert.ok(options.includes('searchFaq'));
	}
});

test('mapper exposes required fields, optional scalar choices, many-to-one IDs and writable workspace fields', async () => {
	const { context, requests } = fixture({ resource: 'faq', operation: 'create' });
	const { fields } = await api.recordMethods.resourceMapping.getRecordFields.call(context);
	const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
	assert.equal(byId.question.required, true);
	assert.equal(byId.question.removed, false);
	assert.deepEqual(byId.status.options, [{ name: 'Workspace choice', value: 'CUSTOM' }]);
	assert.equal(byId.status.removed, true);
	assert.equal(byId.categoryId.type, 'string');
	for (const key of ['supportCases', 'old', 'generated', 'hidden'])
		assert.equal(byId[key], undefined);
	assert.match(requests[0].body.query, /fieldsList/);
	assert.match(requests[0].body.query, /universalIdentifier/);
});

test('multi-select offers workspace labels and writes the selected option values', async () => {
	const { context, requests } = fixture(
		{
			resource: 'faq',
			operation: 'create',
			'&field': 'colors',
			recordFields: {
				value: {
					question: 'Where?',
					revision: 0,
					enabled: false,
					tagsArray: '["local"]',
					links: '{"primaryLinkUrl":"https://example.com"}',
					categoryId: id,
				},
			},
			multiSelectFields: { entries: [{ field: 'colors', values: ['TEAL'] }] },
		},
		{ rest: [{ data: { createSupportFaq: record } }] },
	);
	assert.deepEqual(await api.recordMethods.loadOptions.getRecordMultiSelectValues.call(context), [
		{ name: 'Team teal', value: 'TEAL' },
	]);
	assert.deepEqual(await api.executeRecord(context, 'faq', 'create', 0), [record]);
	const write = requests.at(-1);
	assert.equal(write.method, 'POST');
	assert.equal(write.url, 'https://twenty.example/rest/supportFaqs');
	assert.deepEqual(write.body, {
		question: 'Where?',
		revision: 0,
		enabled: false,
		tagsArray: ['local'],
		links: { primaryLinkUrl: 'https://example.com' },
		categoryId: id,
		colors: ['TEAL'],
	});
});

test('get and update return the record, preserve explicit clears, and delete requests soft deletion', async () => {
	for (const [op, method, envelope] of [
		['get', 'GET', 'supportFaq'],
		['update', 'PATCH', 'updateSupportFaq'],
		['delete', 'DELETE', 'deleteSupportFaq'],
	]) {
		const { context, requests } = fixture(
			{ recordId: id, recordFields: { value: { status: 'CUSTOM', categoryId: null } } },
			{ rest: [{ data: { [envelope]: record } }] },
		);
		const [result] = await api.executeRecord(context, 'faq', op, 0);
		assert.equal(result.id, id);
		const req = requests.at(-1);
		assert.equal(req.url, 'https://twenty.example/rest/supportFaqs/' + id);
		assert.equal(req.method, method);
		if (op === 'delete') assert.equal(req.qs.soft_delete, true);
		if (op === 'update') assert.deepEqual(req.body, { status: 'CUSTOM', categoryId: null });
	}
});

test('getMany keeps filters, uses opaque cursors and stops at the item limit', async () => {
	const p = (rows, hasNextPage, endCursor) => ({
		data: { supportCases: rows.map((n) => ({ id: n })) },
		pageInfo: { hasNextPage, endCursor },
	});
	const { context, requests } = fixture(
		{
			returnAll: false,
			limit: 3,
			recordOptions: { filter: 'status[eq]:"NEW"', orderBy: 'id[AscNullsLast]' },
		},
		{ rest: [p([1, 2], true, 'opaque'), p([3, 4], true, 'unused')] },
	);
	assert.deepEqual(await api.executeRecord(context, 'case', 'getMany', 0), [
		{ id: 1 },
		{ id: 2 },
		{ id: 3 },
	]);
	assert.deepEqual(
		requests.map((r) => [r.qs.limit, r.qs.starting_after, r.qs.filter]),
		[
			[3, undefined, 'status[eq]:"NEW"'],
			[1, 'opaque', 'status[eq]:"NEW"'],
		],
	);
});

test('returnAll rejects stalled pagination and invalid single-record IDs', async () => {
	const page = { data: { supportFaqs: [], pageInfo: { hasNextPage: true, endCursor: 'repeat' } } };
	const { context } = fixture({ returnAll: true }, { rest: [page, page] });
	await assert.rejects(api.executeRecord(context, 'faq', 'getMany', 0), /cursor/i);
	const bad = fixture({ recordId: '..' });
	await assert.rejects(api.executeRecord(bad.context, 'faq', 'delete', 0), /ID/i);
	assert.equal(bad.requests.length, 0);
});

test('internal settings stay readable while all mutation paths guard the reserved namespace', async () => {
	const fields = [textField('key'), textField('enabled', { type: 'BOOLEAN' })];
	const locked = 'omnichannel.internal.proposal-decision.test';
	const stored = { id, key: locked };
	const read = fixture({ recordId: id }, { rest: [{ data: { supportSetting: stored } }] });
	assert.deepEqual(await api.executeRecord(read.context, 'setting', 'get', 0), [stored]);

	for (const operation of ['create', 'update']) {
		const f = fixture(
			{ recordId: id, recordFields: { value: { key: locked } } },
			{ plural: 'supportSettings', fields },
		);
		await assert.rejects(
			api.executeRecord(f.context, 'setting', operation, 0),
			/internal|reserved/i,
		);
		assert.ok(f.requests.every((r) => r.url.endsWith('/metadata')));
	}
	for (const [op, envelope] of [
		['update', 'updateSupportSettings'],
		['delete', 'deleteSupportSettings'],
	]) {
		const f = fixture(
			{ recordId: id, recordFields: { value: { enabled: false } } },
			{ plural: 'supportSettings', fields, rest: [{ data: { [envelope]: [] } }] },
		);
		await assert.rejects(api.executeRecord(f.context, 'setting', op, 0), /setting/i);
		const req = f.requests.at(-1);
		assert.equal(req.url, 'https://twenty.example/rest/supportSettings');
		assert.match(req.qs.filter, /id\[eq\]/);
		assert.match(req.qs.filter, /not\(key\[startsWith\]:"omnichannel\.internal\."/);
	}
});

test('Update Details changes only regular messages and withholds the human decision from the mapper and payload', async () => {
	const fields = [
		textField('proposalStatus'),
		textField('provider'),
		textField('draftBody'),
		textField('customScore', { type: 'NUMBER' }),
		textField('replyDecision', {
			type: 'SELECT',
			options: [choice('REPLY', 'Reply'), choice('PENDING_REVIEW', 'Wait')],
		}),
	];
	const f = fixture(
		{
			resource: 'messageRecord',
			operation: 'updateDetails',
			recordId: id,
			recordFields: { value: { draftBody: 'Revised', customScore: 0, replyDecision: 'REPLY' } },
		},
		{ plural: 'supportMessages', fields, rest: [{ data: { updateSupportMessages: [{ id }] } }] },
	);
	const schema = (await api.recordMethods.resourceMapping.getRecordFields.call(f.context)).fields;
	assert.deepEqual(schema.find((s) => s.id === 'replyDecision').options, [
		{ name: 'Reply', value: 'REPLY' },
	]);
	assert.ok(!schema.some((s) => ['proposalStatus', 'provider'].includes(s.id)));
	assert.deepEqual(await api.executeRecord(f.context, 'messageRecord', 'updateDetails', 0), [
		{ id },
	]);
	assert.match(f.requests.at(-1).qs.filter, /proposalStatus\[is\]:NULL/);
	assert.match(f.requests.at(-1).qs.filter, /proposalUpdateToken/);
	for (const value of [
		{ replyDecision: 'PENDING_REVIEW' },
		{ proposalStatus: null },
		{ provider: 'other' },
	]) {
		const invalid = fixture(
			{ recordId: id, recordFields: { value } },
			{ plural: 'supportMessages', fields },
		);
		await assert.rejects(api.executeRecord(invalid.context, 'messageRecord', 'updateDetails', 0));
		assert.ok(invalid.requests.every((r) => r.url.endsWith('/metadata')));
	}
	for (const op of ['create', 'delete', 'update'])
		await assert.rejects(api.executeRecord(f.context, 'messageRecord', op, 0));
});

test('a field removed from the workspace or a stale choice is rejected before mutation', async () => {
	for (const recordFields of [
		{ value: { unknown: true } },
		{ value: { status: 'DRAFT' } },
		{ value: { links: '[]' } },
	]) {
		const f = fixture({ recordId: id, recordFields });
		await assert.rejects(api.executeRecord(f.context, 'faq', 'update', 0));
		assert.ok(f.requests.every((r) => r.url.endsWith('/metadata')));
	}
	const f = fixture(
		{ recordId: id, recordFields: { value: { draftBody: 'Update' } } },
		{
			plural: 'supportMessages',
			fields: [textField('draftBody')],
			rest: [{ data: { updateSupportMessages: [] } }],
		},
	);
	await assert.rejects(
		api.executeRecord(f.context, 'messageRecord', 'updateDetails', 0),
		/ordinary message/i,
	);
});

test('regular setting updates return their one matching row and new workspace schema snapshots are isolated', async () => {
	const fields = [textField('valueText')];
	const updated = { id, valueText: 'changed' };
	const ordinary = fixture(
		{ recordId: id, recordFields: { value: { valueText: 'changed' } } },
		{ plural: 'supportSettings', fields, rest: [{ data: { updateSupportSettings: [updated] } }] },
	);
	assert.deepEqual(await api.executeRecord(ordinary.context, 'setting', 'update', 0), [updated]);
	const second = fixture(
		{ resource: 'faq', operation: 'update' },
		{
			fields: [
				textField('phase', { type: 'SELECT', options: JSON.stringify([choice('LOCAL', 'Local')]) }),
			],
		},
	);
	const schema = (await api.recordMethods.resourceMapping.getRecordFields.call(second.context))
		.fields;
	assert.deepEqual(
		schema.map((f) => f.id),
		['phase'],
	);
	assert.equal(schema[0].options[0].value, 'LOCAL');
});

test('n8n resolves operation-specific controls through the normal versioned node entry point', () => {
	const { NodeHelpers } = require('n8n-workflow');
	const {
		OmnichannelSupport,
	} = require('../dist/nodes/OmnichannelSupport/OmnichannelSupport.node.js');
	const description = new OmnichannelSupport().getNodeType(2).description;
	const controls = (resource, operation) =>
		NodeHelpers.getNodeParameters(
			description.properties,
			{ resource, operation },
			true,
			false,
			{ typeVersion: 2 },
			description,
		);
	const faqWrite = controls('faq', 'create');
	assert.ok(Object.hasOwn(faqWrite, 'recordFields'));
	assert.ok(Object.hasOwn(faqWrite, 'multiSelectFields'));
	assert.ok(!Object.hasOwn(faqWrite, 'searchFields'));
	assert.ok(!Object.hasOwn(controls('case', 'getMany'), 'recordFields'));
	assert.ok(Object.hasOwn(controls('faq', 'searchFaq'), 'searchFields'));
});

test('Get Many filters expose workspace enum labels and combine any selected values per field with AND across fields', async () => {
	const { NodeHelpers } = require('n8n-workflow');
	const {
		OmnichannelSupport,
	} = require('../dist/nodes/OmnichannelSupport/OmnichannelSupport.node.js');
	const description = new OmnichannelSupport().getNodeType(2).description;
	const advanced = 'or(question[eq]:"Help",question[eq]:"FAQ")';
	const params = {
		resource: 'faq',
		operation: 'getMany',
		limit: 4,
		recordOptions: { filter: advanced },
		choiceFilters: {
			entries: [
				{ field: 'status', values: ['CUSTOM', 'PUBLISHED'] },
				{ field: 'colors', values: ['TEAL'] },
			],
		},
	};
	const saved = NodeHelpers.getNodeParameters(
		description.properties,
		params,
		true,
		false,
		{ typeVersion: 2 },
		description,
	);
	assert.deepEqual(saved.choiceFilters, params.choiceFilters);
	const fields = [
		textField('status', {
			type: 'SELECT',
			label: 'State',
			isUIReadOnly: true,
			options: [choice('CUSTOM', 'My state'), choice('PUBLISHED', 'Published')],
		}),
		...metadataFields.filter((f) => f.name !== 'status'),
	];
	const pages = [{ data: { supportFaqs: [{ id }] }, pageInfo: { hasNextPage: false } }];
	const f = fixture({ ...saved, '&field': 'status' }, { fields, rest: pages });
	const load = api.recordMethods.loadOptions;
	assert.deepEqual(await load.getRecordFilterFields.call(f.context), [
		{ name: 'colors', value: 'colors' },
		{ name: 'State', value: 'status' },
	]);
	assert.deepEqual(await load.getRecordFilterValues.call(f.context), [
		{ name: 'My state', value: 'CUSTOM' },
		{ name: 'Published', value: 'PUBLISHED' },
	]);
	assert.deepEqual(await api.executeRecord(f.context, 'faq', 'getMany', 0), [{ id }]);
	assert.equal(
		f.requests.at(-1).qs.filter,
		'and(' + advanced + ',status[in]:["CUSTOM","PUBLISHED"],colors[containsAny]:["TEAL"])',
	);
});

test('Get Many loads metadata only for configured pickers and rejects stale or empty enum selections', async () => {
	const clean = fixture(
		{ recordOptions: { filter: 'question[eq]:"Which?"' } },
		{ rest: [{ data: { supportFaqs: [] } }] },
	);
	await api.executeRecord(clean.context, 'faq', 'getMany', 0);
	assert.deepEqual(
		clean.requests.map((r) => [r.method, r.qs.filter]),
		[['GET', 'question[eq]:"Which?"']],
	);
	for (const entry of [
		{ field: 'status', values: ['CLOSED'] },
		{ field: 'status', values: [] },
		{ field: 'question', values: ['TEXT'] },
		{ field: 'missing', values: ['CUSTOM'] },
	]) {
		const f = fixture({ choiceFilters: { entries: [entry] } });
		await assert.rejects(api.executeRecord(f.context, 'faq', 'getMany', 0), /filter|option/i);
		assert.ok(f.requests.every((r) => r.url.endsWith('/metadata')));
	}
});
