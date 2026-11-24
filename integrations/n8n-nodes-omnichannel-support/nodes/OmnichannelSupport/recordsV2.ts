import {
	UserError,
	type IDataObject,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeProperties,
	type INodePropertyCollection,
	type INodePropertyOptions,
	type ResourceMapperFields,
} from 'n8n-workflow';
import {
	asObject,
	findRecordObject,
	mapperType,
	recordObjects,
	selectFields,
	writableFields,
	type RecordObject,
	type WorkspaceField,
} from './metadataV2';
import { twentyRequest } from './transportV2';

export const recordResources = recordObjects.map(({ name, value }) => ({ name, value }));
const resourceNames = recordResources.map((resource) => resource.value);
const readOps = ['get', 'getMany'];
const writeOps = ['create', 'update', 'updateDetails'];
const optionsFor = (object: RecordObject): INodePropertyOptions[] => {
	const name = object.name.toLowerCase();
	const options = [
		{ name: 'Get', value: 'get', action: `Get a ${name}` },
		{ name: 'Get Many', value: 'getMany', action: `Get many ${name} records` },
	];
	if (object.value === 'messageRecord') {
		options.push({
			name: 'Update Details',
			value: 'updateDetails',
			action: 'Update ordinary message details',
		});
	} else {
		options.push(
			{ name: 'Create', value: 'create', action: `Create a ${name}` },
			{ name: 'Delete', value: 'delete', action: `Delete a ${name}` },
			{ name: 'Update', value: 'update', action: `Update a ${name}` },
		);
	}
	if (object.value === 'faq')
		options.push({
			name: 'Search Published FAQs',
			value: 'searchFaq',
			action: 'Search published FAQs',
		});
	return options.sort((a, b) => a.name.localeCompare(b.name));
};
const writeVisibility = { show: { resource: resourceNames, operation: writeOps } };

function optionRows(fieldsMethod: string, valuesMethod: string): INodePropertyCollection[] {
	return [
		{
			displayName: 'Field',
			name: 'entries',
			values: [
				{
					displayName: 'Field Name or ID',
					name: 'field',
					type: 'options',
					default: '',
					required: true,
					description:
						'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
					typeOptions: {
						loadOptionsMethod: fieldsMethod,
						loadOptionsDependsOn: ['resource', 'operation'],
					},
				},
				{
					displayName: 'Option Names or IDs',
					name: 'values',
					type: 'multiOptions',
					default: [],
					description:
						'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
					typeOptions: {
						loadOptionsMethod: valuesMethod,
						loadOptionsDependsOn: ['resource', '&field'],
					},
				},
			],
		},
	];
}

export const recordProperties: INodeProperties[] = [
	...recordObjects.map(
		(object): INodeProperties => ({
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			default: 'get',
			displayOptions: { show: { resource: [object.value] } },
			options: optionsFor(object),
		}),
	),
	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 08dee4d0-17fa-4526-9184-e29cbd81fa36',
		displayOptions: {
			show: { resource: resourceNames, operation: ['get', 'update', 'updateDetails', 'delete'] },
		},
	},
	{
		displayName: 'Fields',
		name: 'recordFields',
		type: 'resourceMapper',
		default: { mappingMode: 'defineBelow', value: null },
		noDataExpression: true,
		typeOptions: {
			loadOptionsDependsOn: ['resource', 'operation'],
			resourceMapper: {
				resourceMapperMethod: 'getRecordFields',
				mode: 'add',
				addAllFields: false,
				supportAutoMap: false,
				fieldWords: { singular: 'field', plural: 'fields' },
				allowEmptyValues: true,
			},
		},
		displayOptions: writeVisibility,
	},
	{
		displayName: 'Multi-Select Fields',
		name: 'multiSelectFields',
		type: 'fixedCollection',
		default: {},
		placeholder: 'Add Multi-Select Field',
		typeOptions: { multipleValues: true },
		displayOptions: writeVisibility,
		options: optionRows('getRecordMultiSelectFields', 'getRecordMultiSelectValues'),
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: resourceNames, operation: ['getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: resourceNames, operation: ['getMany'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filter by Field',
		name: 'choiceFilters',
		type: 'fixedCollection',
		default: {},
		placeholder: 'Add Filter',
		typeOptions: { multipleValues: true },
		description: 'Match any selected value within each field. Records must match every filter.',
		displayOptions: { show: { resource: resourceNames, operation: ['getMany'] } },
		options: optionRows('getRecordFilterFields', 'getRecordFilterValues'),
	},
	{
		displayName: 'Options',
		name: 'recordOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: resourceNames, operation: readOps } },
		options: [
			{
				displayName: 'Expand Relations',
				name: 'expand',
				type: 'boolean',
				default: false,
				description: 'Whether to include related records one level deep',
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'string',
				default: '',
				placeholder: 'id,name',
				description: 'Comma-separated Twenty field API names to return',
			},
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'string',
				default: '',
				placeholder: 'status[eq]:"NEW"',
				description: 'Twenty REST filter expression',
				displayOptions: { show: { '/operation': ['getMany'] } },
			},
			{
				displayName: 'Order By',
				name: 'orderBy',
				type: 'string',
				default: '',
				placeholder: 'createdAt[DescNullsLast]',
				description: 'Twenty REST sort expression',
				displayOptions: { show: { '/operation': ['getMany'] } },
			},
		],
	},
];

