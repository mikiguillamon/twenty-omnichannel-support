import { createHash } from 'node:crypto';
import {
	UserError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type ILoadOptionsFunctions,
} from 'n8n-workflow';

export type TwentyContext = IExecuteFunctions | ILoadOptionsFunctions;
const credential = 'twentyApi';

function digest(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

async function integrationProof(context: TwentyContext) {
	const { apiKey } = await context.getCredentials(credential);
	if (typeof apiKey !== 'string' || !apiKey.trim())
		throw new UserError('Select a Twenty API credential with an API key');
	return 'twenty-v2.' + digest('omnichannel-support:n8n:v2\0' + apiKey);
}

export async function credentialFingerprint(context: TwentyContext) {
	return digest(await integrationProof(context));
}

function workspaceRoot(raw: unknown) {
	const url = URL.parse(String(raw ?? '').trim());
	if (url?.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
		throw new UserError('Enter a valid HTTPS workspace URL in your Twenty API credential');
	}
	return url.href.replace(/\/+$/, '').replace(/\/(?:rest\/metadata|graphql|metadata|rest)$/, '');
}

interface RequestOptions {
	body?: IDataObject;
	qs?: IDataObject;
	protected?: boolean;
}

export async function twentyRequest(
	context: TwentyContext,
	method: IHttpRequestMethods,
	path: string,
	options: RequestOptions = {},
): Promise<IDataObject> {
	const { baseUrl } = await context.getCredentials(credential);
	return request(context, workspaceRoot(baseUrl), method, path, options);
}

export async function discoverFunctionsBase(context: TwentyContext): Promise<string> {
	const config = await twentyRequest(context, 'GET', '/client-config');
	const domain = config.publicFunctionDomain;
	if (!domain) {
		const { baseUrl } = await context.getCredentials(credential);
		return workspaceRoot(baseUrl) + '/s';
	}
	const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
	if (
		typeof domain !== 'string' ||
		domain.length > 253 ||
		!domain.split('.').every((label) => dnsLabel.test(label))
	) {
		throw new UserError('Twenty returned an invalid public function domain');
	}
	const result = await twentyRequest(context, 'POST', '/metadata', {
		body: { query: 'query OmnichannelWorkspace { currentWorkspace { subdomain } }' },
	});
	const workspace = (result.data as IDataObject | undefined)?.currentWorkspace as
		| IDataObject
		| undefined;
	if (
		result.errors ||
		typeof workspace?.subdomain !== 'string' ||
		!dnsLabel.test(workspace.subdomain)
	) {
		throw new UserError('Could not resolve the functions hostname for this Twenty workspace');
	}
	return 'https://' + workspace.subdomain + '.' + domain;
}

export async function functionRequest(
	context: TwentyContext,
	base: string,
	path: string,
	options: RequestOptions,
) {
	return request(context, base, 'POST', path, options);
}

async function request(
	context: TwentyContext,
	base: string,
	method: IHttpRequestMethods,
	path: string,
	options: RequestOptions,
): Promise<IDataObject> {
	const headers: IDataObject = options.protected
		? { 'X-Omnichannel-Proposal-Key': await integrationProof(context) }
		: {};
	const response = await context.helpers.httpRequestWithAuthentication
		.call(context, credential, {
			url: base + path,
			method,
			headers,
			body: options.body,
			qs: options.qs,
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
			disableFollowRedirect: true,
			timeout: 35_000,
		})
		.catch(() => {
			throw new UserError('Could not reach Twenty using the selected credential');
		});
	const result = response.body;
	const functionPath = path.startsWith('/omnichannel/');
	if (
		response.statusCode < 200 ||
		response.statusCode >= 300 ||
		(functionPath && result?.ok !== true)
	) {
		const code = result?.error?.code;
		const safeCode =
			typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,80}$/.test(code) ? ' · ' + code : '';
		const hint =
			code === 'N8N_PROPOSAL_KEY_FORBIDDEN' || code === 'N8N_PROPOSAL_KEY_NOT_CONFIGURED'
				? '. Pair this credential using Connection → Get Credential Fingerprint'
				: response.statusCode === 404 && path === '/omnichannel/v2/ingest' && !code
					? '. Install Omnichannel Support 1.4.0 or later in this Twenty workspace'
					: '';
		throw new UserError(`Twenty returned HTTP ${response.statusCode}${safeCode}${hint}`);
	}
	if ((result === undefined || result === null || result === '') && response.statusCode === 204)
		return {};
	if (!result || typeof result !== 'object' || Array.isArray(result)) {
		throw new UserError('Twenty returned an unexpected response');
	}
	return result as IDataObject;
}
