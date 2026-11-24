import {
	NodeConnectionTypes,
	NodeOperationError,
	UserError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type INodeTypeBaseDescription,
} from 'n8n-workflow';
import { properties } from './properties';

const credentialName = 'omnichannelSupportApi';
const apiPath = '/s/omnichannel/v1';

function httpsBaseUrl(value: unknown, field: string): string {
	const url = URL.parse(String(value).trim());
	if (url?.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
		throw new UserError(`Enter a valid HTTPS URL in the ${field} credential field`);
	}
	return url.href.replace(/\/+$/, '');
}

function requestFields(context: IExecuteFunctions, operation: string, itemIndex: number) {
	const param = (name: string, fallback = '') =>
		String(context.getNodeParameter(name, itemIndex, fallback));
	if (operation === 'propose') {
		return {
			path: '/proposals/create',
			body: {
				messageId: param('messageId').trim(),
				body: param('replyText'),
				callbackUrl: param('callbackUrl').trim(),
			},
		};
	}
	const messageKey = param('messageKey').trim();
	if (!messageKey) throw new UserError('Enter a stable message identifier');
	const { provider, accountId } = context.getNodeParameter(
		'scopeFields',
		itemIndex,
		{},
	) as IDataObject;
	const scope = { ...(provider && { provider }), ...(accountId && { accountId }) };

	if (operation === 'updateDelivery') {
		return {
			path: '/ingest',
			body: {
				eventType: 'message.status',
				channelCode: param('channelCode').trim(),
				...scope,
				message: { externalId: messageKey, deliveryStatus: param('deliveryStatus', 'DELIVERED') },
			},
		};
	}
	const idSource = param('idSource', 'externalId');
	if (idSource !== 'externalId' && idSource !== 'idempotencyKey')
		throw new UserError('Select an ID source');
	const details = context.getNodeParameter('messageFields', itemIndex, {}) as IDataObject;
	const message = { ...details, [idSource]: messageKey, body: param('body') };
	if (operation === 'append') {
		return {
			path: '/messages/append',
			body: {
				caseId: param('caseId').trim(),
				...scope,
				message: { ...message, direction: param('direction', 'OUTBOUND') },
			},
		};
	}
	if (operation === 'receive') {
		const { threadId, issueKey, replyToExternalId, ...contact } = context.getNodeParameter(
			'receivedFields',
			itemIndex,
			{},
		) as IDataObject;
		return {
			path: '/ingest',
			body: {
				eventType: 'message.received',
				channelCode: param('channelCode').trim(),
				channelType: param('channelType', 'EMAIL'),
				...scope,
				contact,
				message: {
					...message,
					...(threadId && { threadId }),
					...(issueKey && { issueKey }),
					...(replyToExternalId && { replyToExternalId }),
				},
			},
		};
	}
	throw new UserError('Select a supported Omnichannel operation');
}

export class OmnichannelSupportV1 implements INodeType {
	description: INodeTypeDescription;
	constructor(base: INodeTypeBaseDescription) {
		this.description = {
			...base,
			version: 1,
			subtitle: '={{$parameter["operation"]}}',
			description: 'Register messages, propose replies and update delivery in Twenty CRM',
			defaults: { name: 'Omnichannel Support' },
			inputs: [NodeConnectionTypes.Main],
			outputs: [NodeConnectionTypes.Main],
			credentials: [{ name: credentialName, required: true }],
			properties,
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		if (!items.length) return [[]];
		const operation = String(this.getNodeParameter('operation', 0));
		if (operation === 'propose' && items.length !== 1) {
			throw new NodeOperationError(
				this.getNode(),
				'Propose Reply requires one item per execution of Wait',
			);
		}
		const credentials = await this.getCredentials(credentialName);
		const functionsUrl = String(credentials.functionsUrl ?? '').trim();
		const baseUrl = functionsUrl
			? httpsBaseUrl(functionsUrl, 'Functions Base URL')
			: httpsBaseUrl(credentials.baseUrl, 'Twenty Base URL') + apiPath;
		const integrationKey = String(credentials.integrationSecret ?? '');
		const requiresIntegrationKey = operation === 'propose' || operation === 'append';
		if (requiresIntegrationKey && !integrationKey.trim()) {
			throw new NodeOperationError(
				this.getNode(),
				'Add the Integration Key to the Omnichannel Support credential',
			);
		}
		const output: INodeExecutionData[] = [];
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const pairedItem = { item: itemIndex };
			try {
				const { path, body } = requestFields(this, operation, itemIndex);
				const response = await this.helpers.httpRequestWithAuthentication
					.call(this, credentialName, {
						url: baseUrl + path,
						method: 'POST',
						headers: requiresIntegrationKey ? { 'X-Omnichannel-Proposal-Key': integrationKey } : {},
						body,
						json: true,
						returnFullResponse: true,
						ignoreHttpStatusErrors: true,
						disableFollowRedirect: true,
						timeout: 35_000,
					})
					.catch(() => {
						throw new UserError('Could not reach the Omnichannel API at the configured Twenty URL');
					});
				const responseBody = response.body;
				if (response.statusCode < 200 || response.statusCode >= 300 || responseBody?.ok !== true) {
					const code = responseBody?.error?.code;
					const safeCode =
						typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,80}$/.test(code) ? ' · ' + code : '';
					throw new UserError(`Omnichannel API returned HTTP ${response.statusCode}${safeCode}`);
				}
				output.push({ json: responseBody as IDataObject, pairedItem });
			} catch (error) {
				const message =
					error instanceof UserError
						? error.message
						: 'Could not prepare the Omnichannel operation';
				if (!this.continueOnFail())
					throw new NodeOperationError(this.getNode(), message, { itemIndex });
				output.push({ json: { error: message }, pairedItem });
			}
		}
		return [output];
	}
}
