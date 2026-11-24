import {
	UserError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeProperties,
} from 'n8n-workflow';

const showMessage = (...operation: string[]) => ({ show: { resource: ['message'], operation } });
const showSearch = { show: { resource: ['faq'], operation: ['searchFaq'] } };
const text = (displayName: string, name: string, description?: string): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	default: '',
	...(description && { description }),
});
const multiline = (displayName: string, name: string, description?: string): INodeProperties => ({
	...text(displayName, name, description),
	typeOptions: { rows: 4 },
});
function loaded(
	displayName: string,
	name: string,
	method: string,
	multiple = false,
): INodeProperties {
	return {
		displayName,
		name,
		type: multiple ? 'multiOptions' : 'options',
		default: multiple ? [] : '',
		typeOptions: { loadOptionsMethod: method },
		description:
			'Choose from the list, or specify a value using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	};
}
function collection(
	displayName: string,
	name: string,
	options: INodeProperties[],
	displayOptions: INodeProperties['displayOptions'],
): INodeProperties {
	return {
		displayName,
		name,
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions,
		options: [...options].sort((a, b) => a.displayName.localeCompare(b.displayName, 'en')),
	};
}

const contactFields: INodeProperties[] = [
	{
		displayName: 'Create Person From Chat Name',
		name: 'createPersonFromChat',
		type: 'boolean',
		default: true,
		description:
			'Whether to create a Person for an unlinked chat identity when First Name or Last Name is provided',
	},
	text('Email', 'email'),
	text(
		'External User ID',
		'externalId',
		'Verified provider identifier when different from the contact field',
	),
	text('First Name', 'firstName'),
	text('Last Name', 'lastName'),
	text('Display Name', 'name'),
	text('Person ID', 'personId', 'Twenty Person UUID obtained from a verified association'),
	text('Phone', 'phone'),
	{
		displayName: 'Verified Contact',
		name: 'verified',
		type: 'boolean',
		default: false,
		description: 'Whether your workflow verified the association with the supplied person or email',
	},
	text(
		'WhatsApp Alternate JID',
		'remoteJidAlt',
		'Alternate PN or LID observed in the same provider event',
	),
];
const commonMessageFields: INodeProperties[] = [
	text(
		'Call Recording URL',
		'callRecordingUrl',
		'HTTPS link to a recording without embedded credentials',
	),
	multiline('Call Transcription', 'callTranscription'),
	text('From Address', 'fromAddress'),
	{
		displayName: 'ID Source',
		name: 'idSource',
		type: 'options',
		default: 'externalId',
		description: 'How to use the Message Identifier when recording this event',
		options: [
			{ name: 'Idempotency Key', value: 'idempotencyKey' },
			{ name: 'Provider Message ID', value: 'externalId' },
		],
	},
	{ displayName: 'Occurred At', name: 'occurredAt', type: 'dateTime', default: '' },
	loaded('Sender Type Name or ID', 'senderType', 'getSenders'),
	text('Subject', 'subject'),
	text('To Address', 'toAddress'),
];
const replyTo = text('Reply to Provider Message ID', 'replyToExternalId');
const appendMessageFields = [...commonMessageFields, replyTo];
const ingestMessageFields = [
	...commonMessageFields,
	loaded('Delivery Status Name or ID', 'deliveryStatus', 'getDeliveryStatuses'),
	multiline('HTML Body', 'html', 'Used when the message text is empty'),
	text('Provider Addressing Mode', 'providerAddressingMode'),
	text('Provider Chat ID', 'providerChatId'),
	text('Provider Chat ID Alternative', 'providerChatIdAlt'),
];
const routingFields: INodeProperties[] = [
	text('Conversation ID', 'caseId', 'Twenty caseId of the conversation'),
	text('Issue Key', 'issueKey'),
	replyTo,
	text(
		'Thread ID',
		'threadId',
		'Provider thread ID, for example a Gmail thread or Microsoft conversation ID. An unreferenced email uses its provider message ID as the first message of a thread.',
	),
	{
		displayName: 'Routing Mode',
		name: 'routingMode',
		type: 'options',
		default: 'CHAT',
		options: [
			{
				name: 'Automatic',
				value: 'CHAT',
				description: 'Use the contact’s current social chat or the provider thread for email',
			},
			{
				name: 'Channel Policy',
				value: 'CHANNEL',
				description: 'Use the grouping and status settings configured in Twenty',
			},
		],
	},
];
const scopeFields = [
	text('Account ID', 'accountId', 'Use when the account is missing from the configured channel'),
	text('Provider', 'provider', 'Use when the provider is missing from the configured channel'),
];
const telegramChatIdField = text(
	'Telegram Chat ID',
	'telegramChatId',
	'Private chat ID when using a numeric Telegram message ID',
);
const receiptScopeFields = [...scopeFields, telegramChatIdField];
const nullableFields = [
	['Assigned To', 'assignedTo'],
	['Category', 'categoryId'],
	['Comments', 'comments'],
	['Custom Tags', 'customTags'],
	['Follow Up', 'followUp'],
	['Follow Up At', 'followUpAt'],
	['Language', 'language'],
	['Recording URL', 'recordingUrl'],
	['Subject', 'subject'],
	['Summary', 'summary'],
	['Tags', 'tags'],
	['Transcription', 'transcription'],
	['Type', 'typeId'],
];
const conversationFields: INodeProperties[] = [
	multiline(
		'Additional Custom Tags',
		'additionalCustomTags',
		'Comma- or newline-separated tags, or a string array from an expression. Selected and additional tags together replace the current custom tags.',
	),
	text('Assigned To', 'assignedTo'),
	loaded('Automation Name or ID', 'automation', 'getAutomations'),
	text(
		'Category Code',
		'categoryCode',
		'An existing or new category code. Use either a category code or a category ID.',
	),
	loaded('Category Name or ID', 'categoryId', 'getCategories'),
	{
		displayName: 'Clear Fields',
		name: 'clearFields',
		type: 'multiOptions',
		default: [],
		options: nullableFields.map(([name, value]) => ({ name, value })),
		description: 'Clear these values in the conversation when recording a new message',
	},
	multiline('Comments', 'comments'),
	loaded('Custom Tag Names or IDs', 'customTags', 'getCustomTags', true),
	{ displayName: 'Follow Up At', name: 'followUpAt', type: 'dateTime', default: '' },
	loaded('Follow Up Name or ID', 'followUp', 'getFollowUps'),
	text('Language', 'language', 'BCP 47 language tag, for example es or en-US'),
	text('Recording URL', 'recordingUrl'),
	loaded('Resolution Name or ID', 'resolution', 'getResolutions'),
	loaded('Status Name or ID', 'status', 'getConversationStatuses'),
	text('Subject', 'subject'),
	multiline('Summary', 'summary'),
	loaded('Tag Names or IDs', 'tags', 'getConversationTags', true),
	loaded('Technical Status Name or ID', 'technicalStatus', 'getTechnicalStatuses'),
	multiline('Transcription', 'transcription'),
	text(
		'Type Code',
		'typeCode',
		'An existing or new conversation type code. Use either a type code or a type ID.',
	),
	loaded('Type Name or ID', 'typeId', 'getTypes'),
];
const searchFields: INodeProperties[] = [
	multiline(
		'Additional Scope Tags',
		'additionalScopeTags',
		'Comma- or newline-separated scopes, or a string array from an expression',
	),
	{
		displayName: 'Language',
		name: 'language',
		type: 'options',
		default: 'auto',
		options: [
			{ name: 'Automatic', value: 'auto' },
			{ name: 'Catalan', value: 'CA' },
			{ name: 'English', value: 'EN' },
			{ name: 'Spanish', value: 'ES' },
		],
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-limit -- FAQ search accepts at most ten results and defaults to five.
		default: 5,
		typeOptions: { minValue: 1, maxValue: 10 },
		description: 'Max number of results to return',
	},
	loaded('Scope Tag Names or IDs', 'scopeTags', 'getFaqScopes', true),
];
const proposalControls = (displayOptions: INodeProperties['displayOptions']): INodeProperties[] => [
	{ ...multiline('Proposed Reply', 'replyText'), displayOptions, required: true },
	{
		...text('Wait URL', 'callbackUrl', 'Resume URL of the Wait node in this execution'),
		default: '={{ $execution.resumeUrl }}',
		displayOptions,
		required: true,
	},
];

export const messageProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'receive',
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{ name: 'Append Message', value: 'append', action: 'Append a message to a conversation' },
			{ name: 'Propose Reply', value: 'propose', action: 'Propose a reply for human review' },
			{
				name: 'Register Incoming Message',
				value: 'receive',
				action: 'Register an incoming message',
			},
			{ name: 'Register Outgoing Message', value: 'send', action: 'Register an outgoing message' },
			{
				name: 'Update Delivery Status',
				value: 'updateDelivery',
				action: 'Update the delivery status',
			},
		],
	},
	{
		...loaded('Channel Name or ID', 'channelCode', 'getChannels'),
		required: true,
		displayOptions: showMessage('receive', 'send', 'updateDelivery'),
		description: 'Choose a workspace channel, or enter its code using an expression',
	},
	{
		...text(
			'Contact or Chat ID',
			'contactIdentifier',
			'Email address, WhatsApp E.164 number, Meta wa_id or Baileys PN/LID, Instagram or Telegram ID, or caller number',
		),
		required: true,
		displayOptions: showMessage('receive', 'send'),
	},
	{
		...text('Conversation ID', 'caseId', 'The caseId returned by Omnichannel Support'),
		required: true,
		displayOptions: showMessage('append'),
	},
	{
		...text(
			'Message Identifier',
			'messageKey',
			'Stable provider message ID. To use a retry key, set Message Fields → ID Source to Idempotency Key.',
		),
		required: true,
		displayOptions: showMessage('receive', 'send', 'append'),
	},
	{
		...text('Provider Message ID', 'messageKey', 'The original provider ID of the message'),
		required: true,
		displayOptions: showMessage('updateDelivery'),
	},
	{
		displayName: 'Direction',
		name: 'direction',
		type: 'options',
		default: 'OUTBOUND',
		displayOptions: showMessage('append'),
		options: [
			{ name: 'Incoming', value: 'INBOUND' },
			{ name: 'Outgoing', value: 'OUTBOUND' },
		],
	},
	{
		...multiline('Message Text', 'body'),
		displayOptions: showMessage('receive', 'send', 'append'),
	},
	{
		...loaded('Delivery Status Name or ID', 'deliveryStatus', 'getDeliveryStatuses'),
		default: 'DELIVERED',
		required: true,
		displayOptions: showMessage('updateDelivery'),
	},
	{
		...text(
			'Incoming Message ID',
			'messageId',
			'The Twenty messageId returned when registering the incoming message',
		),
		required: true,
		displayOptions: showMessage('propose'),
	},
	{
		displayName: 'Include Proposed Reply',
		name: 'includeProposal',
		type: 'boolean',
		default: false,
		displayOptions: showMessage('receive'),
		description: 'Whether to attach a draft for human review using one item per Wait execution',
	},
	...proposalControls({
		show: { resource: ['message'], operation: ['receive'], includeProposal: [true] },
	}),
	...proposalControls(showMessage('propose')),
	collection('Contact Fields', 'contactFields', contactFields, showMessage('receive', 'send')),
	collection(
		'Conversation Fields',
		'conversationFields',
		conversationFields,
		showMessage('receive', 'send'),
	),
	collection(
		'Message Fields',
		'messageFields',
		ingestMessageFields,
		showMessage('receive', 'send'),
	),
	collection('Message Fields', 'messageFields', appendMessageFields, showMessage('append')),
	collection('Provider Settings', 'scopeFields', scopeFields, showMessage('receive', 'send')),
	collection(
		'Provider Settings',
		'scopeFields',
		receiptScopeFields,
		showMessage('append', 'updateDelivery'),
	),
	collection('Routing Fields', 'routingFields', routingFields, showMessage('receive', 'send')),
	{
		...text('Query', 'query', 'Question to search for in published FAQs'),
		required: true,
		displayOptions: showSearch,
	},
	collection('Search Options', 'searchFields', searchFields, showSearch),
];