async function editorFields(context: ILoadOptionsFunctions) {
	return await writableFields(
		context,
		findRecordObject(String(context.getCurrentNodeParameter('resource'))),
	);
}

export const recordMethods = {
	resourceMapping: {
		async getRecordFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
			const create = this.getCurrentNodeParameter('operation') === 'create';
			const fields = (await editorFields(this))
				.filter((f) => f.type !== 'MULTI_SELECT')
				.map((f) => {
					const required = create && f.requiredOnCreate;
					return {
						id: f.name,
						displayName: f.label,
						type: mapperType(f),
						required,
						removed: !required,
						display: true,
						defaultMatch: false,
						canBeUsedToMatch: false,
						...(f.type === 'SELECT' && { options: f.options }),
					};
				});
			fields.sort((a, b) => a.displayName.localeCompare(b.displayName));
			return { fields };
		},
	},
	loadOptions: {
		async getRecordFilterFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
			const fields = await selectFields(
				this,
				findRecordObject(String(this.getCurrentNodeParameter('resource'))),
			);
			return fields
				.map((field) => ({ name: field.label, value: field.name }))
				.sort((a, b) => a.name.localeCompare(b.name));
		},
		async getRecordFilterValues(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
			const name = this.getCurrentNodeParameter('&field');
			if (!name) return [];
			const fields = await selectFields(
				this,
				findRecordObject(String(this.getCurrentNodeParameter('resource'))),
			);
			return fields.find((field) => field.name === name)?.options ?? [];
		},
		async getRecordMultiSelectFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
			return (await editorFields(this))
				.filter((f) => f.type === 'MULTI_SELECT')
				.map((f) => ({ name: f.label, value: f.name }));
		},
		async getRecordMultiSelectValues(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
			const name = this.getCurrentNodeParameter('&field');
			if (!name) return [];
			return (
				(await editorFields(this)).find((f) => f.name === name && f.type === 'MULTI_SELECT')
					?.options ?? []
			);
		},
	},
};

function mappedValue(field: WorkspaceField, value: IDataObject[string]): IDataObject[string] {
	if (value === null) return null;
	const type = mapperType(field);
	if (type === 'array' || type === 'object') {
		let parsed: unknown = value;
		if (typeof value === 'string') {
			try {
				parsed = JSON.parse(value);
			} catch {
				parsed = undefined;
			}
		}
		if (type === 'array' ? !Array.isArray(parsed) : !asObject(parsed))
			throw new UserError(`Enter a JSON ${type} for ${field.label}`);
		return parsed as IDataObject[string];
	}
	if (type === 'options' && !field.options.some((o) => o.value === value))
		throw new UserError(`Choose an available option for ${field.label}`);
	return value;
}

