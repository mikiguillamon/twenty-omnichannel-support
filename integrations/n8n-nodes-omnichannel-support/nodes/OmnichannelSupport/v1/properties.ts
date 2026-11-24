import type { INodeProperties } from 'n8n-workflow';

const show = (...operation: string[]) => ({ show: { operation } });
const text = (displayName: string, name: string, description?: string): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	default: '',
	...(description ? { description } : {}),
});

export const properties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Append Message', value: 'append', action: 'Append a message to a conversation' },
			{ name: 'Propose Reply', value: 'propose', action: 'Propose a reply for human review' },
			{
				name: 'Register Incoming Message',
				value: 'receive',
				action: 'Register an incoming message',
			},
			{
				name: 'Update Delivery Status',
				value: 'updateDelivery',
				action: 'Update the delivery status',
			},
		],
		default: 'receive',
	},
	{
		...text('Channel Code', 'channelCode', 'Code of the support channel configured in Twenty'),
		displayOptions: show('receive', 'updateDelivery'),
		required: true,
	},
	{
		displayName: 'Channel Type',
		name: 'channelType',
		type: 'options',
		displayOptions: show('receive'),
		options: [
			{ name: 'Email', value: 'EMAIL' },
			{ name: 'Instagram', value: 'INSTAGRAM' },
			{ name: 'Phone', value: 'PHONE' },
			{ name: 'Telegram', value: 'TELEGRAM' },
			{ name: 'WhatsApp', value: 'WHATSAPP' },
		],
		default: 'EMAIL',
	},
	{
		...text('Conversation ID', 'caseId', 'The caseId returned by Omnichannel Support'),
		displayOptions: show('append'),
		required: true,
	},
	{
		...text(
			'Incoming Message ID',
			'messageId',
			'The messageId returned by Omnichannel Support when it registered the incoming message',
		),
		displayOptions: show('propose'),
		required: true,
	},
	{
		displayName: 'ID Source',
		name: 'idSource',
		type: 'options',
		displayOptions: show('receive', 'append'),
		options: [
			{ name: 'Idempotency Key', value: 'idempotencyKey' },
			{ name: 'Provider Message ID', value: 'externalId' },
		],
		default: 'externalId',
	},
	{
		...text('Message Identifier', 'messageKey', 'Reuse this ID when retrying the same message'),
		displayOptions: show('receive', 'append', 'updateDelivery'),
		required: true,
	},
	{
		displayName: 'Direction',
		name: 'direction',
		type: 'options',
		displayOptions: show('append'),
		options: [
			{ name: 'Incoming', value: 'INBOUND' },
			{ name: 'Outgoing', value: 'OUTBOUND' },
		],
		default: 'OUTBOUND',
	},
	{
		...text('Message Text', 'body'),
		typeOptions: { rows: 4 },
		displayOptions: show('receive', 'append'),
	},
	{
		...text('Proposed Reply', 'replyText'),
		typeOptions: { rows: 4 },
		displayOptions: show('propose'),
		required: true,
	},
	{
		...text('Wait URL', 'callbackUrl', 'Resume URL from the Wait node in this execution'),
		displayOptions: show('propose'),
		default: '={{ $execution.resumeUrl }}',
		required: true,
	},
	{
		displayName: 'Delivery Status',
		name: 'deliveryStatus',
		type: 'options',
		displayOptions: show('updateDelivery'),
		options: [
			{ name: 'Delivered', value: 'DELIVERED' },
			{ name: 'Failed', value: 'FAILED' },
			{ name: 'Sent', value: 'SENT' },
		],
		default: 'DELIVERED',
	},
	{
		displayName: 'Provider Settings',
		name: 'scopeFields',
		type: 'collection',
		displayOptions: show('receive', 'append', 'updateDelivery'),
		placeholder: 'Add Setting',
		default: {},
		options: [
			text('Account ID', 'accountId', 'Only needed when the support channel has no account set'),
			text('Provider', 'provider', 'Only needed when the support channel has no provider set'),
		],
	},
	{
		displayName: 'Incoming Message Fields',
		name: 'receivedFields',
		type: 'collection',
		displayOptions: show('receive'),
		placeholder: 'Add Field',
		default: {},
		options: [
			text('Contact Email', 'email'),
			text('Contact Name', 'name'),
			text('Contact Phone', 'phone'),
			text('External User ID', 'externalUserId'),
			text('Issue Key', 'issueKey'),
			text('Reply to Provider Message ID', 'replyToExternalId'),
			text('Thread ID', 'threadId'),
			text('WhatsApp Alternate JID', 'remoteJidAlt'),
			text('WhatsApp JID', 'remoteJid'),
		],
	},
	{
		displayName: 'Message Details',
		name: 'messageFields',
		type: 'collection',
		displayOptions: show('receive', 'append'),
		placeholder: 'Add Detail',
		default: {},
		options: [
			text('From Address', 'fromAddress'),
			text('Occurred At', 'occurredAt', 'Message timestamp in ISO 8601 format'),
			{
				displayName: 'Sender Type',
				name: 'senderType',
				type: 'options',
				options: [
					{ name: 'Agent', value: 'AGENT' },
					{ name: 'Bot', value: 'BOT' },
					{ name: 'Customer', value: 'CUSTOMER' },
				],
				default: 'AGENT',
			},
			text('Subject', 'subject'),
			text('To Address', 'toAddress'),
		],
	},
];