function fieldValues(raw: IDataObject, fields: INodeProperties[]): IDataObject {
	const selected: IDataObject = {};
	for (const { name } of fields) {
		if (Object.hasOwn(raw, name) && raw[name] !== undefined && raw[name] !== '') {
			selected[name] = raw[name];
		}
	}
	return selected;
}

function list(value: unknown): string[] {
	if (value === undefined || value === null) return [];
	const items = typeof value === 'string' ? value.split(/[,\r\n]/) : value;
	if (!Array.isArray(items) || items.some((item) => typeof item !== 'string')) {
		throw new UserError('Enter a list of text values');
	}
	return [...new Set((items as string[]).map((item) => item.trim()).filter(Boolean))];
}

function combineTags(fields: IDataObject, selected: string, manual: string): void {
	if (Object.hasOwn(fields, selected) || Object.hasOwn(fields, manual)) {
		fields[selected] = [...new Set([...list(fields[selected]), ...list(fields[manual])])];
	}
	delete fields[manual];
}

function conversationPatch(patch: IDataObject): IDataObject {
	combineTags(patch, 'customTags', 'additionalCustomTags');
	if (Object.hasOwn(patch, 'tags')) patch.tags = list(patch.tags);
	const clearFields = list(patch.clearFields);
	delete patch.clearFields;
	for (const name of clearFields) {
		if (!nullableFields.some(([, key]) => key === name))
			throw new UserError('Select a clearable conversation field');
		if (Object.hasOwn(patch, name))
			throw new UserError('Choose either a value or Clear Fields for the same conversation field');
		patch[name] = name === 'tags' || name === 'customTags' ? [] : null;
	}
	for (const field of ['category', 'type']) {
		if (Object.hasOwn(patch, field + 'Id') && Object.hasOwn(patch, field + 'Code')) {
			throw new UserError('Use the ' + field + ' ID or its code, not both');
		}
	}
	return patch;
}

