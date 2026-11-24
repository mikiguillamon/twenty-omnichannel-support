import {
	UserError,
	type IDataObject,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
} from 'n8n-workflow';
import { loadWorkspaceSelectOptions } from './metadataV2';
import { twentyRequest, type TwentyContext } from './transportV2';

export async function resolveChannel(context: TwentyContext, code: string): Promise<string> {
	const channel = code.trim().toLowerCase();
	if (!channel || channel.length > 120) throw new UserError('Choose a configured support channel');
	const response = await twentyRequest(context, 'GET', '/rest/supportChannels', {
		qs: {
			fields: 'code,channelType',
			depth: 0,
			limit: 2,
			filter: 'code[eq]:' + JSON.stringify(channel),
		},
	});
	const rows = (response.data as IDataObject)?.supportChannels;
	if (
		!Array.isArray(rows) ||
		rows.length !== 1 ||
		rows[0]?.code !== channel ||
		!['EMAIL', 'WHATSAPP', 'TELEGRAM', 'INSTAGRAM', 'PHONE'].includes(rows[0]?.channelType)
	) {
		throw new UserError('The channel was not found in the selected Twenty workspace');
	}
	return rows[0].channelType;
}

async function catalogRows(
	context: ILoadOptionsFunctions,
	plural: string,
	fields: string,
	filter?: string,
) {
	const rows: IDataObject[] = [];
	const seen = new Set<string>();
	let cursor: string | undefined;
	do {
		const response = await twentyRequest(context, 'GET', '/rest/' + plural, {
			qs: {
				fields,
				limit: 60,
				depth: 0,
				order_by: 'id[AscNullsLast]',
				...(filter && { filter }),
				...(cursor && { starting_after: cursor }),
			},
		});
		const data = response.data as IDataObject;
		const records = data?.[plural];
		if (!Array.isArray(records))
			throw new UserError('Unexpected response while loading Twenty choices');
		rows.push(...(records as IDataObject[]));
		const pageInfo = (response.pageInfo ?? data.pageInfo) as IDataObject | undefined;
		if (!pageInfo && records.length < 60) break;
		if (pageInfo?.hasNextPage === false) break;
		const next = pageInfo?.endCursor;
		if (pageInfo?.hasNextPage !== true || typeof next !== 'string' || !next || seen.has(next)) {
			throw new UserError('Twenty returned an invalid catalog cursor');
		}
		seen.add(next);
		cursor = next;
	} while (cursor);
	return rows;
}

function taxonomy(plural: string) {
	return async function (this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const rows = await catalogRows(this, plural, 'id,name,code,enabled');
		return rows
			.filter((row) => row.enabled !== false && typeof row.id === 'string')
			.map((row) => ({ name: String(row.name || row.code), value: String(row.id) }));
	};
}

function tags(plural: string, field: string) {
	return async function (this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const rows = await catalogRows(
			this,
			plural,
			'id,' + field,
			field === 'scopeTags' ? 'status[eq]:"PUBLISHED"' : undefined,
		);
		const values = new Set<string>(field === 'scopeTags' ? ['GENERAL'] : []);
		for (const row of rows) {
			const entries = row[field];
			if (Array.isArray(entries))
				for (const entry of entries) {
					if (typeof entry === 'string' && entry.trim()) values.add(entry.trim());
				}
		}
		return [...values].sort((a, b) => a.localeCompare(b)).map((value) => ({ name: value, value }));
	};
}

function choices(plural: string, field: string, allowed: string[]) {
	return async function (this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const options = await loadWorkspaceSelectOptions(this, plural, field);
		return options.filter((option) => allowed.includes(String(option.value)));
	};
}
export const catalogOptions = {
	async getChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const records = await catalogRows(this, 'supportChannels', 'id,name,code,channelType');
		return records
			.filter((row) => row.code)
			.map((row) => ({
				name: String(row.name || row.code) + ' (' + String(row.channelType) + ')',
				value: String(row.code),
				description: String(row.code),
			}));
	},
	getCategories: taxonomy('supportCategories'),
	getTypes: taxonomy('supportTypes'),
	getCustomTags: tags('supportCases', 'customTags'),
	getFaqScopes: tags('supportFaqs', 'scopeTags'),
	getConversationStatuses: choices('supportCases', 'status', [
		'NEW',
		'IN_PROGRESS',
		'WAITING_CUSTOMER',
		'HUMAN_REQUIRED',
		'RESOLVED',
		'CLOSED',
		'AUTOMATED',
		'INFORMATIONAL',
		'WAITING_INTERNAL',
	]),
	getConversationTags: choices('supportCases', 'tags', [
		'URGENT',
		'REPEAT',
		'VIP',
		'ESCALATED',
		'FOLLOWUP',
	]),
	getResolutions: choices('supportCases', 'resolution', [
		'PENDING',
		'SOLVED',
		'UNSOLVED',
		'NOT_APPLICABLE',
	]),
	getAutomations: choices('supportCases', 'automation', ['PENDING', 'FULL', 'PARTIAL', 'NONE']),
	getTechnicalStatuses: choices('supportCases', 'technicalStatus', [
		'UNKNOWN',
		'PENDING',
		'SUCCESS',
		'RETRYING',
		'ERROR',
	]),
	getFollowUps: choices('supportCases', 'followUp', [
		'NONE',
		'REQUIRED',
		'SCHEDULED',
		'WAITING_RESPONSE',
		'IN_PROGRESS',
		'COMPLETED',
		'CANCELLED',
	]),
	getDeliveryStatuses: choices('supportMessages', 'deliveryStatus', [
		'RECEIVED',
		'PENDING',
		'SENT',
		'DELIVERED',
		'FAILED',
	]),
	getSenders: choices('supportMessages', 'senderType', ['CUSTOMER', 'AGENT', 'BOT']),
};
