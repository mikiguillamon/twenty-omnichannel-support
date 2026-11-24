import {
	UserError,
	type IDataObject,
	type INodePropertyOptions,
	type ResourceMapperField,
} from 'n8n-workflow';
import { twentyRequest, type TwentyContext } from './transportV2';

// Installation-independent identifiers from the Omnichannel application manifest.
export const recordObjects = [
	{
		name: 'Case',
		value: 'case',
		singular: 'supportCase',
		plural: 'supportCases',
		uuid: '5f843584-1ed8-584f-9e93-42af1f478957',
	},
	{
		name: 'Case Type',
		value: 'caseType',
		singular: 'supportType',
		plural: 'supportTypes',
		uuid: '71a30000-57ee-5a00-8d00-000000000001',
	},
	{
		name: 'Category',
		value: 'category',
		singular: 'supportCategory',
		plural: 'supportCategories',
		uuid: '89f44997-be47-568e-9f1a-ff08ef4aed95',
	},
	{
		name: 'Channel',
		value: 'channel',
		singular: 'supportChannel',
		plural: 'supportChannels',
		uuid: '3b02213f-77e9-5143-9c34-a4afe0ca079a',
	},
	{
		name: 'Conversation View',
		value: 'conversationView',
		singular: 'supportConversationView',
		plural: 'supportConversationViews',
		uuid: '51537528-78d9-489e-b6e9-a8f28d081c50',
	},
	{
		name: 'Dashboard',
		value: 'dashboard',
		singular: 'supportDashboard',
		plural: 'supportDashboards',
		uuid: '71a50000-57ee-5a00-8d00-000000000001',
	},
	{
		name: 'Evaluation',
		value: 'evaluation',
		singular: 'supportEvaluation',
		plural: 'supportEvaluations',
		uuid: '6a27a122-eb32-5723-8a7f-87067d8089eb',
	},
	{
		name: 'External Identity',
		value: 'externalIdentity',
		singular: 'supportExternalIdentity',
		plural: 'supportExternalIdentities',
		uuid: '71a00000-57ee-5a00-8d00-000000000009',
	},
	{
		name: 'FAQ',
		value: 'faq',
		singular: 'supportFaq',
		plural: 'supportFaqs',
		uuid: 'b6cbc813-9e97-5b66-a4dd-28070f441fa3',
	},
	{
		name: 'Identity Alias',
		value: 'identityAlias',
		singular: 'supportIdentityAlias',
		plural: 'supportIdentityAliases',
		uuid: '71a10000-57ee-5a00-8d00-000000000001',
	},
	{
		name: 'Message Record',
		value: 'messageRecord',
		singular: 'supportMessage',
		plural: 'supportMessages',
		uuid: '738b4a0c-d65e-5812-9482-594a79ae0ba7',
	},
	{
		name: 'Setting',
		value: 'setting',
		singular: 'supportSetting',
		plural: 'supportSettings',
		uuid: '232da773-0bcf-5da3-9ba7-a6040e9918e2',
	},
];

export type RecordObject = (typeof recordObjects)[number];

export function findRecordObject(value: string): RecordObject {
	const object = recordObjects.find((entry) => entry.value === value);
	if (!object) throw new UserError('Choose an Omnichannel record resource');
	return object;
}

export function asObject(value: unknown): IDataObject | undefined {
	if (value && typeof value === 'object' && !Array.isArray(value)) return value as IDataObject;
	return undefined;
}

const query = `query OmnichannelRecordFields($id: UUID!) {
	objects(filter: { universalIdentifier: { eq: $id } }, paging: { first: 1 }) {
		edges { node { namePlural isActive isUIReadOnly fieldsList {
			name label type isActive isSystem isUIReadOnly isNullable defaultValue options settings
			relation { type }
		} } }
	}
}`;