const phoneDigits = /^\+?([1-9]\d{7,14})$/;
const personalJid = /^\d+(?::\d+)?@(?:s\.whatsapp\.net|lid)$/i;

function contactFor(channelType: string, identifier: string, fields: IDataObject): IDataObject {
	switch (channelType) {
		case 'EMAIL':
			return { ...fields, email: identifier };
		case 'WHATSAPP': {
			const digits = phoneDigits.exec(identifier)?.[1];
			const remoteJid = digits ? digits + '@s.whatsapp.net' : identifier;
			if (
				!personalJid.test(remoteJid) ||
				(fields.remoteJidAlt && !personalJid.test(String(fields.remoteJidAlt)))
			) {
				throw new UserError(
					'Use an E.164 number, a Meta wa_id or an individual WhatsApp PN or LID JID',
				);
			}
			// Keep the observed JID on the message. The stable identity excludes any device suffix.
			// An optional phone attribute by itself never selects this contact's identity.
			const externalId = remoteJid.replace(/:\d+(?=@)/, '').toLowerCase();
			return { externalId, ...fields, ...(digits && { phone: '+' + digits }), remoteJid };
		}
		case 'PHONE':
			return {
				...(phoneDigits.test(identifier) && { phone: identifier }),
				externalId: identifier,
				...fields,
			};
		case 'INSTAGRAM':
		case 'TELEGRAM':
			return { ...fields, externalId: identifier };
		default:
			throw new UserError('Select a configured support channel with a supported channel type');
	}
}

