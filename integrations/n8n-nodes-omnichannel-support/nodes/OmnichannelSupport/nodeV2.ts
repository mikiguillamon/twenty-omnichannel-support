import {
	NodeConnectionTypes,
	NodeOperationError,
	UserError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeProperties,
	type INodeType,
	type INodeTypeBaseDescription,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { catalogOptions, resolveChannel } from './catalogV2';
import { messageProperties, buildMessageRequest } from './messageV2';
import { recordProperties, recordResources, recordMethods, executeRecord } from './recordsV2';
import { credentialFingerprint, discoverFunctionsBase, functionRequest } from './transportV2';

const resource: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Message', value: 'message' },
		...recordResources,
		{ name: 'Connection', value: 'connection' },
	].sort((a, b) => a.name.localeCompare(b.name)),
	default: 'message',
};

export class OmnichannelSupportV2 implements INodeType {
	description: INodeTypeDescription;
	methods = {
		...recordMethods,
		loadOptions: { ...recordMethods.loadOptions, ...catalogOptions },
	};
	constructor(base: INodeTypeBaseDescription) {
		this.description = {
			...base,
			version: 2,
			defaults: { name: 'Omnichannel Support' },
			inputs: [NodeConnectionTypes.Main],
			outputs: [NodeConnectionTypes.Main],
			subtitle: '={{$parameter["resource"] + " · " + $parameter["operation"]}}',
			credentials: [{ name: 'twentyApi', required: true }],
			properties: [
				resource,
				...messageProperties,
				...recordProperties,
				{
					displayName: 'Operation',
					name: 'operation',
					type: 'options',
					noDataExpression: true,
					displayOptions: { show: { resource: ['connection'] } },
					options: [
						{
							name: 'Get Credential Fingerprint',
							value: 'fingerprint',
							action: 'Get credential fingerprint',
							description:
								'Copy this fingerprint into the Omnichannel app to enable proposals and appending by conversation ID',
						},
					],
					default: 'fingerprint',
				},
			],
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		if (!items.length) return [[]];
		const resourceName = String(this.getNodeParameter('resource', 0));
		const operation = String(this.getNodeParameter('operation', 0));
		if (
			resourceName === 'message' &&
			items.length > 1 &&
			(operation === 'propose' ||
				(operation === 'receive' &&
					items.some((_, i) => this.getNodeParameter('includeProposal', i, false) === true)))
		) {
			throw new NodeOperationError(
				this.getNode(),
				'Use one item per execution when proposing a reply with Wait',
			);
		}

		const channels = new Map<string, string>();
		let functionsBase: string | undefined;
		const output: INodeExecutionData[] = [];
		for (let index = 0; index < items.length; index++) {
			const pairedItem = { item: index };
			try {
				if (resourceName === 'connection' && operation === 'fingerprint') {
					output.push({ json: { fingerprint: await credentialFingerprint(this) }, pairedItem });
				} else if (
					resourceName === 'message' ||
					(resourceName === 'faq' && operation === 'searchFaq')
				) {
					let channelType: string | undefined;
					if (operation === 'receive' || operation === 'send') {
						const code = String(this.getNodeParameter('channelCode', index)).trim().toLowerCase();
						channelType = channels.get(code);
						if (!channelType) {
							channelType = await resolveChannel(this, code);
							channels.set(code, channelType);
						}
					}
					const request = buildMessageRequest(this, operation, index, channelType);
					const prefix = request.path === '/ingest' ? '/omnichannel/v2' : '/omnichannel/v1';
					functionsBase ??= await discoverFunctionsBase(this);
					const json = await functionRequest(this, functionsBase, prefix + request.path, {
						body: request.body,
						protected: request.protected,
					});
					const sentMessage = request.body.message as IDataObject | undefined;
					if (typeof sentMessage?.externalId === 'string')
						json.providerMessageIdentifier = sentMessage.externalId;
					output.push({ json, pairedItem });
				} else {
					const rows = await executeRecord(this, resourceName, operation, index);
					for (const json of rows) output.push({ json, pairedItem });
				}
			} catch (error) {
				const message =
					error instanceof UserError
						? error.message
						: 'Could not prepare the Omnichannel operation';
				if (!this.continueOnFail())
					throw new NodeOperationError(this.getNode(), message, { itemIndex: index });
				output.push({ json: { error: message }, pairedItem });
			}
		}
		return [output];
	}
}
