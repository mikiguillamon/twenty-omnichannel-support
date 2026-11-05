import { RestApiClient } from 'twenty-client-sdk/rest';

export type ChannelType = 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'TELEGRAM';
export type ChannelStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED';
export type GroupingMode = 'THREAD' | 'MESSAGE' | 'HYBRID' | 'SESSION' | 'MANUAL';
export type AmbiguousAction = 'REVIEW' | 'NEW';

export type ChannelPolicy = {
  groupingMode: GroupingMode;
  continuationHours: number;
  reopenHours: number;
  semanticClassification: boolean;
  minClassificationConfidence: number;
  ambiguousAction: AmbiguousAction;
  autoCloseEnabled: boolean;
  autoCloseDays: number;
};

export type SupportChannel = {
  id: string; name?: string | null; code?: string | null;
  channelType?: ChannelType | null; provider?: string | null;
  externalIdentifier?: string | null; status?: ChannelStatus | null;
  health?: string | null;
} & Partial<ChannelPolicy>;

export function defaultPolicy(type: ChannelType): ChannelPolicy {
  return {
    groupingMode: type === 'EMAIL' ? 'THREAD' : 'HYBRID',
    continuationHours: 72,
    reopenHours: 48,
    semanticClassification: type !== 'EMAIL',
    minClassificationConfidence: 0.8,
    ambiguousAction: 'REVIEW',
    autoCloseEnabled: false,
    autoCloseDays: 7,
  };
}

export function effectivePolicy(channel: SupportChannel): ChannelPolicy {
  const defaults = defaultPolicy(channel.channelType ?? 'EMAIL');
  return {
    groupingMode: channel.groupingMode ?? defaults.groupingMode,
    continuationHours: channel.continuationHours ?? defaults.continuationHours,
    reopenHours: channel.reopenHours ?? defaults.reopenHours,
    semanticClassification: channel.semanticClassification ?? defaults.semanticClassification,
    minClassificationConfidence: channel.minClassificationConfidence ?? defaults.minClassificationConfidence,
    ambiguousAction: channel.ambiguousAction ?? defaults.ambiguousAction,
    autoCloseEnabled: channel.autoCloseEnabled ?? defaults.autoCloseEnabled,
    autoCloseDays: channel.autoCloseDays ?? defaults.autoCloseDays,
  };
}

export function validatePolicy(value: ChannelPolicy, type: ChannelType): string | null {
  const modes: GroupingMode[] = ['THREAD', 'MESSAGE', 'HYBRID', 'SESSION', 'MANUAL'];
  if (!modes.includes(value.groupingMode)) return 'Selecciona una estrategia válida.';
  if (type !== 'EMAIL' && value.groupingMode === 'THREAD')
    return 'La agrupación por hilo está reservada a proveedores que entregan identificadores de hilo, como el email.';
  if (type === 'EMAIL' && ['SESSION', 'HYBRID'].includes(value.groupingMode))
    return 'En email, usa hilo, mensaje o revisión manual.';
  if (!Number.isInteger(value.continuationHours) || value.continuationHours < 1 || value.continuationHours > 8760)
    return 'La continuidad debe estar entre 1 y 8760 horas.';
  if (!Number.isInteger(value.reopenHours) || value.reopenHours < 0 || value.reopenHours > 8760)
    return 'La reapertura debe estar entre 0 y 8760 horas.';
  if (!Number.isFinite(value.minClassificationConfidence) ||
    value.minClassificationConfidence < 0.5 || value.minClassificationConfidence > 1)
    return 'La confianza debe estar entre 0,50 y 1.';
  if (!['REVIEW','NEW'].includes(value.ambiguousAction)) return 'Selecciona qué hacer si existe ambigüedad.';
  if (!Number.isInteger(value.autoCloseDays) || value.autoCloseDays < 1 || value.autoCloseDays > 365)
    return 'El cierre por inactividad debe estar entre 1 y 365 días.';
  return null;
}

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
    ...input, ...defaultPolicy(input.channelType), status:'DISABLED', health:'UNKNOWN',
  });
}
export async function updateChannelStatus(id:string,status:ChannelStatus):Promise<void> {
  await new RestApiClient().patch('/rest/supportChannels/'+encodeURIComponent(id),{status});
}
export async function updateChannelPolicy(id:string, channelType:ChannelType, policy:ChannelPolicy):Promise<void> {
  const error = validatePolicy(policy, channelType);
  if (error) throw Error(error);
  await new RestApiClient().patch('/rest/supportChannels/'+encodeURIComponent(id), policy);
}