function readJson(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

const forbiddenNames = new Set([
	'__proto__',
	'constructor',
	'prototype',
	'id',
	'createdAt',
	'updatedAt',
	'deletedAt',
	'createdBy',
	'updatedBy',
	'searchVector',
]);
const isApiName = (value: unknown): value is string =>
	typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(value) && !forbiddenNames.has(value);
const isRelation = (type: string) => type === 'RELATION' || type === 'MORPH_RELATION';
const protectedMessageFields = new Set([
	'externalKey',
	'direction',
	'senderType',
	'fromAddress',
	'toAddress',
	'occurredAt',
	'deliveryStatus',
	'provider',
	'proposalStatus',
	'proposalUpdateToken',
	'sentAt',
	'deliveredAt',
	'replyToExternalKey',
	'providerChatId',
	'providerChatIdAlt',
	'providerAddressingMode',
	'providerMessageId',
	'supportCaseId',
	'supportCase',
	'position',
]);
const botDecisions = new Set(['REPLY', 'SKIP', 'ESCALATE']);
export interface WorkspaceField {
	readOnly: boolean;
	name: string;
	label: string;
	type: string;
	requiredOnCreate: boolean;
	options: INodePropertyOptions[];
}

function readOptions(raw: unknown): INodePropertyOptions[] {
	const choices = readJson(raw);
	if (!Array.isArray(choices)) return [];
	return choices.flatMap((choice) => {
		const option = asObject(choice);
		return typeof option?.value === 'string' && typeof option.label === 'string'
			? [{ name: option.label, value: option.value }]
			: [];
	});
}

async function fetchFields(
	context: TwentyContext,
	object: RecordObject,
): Promise<{ fields: WorkspaceField[]; readOnly: boolean }> {
	const response = await twentyRequest(context, 'POST', '/metadata', {
		body: { query, variables: { id: object.uuid } },
	});
	const edges = asObject(asObject(response.data)?.objects)?.edges;
	if (response.errors || !Array.isArray(edges)) {
		throw new UserError(
			'Could not load Omnichannel field metadata. Check that the Twenty credential can read the workspace schema.',
		);
	}
	const metadata = edges
		.map((edge) => asObject(asObject(edge)?.node))
		.find((node) => node?.namePlural === object.plural);
	if (!metadata || metadata.isActive === false || !Array.isArray(metadata.fieldsList)) {
		throw new UserError(`Twenty could not find active field metadata for ${object.name}`);
	}
	const fields: WorkspaceField[] = [];
	for (const entry of metadata.fieldsList) {
		const field = asObject(entry);
		if (
			!field ||
			!isApiName(field.name) ||
			typeof field.type !== 'string' ||
			field.isActive === false ||
			field.isSystem === true ||
			field.type === 'TS_VECTOR'
		)
			continue;
		let name = field.name;
		let label = String(field.label || name);
		if (isRelation(field.type)) {
			const settings = asObject(readJson(field.settings));
			if ((settings?.relationType ?? asObject(field.relation)?.type) !== 'MANY_TO_ONE') continue;
			const column = settings?.joinColumnName ?? name + 'Id';
			if (!isApiName(column)) continue;
			name = column;
			label += ' ID';
		}
		fields.push({
			name,
			label,
			type: field.type,
			readOnly: field.isUIReadOnly === true || field.isUIEditable === false,
			requiredOnCreate: field.isNullable === false && field.defaultValue == null,
			options: readOptions(field.options),
		});
	}
	return { fields, readOnly: metadata.isUIReadOnly === true || metadata.isUIEditable === false };
}

// Keep the metadata snapshot within one execution or editor request and one credential.
const snapshots = new WeakMap<TwentyContext, Map<string, ReturnType<typeof fetchFields>>>();
async function snapshot(context: TwentyContext, object: RecordObject) {
	let cache = snapshots.get(context);
	if (!cache) {
		cache = new Map();
		snapshots.set(context, cache);
	}
	const existing = cache.get(object.plural);
	if (existing) return await existing;
	const pending = fetchFields(context, object);
	cache.set(object.plural, pending);
	return await pending;
}

export async function loadWorkspaceSelectOptions(
	context: TwentyContext,
	plural: string,
	fieldName: string,
): Promise<INodePropertyOptions[]> {
	const object = recordObjects.find((entry) => entry.plural === plural);
	if (!object) throw new UserError('Choose an Omnichannel record resource');
	const { fields } = await snapshot(context, object);
	return fields.find((field) => field.name === fieldName)?.options ?? [];
}

export async function selectFields(
	context: TwentyContext,
	object: RecordObject,
): Promise<WorkspaceField[]> {
	const { fields } = await snapshot(context, object);
	return fields.filter((field) => field.type === 'SELECT' || field.type === 'MULTI_SELECT');
}

export async function writableFields(
	context: TwentyContext,
	object: RecordObject,
): Promise<WorkspaceField[]> {
	const { fields, readOnly } = await snapshot(context, object);
	if (readOnly) throw new UserError(`Twenty marks ${object.name} as read-only`);
	const writable = fields.filter((field) => !field.readOnly);
	if (object.value !== 'messageRecord') return writable;
	return writable
		.filter((f) => !protectedMessageFields.has(f.name) && !isRelation(f.type))
		.map((f) =>
			f.name === 'replyDecision'
				? { ...f, options: f.options.filter((o) => botDecisions.has(String(o.value))) }
				: f,
		);
}

const mapperTypes: Record<string, ResourceMapperField['type']> = {
	TEXT: 'string',
	RATING: 'string',
	UUID: 'string',
	DATE: 'string',
	DATE_TIME: 'dateTime',
	SELECT: 'options',
	BOOLEAN: 'boolean',
	POSITION: 'number',
	NUMERIC: 'number',
	NUMBER: 'number',
	RELATION: 'string',
	MORPH_RELATION: 'string',
	FILES: 'array',
	ARRAY: 'array',
	MULTI_SELECT: 'array',
};

export function mapperType(field: WorkspaceField) {
	return mapperTypes[field.type] ?? 'object';
}