async function recordBody(
	context: IExecuteFunctions,
	index: number,
	object: RecordObject,
	operation: string,
) {
	const fields = await writableFields(context, object);
	const byName = new Map(fields.map((f) => [f.name, f]));
	const mapper = context.getNodeParameter('recordFields', index, {}) as IDataObject;
	const selected = asObject(mapper.value) ?? {};
	const body: IDataObject = {};
	for (const [name, value] of Object.entries(selected)) {
		const field = byName.get(name);
		if (!field || field.type === 'MULTI_SELECT')
			throw new UserError(`Refresh Fields and choose a writable ${object.name} field`);
		if (value !== undefined) body[name] = mappedValue(field, value);
	}
	const multiple = context.getNodeParameter('multiSelectFields', index, {}) as IDataObject;
	for (const entry of Array.isArray(multiple.entries) ? multiple.entries : []) {
		const row = asObject(entry);
		const field = byName.get(String(row?.field));
		const values = row?.values;
		if (
			!field ||
			field.type !== 'MULTI_SELECT' ||
			!Array.isArray(values) ||
			values.some((v) => !field.options.some((o) => o.value === v))
		) {
			throw new UserError('Choose a workspace multi-select field and its available options');
		}
		if (Object.hasOwn(body, field.name)) throw new UserError(`Choose ${field.label} once`);
		body[field.name] = values;
	}
	if (
		object.value === 'setting' &&
		typeof body.key === 'string' &&
		body.key.trim().startsWith('omnichannel.internal.')
	) {
		throw new UserError('This setting key is reserved for internal Omnichannel state');
	}
	if (
		object.value === 'messageRecord' &&
		body.replyDecision != null &&
		!['REPLY', 'SKIP', 'ESCALATE'].includes(String(body.replyDecision))
	) {
		throw new UserError('Choose a bot decision available for ordinary messages');
	}
	if (operation !== 'create' && !Object.keys(body).length)
		throw new UserError('Add at least one field to update');
	return body;
}

function readOptions(context: IExecuteFunctions, index: number) {
	const options = context.getNodeParameter('recordOptions', index, {}) as IDataObject;
	const fields = String(options.fields ?? '').trim();
	return {
		qs: { depth: options.expand ? 1 : 0, ...(fields && { fields }) },
		filter: String(options.filter ?? '').trim(),
		orderBy: String(options.orderBy ?? '').trim(),
	};
}

async function recordFilter(
	context: IExecuteFunctions,
	object: RecordObject,
	index: number,
	advanced: string,
) {
	const filters = context.getNodeParameter('choiceFilters', index, {}) as IDataObject;
	const entries = filters.entries;
	if (entries === undefined || (Array.isArray(entries) && !entries.length)) return advanced;
	if (!Array.isArray(entries))
		throw new UserError('Choose a workspace filter field and at least one option');
	const fields = await selectFields(context, object);
	const conditions = advanced ? [advanced] : [];
	for (const entry of entries) {
		const row = asObject(entry);
		const field = fields.find((candidate) => candidate.name === row?.field);
		const values = row?.values;
		if (
			!field ||
			!Array.isArray(values) ||
			!values.length ||
			values.some((v) => !field.options.some((o) => o.value === v))
		) {
			throw new UserError(
				'Choose an available workspace filter field and at least one of its options',
			);
		}
		const comparator = field.type === 'MULTI_SELECT' ? 'containsAny' : 'in';
		conditions.push(field.name + '[' + comparator + ']:' + JSON.stringify(values));
	}
	return conditions.length === 1 ? conditions[0] : 'and(' + conditions.join(',') + ')';
}

