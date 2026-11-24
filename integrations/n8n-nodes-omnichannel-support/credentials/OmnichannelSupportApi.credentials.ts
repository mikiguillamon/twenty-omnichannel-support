import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class OmnichannelSupportApi implements ICredentialType {
	name = 'omnichannelSupportApi';
	displayName = 'Omnichannel Support API';
	documentationUrl =
		'https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/INTEGRACION_N8N.md';
	icon = 'file:../nodes/OmnichannelSupport/omnichannel.svg' as const;
	properties: INodeProperties[] = [
		{
			displayName: 'Twenty Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://twenty.example.com',
			required: true,
			description: 'Workspace URL, without /rest or /s',
		},
		{
			displayName: 'Twenty API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Functions Base URL',
			name: 'functionsUrl',
			type: 'string',
			default: '',
			placeholder: 'https://functions.example.com/omnichannel/v1',
			description:
				'Override the full Omnichannel API base URL for a separate Twenty functions domain',
		},
		{
			displayName: 'Integration Key',
			name: 'integrationSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'OMNICHANNEL_N8N_PROPOSAL_SECRET from Twenty. Required to propose replies or append messages.',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/rest/supportChannels',
			qs: { limit: 1 },
			disableFollowRedirect: true,
		},
	};
}