function telegramMessageKey(chatId: string, messageId: string): string {
	return chatId && /^\d+$/.test(messageId) ? chatId + '/' + messageId : messageId;
}

export function buildMessageRequest(
	context: IExecuteFunctions,
	operation: string,
	index: number,
	channelType?: string,
): { path: string; body: IDataObject; protected?: boolean } {
	const param = (name: string, fallback = '') =>
		String(context.getNodeParameter(name, index, fallback) ?? '');
	const required = (name: string, label: string) => {
		const value = param(name);
		if (!value.trim()) throw new UserError('Enter a ' + label);
		return value;
	};
	const fields = (name: string, allowed: INodeProperties[]) =>
		fieldValues(context.getNodeParameter(name, index, {}) as IDataObject, allowed);
	const proposal = () => ({
		body: required('replyText', 'proposed reply'),
		callbackUrl: required('callbackUrl', 'Wait URL').trim(),
	});

	if (operation === 'searchFaq') {
		const options = fields('searchFields', searchFields);
		combineTags(options, 'scopeTags', 'additionalScopeTags');
		return { path: '/faqs/search', body: { query: required('query', 'search query'), ...options } };
	}
	if (operation === 'propose') {
		return {
			path: '/proposals/create',
			protected: true,
			body: {
				messageId: required('messageId', 'Twenty incoming message ID').trim(),
				...proposal(),
			},
		};
	}
	const messageKey = required('messageKey', 'stable message identifier').trim();
	const { telegramChatId, ...scope } = fields('scopeFields', receiptScopeFields);
	const receiptChat = String(telegramChatId ?? '').trim();
	if (receiptChat && !/^[1-9]\d*$/.test(receiptChat))
		throw new UserError('Enter a private Telegram chat ID');

	if (operation === 'updateDelivery') {
		return {
			path: '/ingest',
			body: {
				eventType: 'message.status',
				channelCode: required('channelCode', 'channel').trim(),
				...scope,
				message: {
					externalId: telegramMessageKey(receiptChat, messageKey),
					deliveryStatus: param('deliveryStatus', 'DELIVERED'),
				},
			},
		};
	}
	const { idSource = 'externalId', ...details } = fields(
		'messageFields',
		operation === 'append' ? appendMessageFields : ingestMessageFields,
	);
	if (idSource !== 'externalId' && idSource !== 'idempotencyKey')
		throw new UserError('Select an ID source for the message identifier');
	const message: IDataObject = { ...details, [idSource]: messageKey, body: param('body') };
	if (operation === 'append') {
		if (idSource === 'externalId') message.externalId = telegramMessageKey(receiptChat, messageKey);
		if (typeof message.replyToExternalId === 'string')
			message.replyToExternalId = telegramMessageKey(receiptChat, message.replyToExternalId);
		return {
			path: '/messages/append',
			protected: true,
			body: {
				caseId: required('caseId', 'Twenty conversation ID').trim(),
				...scope,
				message: { ...message, direction: param('direction', 'OUTBOUND') },
			},
		};
	}
	if (operation !== 'receive' && operation !== 'send')
		throw new UserError('Select a supported message operation');
	const type = channelType ?? '';
	const { createPersonFromChat = true, ...contactDetails } = fields('contactFields', contactFields);
	const contact = contactFor(
		type,
		required('contactIdentifier', 'contact or chat ID').trim(),
		contactDetails,
	);
	if (type === 'WHATSAPP') {
		message.providerChatId ??= contact.remoteJid;
		if (contact.remoteJidAlt) message.providerChatIdAlt ??= contact.remoteJidAlt;
	}
	const { routingMode = 'CHAT', ...references } = fields('routingFields', routingFields);
	const chat = routingMode === 'CHAT' && ['WHATSAPP', 'TELEGRAM', 'INSTAGRAM'].includes(type);
	if (
		type === 'EMAIL' &&
		routingMode === 'CHAT' &&
		idSource === 'externalId' &&
		!Object.values(references).some((value) => typeof value === 'string' && value.trim())
	) {
		references.threadId = messageKey;
	}
	const namedChat =
		chat &&
		createPersonFromChat === true &&
		[contact.firstName, contact.lastName].some((name) => typeof name === 'string' && name.trim());
	if (chat && type === 'TELEGRAM') {
		const chatId = String(contact.externalId);
		if (/^-\d+$/.test(chatId))
			throw new UserError('Select a private Telegram chat for Chat per Contact');
		if (idSource === 'externalId') message.externalId = telegramMessageKey(chatId, messageKey);
		if (typeof references.replyToExternalId === 'string')
			references.replyToExternalId = telegramMessageKey(chatId, references.replyToExternalId);
	}
	const incoming = operation === 'receive';
	const conversation = conversationPatch(fields('conversationFields', conversationFields));
	if (chat && incoming) conversation.status ??= 'IN_PROGRESS';
	const withProposal =
		incoming && context.getNodeParameter('includeProposal', index, false) === true;
	return {
		path: '/ingest',
		...(withProposal && { protected: true }),
		body: {
			eventType: incoming ? 'message.received' : 'message.sent',
			channelCode: required('channelCode', 'channel').trim(),
			channelType: type,
			...scope,
			...(chat && { routingMode: 'CHAT' }),
			...(namedChat && { createPersonFromChat: true }),
			contact,
			message: { ...message, ...references },
			...(Object.keys(conversation).length > 0 && { conversation }),
			...(withProposal && { proposedReply: proposal() }),
		},
	};
}
