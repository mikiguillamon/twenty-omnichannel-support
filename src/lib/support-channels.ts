import { RestApiClient } from 'twenty-client-sdk/rest';

export type ChannelType = 'EMAIL' | 'WHATSAPP';
export type ChannelStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED';
export type SupportChannel = {
  id: string; name?: string | null; code?: string | null;
  channelType?: ChannelType | null; provider?: string | null;
  externalIdentifier?: string | null; status?: ChannelStatus | null;
  health?: string | null;
};

export function normalizeCode(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/g, '');
}
export function isValidCode(code: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,63}$/.test(code);
}
export async function getChannels(): Promise<SupportChannel[]> {
  const raw: unknown = await new RestApiClient().get('/rest/supportChannels', {query:{limit:100}});
  if (!raw || typeof raw !== 'object') throw Error('Invalid channel API response');
  const root=raw as Record<string,unknown>;
  const data=root.data && typeof root.data==='object' ? root.data as Record<string,unknown> : root;
  const value=data.supportChannels ?? data.records;
  const records=Array.isArray(value) ? value :
    value && typeof value==='object' && Array.isArray((value as Record<string,unknown>).edges) ?
      ((value as {edges:Array<{node:unknown}>}).edges.map(edge=>edge.node)) : null;
  if (!records) throw Error('Channel records missing in API response');
  return records.filter((r):r is SupportChannel=>!!r && typeof r==='object' && typeof (r as Record<string,unknown>).id==='string');
}
export async function addChannel(input: {
  name:string; code:string; channelType:ChannelType;
  provider:string; externalIdentifier:string;
}):Promise<void> {
  await new RestApiClient().post('/rest/supportChannels',{
    ...input, status:'DISABLED', health:'UNKNOWN',
  });
}
export async function updateChannelStatus(id:string,status:ChannelStatus):Promise<void> {
  await new RestApiClient().patch('/rest/supportChannels/'+encodeURIComponent(id),{status});
}
