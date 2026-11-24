import { RestApiClient } from 'twenty-client-sdk/rest';
import { isRecordId } from './contract.ts';
import { type DbRecord, type Filter, type IngestionStore } from './processor.ts';

type ApiResponse = { data?: Record<string, unknown> };
const OBJECTS: Record<string, string> = {
  people: 'person',
  supportChannels: 'supportChannel',
  supportExternalIdentities: 'supportExternalIdentity',
  supportIdentityAliases: 'supportIdentityAlias',
  supportCases: 'supportCase',
  supportCategories: 'supportCategory',
  supportTypes: 'supportType',
  supportMessages: 'supportMessage',
  supportSettings: 'supportSetting',
};
const singular = (resource: string): string => {
  const name = OBJECTS[resource];
  if (!name) throw new Error('Unsupported CRM resource');
  return name;
};

function responseObject(response: ApiResponse, resource: string, operation: 'create' | 'update' | 'get'): DbRecord {
  const name = singular(resource);
  const expected = operation === 'get' ? name : operation + name[0].toUpperCase() + name.slice(1);
  const envelope = response?.data;
  const record = envelope?.[expected] ?? envelope?.[name] ?? envelope?.[resource] ??
    (envelope?.id ? envelope : null);
  if (!record || Array.isArray(record) || typeof record !== 'object' || typeof (record as DbRecord).id !== 'string') {
    throw new Error('Twenty REST returned an unexpected ' + operation + ' response for ' + resource);
  }
  return record as DbRecord;
}

export function serializeFilter(fields: Filter): string {
  const items = Object.entries(fields).map(([field, value]) => {
    if (!/^[A-Za-z][A-Za-z0-9_.]*$/.test(field)) throw Error('Invalid filter field');
    if (!value) throw Error('Empty filter value for ' + field);
    return field + '[eq]:' + JSON.stringify(value);
  });
  if (items.length === 0) throw Error('At least one filter is required');
  return items.length === 1 ? items[0] : 'and(' + items.join(',') + ')';
}

/** Uses the workspace token provided by Twenty to the installed application's logic function. */
export class TwentyRestIngestionStore implements IngestionStore {
  private readonly api: RestApiClient;

  constructor(api: RestApiClient = new RestApiClient({ runAs: 'application' })) {
    this.api = api;
  }

  async list(resource: string, filter: Filter, limit = 2): Promise<DbRecord[]> {
    singular(resource); // Do not allow arbitrary REST resources.
    const result = await this.api.get<ApiResponse>('/rest/' + resource, {
      query: { filter: serializeFilter(filter), limit: Math.min(Math.max(limit, 1), 60), depth: 0 },
    });
    const records = result?.data?.[resource];
    if (!Array.isArray(records)) throw new Error('Twenty REST returned an unexpected list response for ' + resource);
    return records as DbRecord[];
  }
  async get(resource: string, id: string): Promise<DbRecord | null> {
    singular(resource);
    if (!/^[a-fA-F0-9-]{36}$/.test(id)) throw Error('Invalid record ID');
    try {
      return responseObject(await this.api.get<ApiResponse>('/rest/' + resource + '/' + id, { query: { depth: 0 } }), resource, 'get');
    } catch (error) {
      if ((error as {status?: number}).status === 404) return null;
      throw error;
    }
  }
  async create(resource: string, data: Record<string, unknown>): Promise<DbRecord> {
    singular(resource);
    return responseObject(await this.api.post<ApiResponse>('/rest/' + resource, data), resource, 'create');
  }
  async update(resource: string, id: string, data: Record<string, unknown>): Promise<DbRecord> {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Error('Invalid record ID');
    return responseObject(await this.api.patch<ApiResponse>('/rest/' + resource + '/' + id, data), resource, 'update');
  }
  async advanceCaseActivity(caseId: string, occurredAt: string, recoveredChanges?: Record<string, unknown>): Promise<void> {
    if (!isRecordId(caseId) || !Number.isFinite(Date.parse(occurredAt))) throw Error('Invalid case activity');
    const id = serializeFilter({ id: caseId });
    const older = 'lastMessageAt[lt]:' + JSON.stringify(occurredAt);
    const same = recoveredChanges ? ',lastMessageAt[eq]:' + JSON.stringify(occurredAt) : '';
    const filter = `and(${id},or(${older}${same},lastMessageAt[is]:NULL))`;
    await this.api.patch('/rest/supportCases', { ...recoveredChanges, lastMessageAt: occurredAt }, { query: { filter } });
  }
  async linkPersonIfMissing(resource: 'supportExternalIdentities' | 'supportCases', id: string, personId: string): Promise<void> {
    if (!isRecordId(id) || !isRecordId(personId)) throw Error('Invalid Person link');
    const filter = 'and(' + serializeFilter({ id }) + ',personId[is]:NULL)';
    await this.api.patch('/rest/' + resource, { personId }, { query: { filter } });
  }
  async linkMessageIfMissing(messageId: string, caseId: string): Promise<void> {
    if (!isRecordId(messageId) || !isRecordId(caseId)) throw Error('Invalid message link');
    const filter = 'and(' + serializeFilter({ id: messageId }) + ',supportCaseId[is]:NULL)';
    await this.api.patch('/rest/supportMessages', { supportCaseId: caseId }, { query: { filter } });
  }
}