async function getMany(
	context: IExecuteFunctions,
	object: RecordObject,
	index: number,
): Promise<IDataObject[]> {
	const returnAll = context.getNodeParameter('returnAll', index, false) === true;
	const limit = returnAll ? Infinity : Number(context.getNodeParameter('limit', index, 50));
	if (!returnAll && (!Number.isSafeInteger(limit) || limit <= 0))
		throw new UserError('Enter a positive record limit');
	const options = readOptions(context, index);
	const filter = await recordFilter(context, object, index, options.filter);
	const records: IDataObject[] = [];
	const seen = new Set<string>();
	let cursor: string | undefined;
	for (;;) {
		const pageSize = Math.min(60, limit - records.length);
		const qs: IDataObject = {
			...options.qs,
			limit: pageSize,
			order_by: options.orderBy || 'id[AscNullsLast]',
		};
		if (filter) qs.filter = filter;
		if (cursor) qs.starting_after = cursor;
		const response = await twentyRequest(context, 'GET', '/rest/' + object.plural, { qs });
		const data = asObject(response.data) ?? response;
		const rows = data[object.plural];
		if (!Array.isArray(rows) || rows.some((row) => !asObject(row)))
			throw new UserError('Twenty returned an invalid record list');
		records.push(...(rows.slice(0, limit - records.length) as IDataObject[]));
		const page = asObject(response.pageInfo ?? data.pageInfo);
		if (
			records.length === limit ||
			page?.hasNextPage === false ||
			(!page && rows.length < pageSize)
		)
			return records;
		const next = page?.endCursor;
		if (page?.hasNextPage !== true || typeof next !== 'string' || !next || seen.has(next))
			throw new UserError('Twenty returned an invalid pagination cursor');
		seen.add(next);
		cursor = next;
	}
}

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const capitalize = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export async function executeRecord(
	context: IExecuteFunctions,
	resource: string,
	operation: string,
	index: number,
): Promise<IDataObject[]> {
	const object = findRecordObject(resource);
	if (!optionsFor(object).some((o) => o.value === operation) || operation === 'searchFaq')
		throw new UserError('Choose a supported record operation');
	if (operation === 'getMany') return await getMany(context, object, index);
	const id =
		operation === 'create' ? '' : String(context.getNodeParameter('recordId', index, '')).trim();
	if (operation !== 'create' && !uuid.test(id))
		throw new UserError('Enter a valid Twenty record ID');
	const path = '/rest/' + object.plural;
	const write = writeOps.includes(operation);
	const body = write ? await recordBody(context, index, object, operation) : undefined;
	const method =
		operation === 'create'
			? 'POST'
			: operation === 'get'
				? 'GET'
				: operation === 'delete'
					? 'DELETE'
					: 'PATCH';
	const qs: IDataObject = operation === 'get' ? readOptions(context, index).qs : {};
	if (operation === 'delete') qs.soft_delete = true;
	// Filter within the mutation so concurrent state changes cannot turn a permitted row into an internal write.
	const guarded =
		operation === 'updateDetails' ||
		(resource === 'setting' && (operation === 'delete' || operation === 'update'));
	if (guarded) {
		const eligible =
			resource === 'setting'
				? 'or(key[is]:NULL,not(key[startsWith]:"omnichannel.internal."))'
				: 'proposalStatus[is]:NULL,or(proposalUpdateToken[is]:NULL,proposalUpdateToken[eq]:""),or(replyDecision[is]:NULL,replyDecision[neq]:"PENDING_REVIEW")';
		qs.filter = `and(id[eq]:"${id}",${eligible})`;
	}
	const response = await twentyRequest(context, method, id && !guarded ? path + '/' + id : path, {
		qs,
		body,
	});
	const data = asObject(response.data) ?? response;
	const mutation = operation === 'updateDetails' ? 'update' : operation;
	if (guarded) {
		const rows = data[mutation + capitalize(object.plural)];
		if (!Array.isArray(rows) || rows.length !== 1 || asObject(rows[0])?.id !== id) {
			throw new UserError(
				resource === 'setting'
					? 'The setting was unavailable for changes. Internal Omnichannel settings are reserved.'
					: 'The message was unavailable for changes. Only ordinary message details can be updated.',
			);
		}
		return [rows[0] as IDataObject];
	}
	const result =
		asObject(data[mutation + capitalize(object.singular)]) ??
		asObject(data[object.singular]) ??
		asObject(data[object.plural]) ??
		(typeof data.id === 'string' ? data : undefined);
	if (result) return [result];
	if (operation === 'delete' && !Object.keys(data).length) return [{ id, deleted: true }];
	throw new UserError(`Twenty returned an unexpected ${object.name} response`);
}
