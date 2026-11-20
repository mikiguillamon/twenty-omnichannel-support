import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { SOURCES, isDashboardField, isSource, type Source } from './dashboard-model.ts';

export type DashboardFieldKind = 'text' | 'select' | 'array' | 'boolean' | 'number' | 'date' | 'dateTime' | 'relation' | 'name' | 'composite';
type Option = { value: string; label: string };
export type DashboardField = {
  key: string;
  label: string;
  kind: DashboardFieldKind;
  column: string;
  options?: Option[];
  property?: string;
};
export type DashboardSource = {
  key: Source;
  label: string;
  fields: ReadonlyMap<string, DashboardField>;
};
export type DashboardCatalog = ReadonlyMap<Source, DashboardSource>;
type MetadataField = {
  id: string;
  name: string;
  label: string;
  isActive?: boolean | null;
  type: string;
  options?: unknown;
  relation?: { type: string } | null;
};
type MetadataObject = {
  id: string;
  namePlural: string;
  labelPlural: string;
  isActive: boolean;
  isSystem: boolean;
  labelIdentifierFieldMetadataId?: string | null;
  fieldsList: MetadataField[];
};

const builtinLabels: Readonly<Record<string, string>> = {
  id: 'Identificador', createdAt: 'Creación', firstMessageAt: 'Primer mensaje', lastMessageAt: 'Último mensaje',
  resolvedAt: 'Resolución', escalatedAt: 'Escalado', followUpAt: 'Fecha de seguimiento', channel: 'Canal', status: 'Estado',
  resolution: 'Resolución', automation: 'Automatización', technicalStatus: 'Estado técnico', followUp: 'Seguimiento',
  language: 'Idioma', categoryId: 'Categoría', caseTypeId: 'Tipo', assignedTo: 'Asignado a', responseCount: 'Respuestas',
  tags: 'Etiquetas', customTags: 'Etiquetas propias', scopeTags: 'Alcance', occurredAt: 'Fecha del mensaje',
  sentAt: 'Enviado', deliveredAt: 'Entregado', direction: 'Dirección', senderType: 'Remitente', deliveryStatus: 'Entrega',
  replyDecision: 'Decisión', provider: 'Proveedor', botConfidence: 'Confianza del bot', reviewedAt: 'Fecha de evaluación',
  verdict: 'Veredicto', targetScope: 'Alcance de la evaluación', followupStatus: 'Seguimiento', reviewer: 'Evaluador',
  score: 'Puntuación', channelType: 'Tipo de canal', health: 'Estado técnico', lastEventAt: 'Último evento',
  lastErrorAt: 'Último error', publishedAt: 'Publicación', lastSyncedAt: 'Última sincronización', revision: 'Revisión',
};

export const builtinDashboardCatalog: DashboardCatalog = new Map(
  Object.entries(SOURCES).map(([key, definition]) => {
    const entries = new Map<string, DashboardField>();
    for (const name of definition.dimensions) {
      const column = name === 'categoryId' ? 'category' : name === 'caseTypeId' ? 'caseType' : name;
      const kind = column !== name ? 'relation' : name === 'tags' || name === 'customTags' || name === 'scopeTags' ? 'array' : 'text';
      entries.set(name, { key: name, column, kind, label: builtinLabels[name] ?? name });
    }
    for (const name of definition.numeric) entries.set(name, { key: name, column: name, label: builtinLabels[name] ?? name, kind: 'number' });
    for (const name of definition.dates) entries.set(name, { key: name, column: name, label: builtinLabels[name] ?? name, kind: 'dateTime' });
    return [key, { key, label: definition.label, fields: entries }];
  }),
);

const isSecretField = (name: string): boolean =>
  /(?:password|secret|credential|apiKey|accessToken|refreshToken|updateToken|webhook|callbackUrl|resumeUrl|configJson|authorization)/i.test(name);
const configSources = new Set(['supportSettings', 'supportDashboards', 'supportConversationViews']);

function optionsFrom(input: unknown): Option[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.flatMap(entry => entry && typeof entry.value === 'string' && typeof entry.label === 'string'
    ? [{ value: entry.value, label: entry.label }] : []);
}

const simpleKinds = new Map<string, DashboardFieldKind>([
  ['TEXT','text'], ['SELECT','select'], ['RATING','select'], ['ARRAY','array'], ['MULTI_SELECT','array'],
  ['DATE','date'], ['DATE_TIME','dateTime'], ['BOOLEAN','boolean'], ['NUMBER','number'], ['NUMERIC','number'],
  ['FULL_NAME','name'], ['UUID','text'],
]);
const compoundFields = new Map<string, Array<[string, string]>>([
  ['CURRENCY', [['currencyCode','Moneda']]],
  ['ADDRESS', [['addressCity','Ciudad'], ['addressState','Provincia'], ['addressCountry','País'], ['addressPostcode','Código postal']]],
]);

function fromMetadata(field: MetadataField): DashboardField[] {
  const { name, label, type } = field;
  if (field.isActive === false || !isDashboardField(name) || name.includes('.') || isSecretField(name)) return [];
  if (type === 'RELATION' && field.relation?.type === 'MANY_TO_ONE') {
    return [{ key: name + 'Id', column: name, label, kind: 'relation' }];
  }
  const simpleKind = simpleKinds.get(type);
  if (simpleKind) return [{ key: name, column: name, label, kind: simpleKind, options: optionsFrom(field.options) }];
  return compoundFields.get(type)?.map(([property, component]) => ({
    key: name + '.' + property, column: name, label: label + ' · ' + component, kind: 'composite', property,
  })) ?? [];
}

function readDashboardSource(object: MetadataObject, restricted: unknown): DashboardSource | null {
  if (!object.isActive || object.isSystem || !isSource(object.namePlural) || configSources.has(object.namePlural) || !Array.isArray(object.fieldsList)) return null;
  const denials = restricted && typeof restricted === 'object'
    ? restricted as Record<string, { canRead?: boolean } | undefined> : {};
  const visible = object.fieldsList.filter(field => denials[field.id]?.canRead !== false);
  if (!visible.some(field => field.name === 'id' && field.isActive !== false)) return null;
  const entries = visible.filter(field => field.name !== 'id').flatMap(fromMetadata);
  const preferred = visible.find(field => field.id === object.labelIdentifierFieldMetadataId)?.name;
  entries.sort((a,b) => Number(b.key === preferred) - Number(a.key === preferred) || a.label.localeCompare(b.label, 'es'));
  return { key: object.namePlural, label: object.labelPlural, fields: new Map(entries.map(field => [field.key, field])) };
}

/** The current user's field and object permissions come from Twenty. Data reads still use the delegated REST token. */
export async function loadDashboardCatalog(client: Pick<MetadataApiClient, 'query'> = new MetadataApiClient()): Promise<DashboardCatalog> {
  const catalog = new Map<Source, DashboardSource>();
  const permissions = new Map<string, unknown>();
  const visitedCursors = new Set<string>();
  let after: string | undefined;
  for (;;) {
    const response = await client.query({
      ...(!after ? { currentUser: { currentUserWorkspace: { objectPermissions: {
        objectMetadataId: true, canReadObjectRecords: true, restrictedFields: true,
      } } } } as const : {}),
      objects: {
        __args: { filter: { isActive: { is: true }, isSystem: { is: false } }, paging: { first: 60, after } },
        edges: { node: {
          id: true, isActive: true, isSystem: true, namePlural: true, labelPlural: true, labelIdentifierFieldMetadataId: true,
          fieldsList: { id: true, name: true, label: true, type: true, isActive: true, options: true, relation: { type: true } },
        } },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    });
    if (!after) {
      const rows = response.currentUser?.currentUserWorkspace?.objectPermissions;
      if (!Array.isArray(rows)) throw Error('DASHBOARD_PERMISSIONS_UNAVAILABLE');
      for (const row of rows) if (row.canReadObjectRecords === true) permissions.set(row.objectMetadataId, row.restrictedFields);
    }
    for (const { node } of response.objects.edges) {
      if (!permissions.has(node.id)) continue;
      const source = readDashboardSource(node, permissions.get(node.id));
      if (source) catalog.set(source.key, source);
    }
    if (!response.objects.pageInfo.hasNextPage) return catalog;
    const next = response.objects.pageInfo.endCursor;
    if (typeof next !== 'string' || !next || visitedCursors.has(next)) throw Error('DASHBOARD_METADATA_CURSOR');
    visitedCursors.add(next);
    after = next;
  }
}

export const fieldLabel = (source: DashboardSource | undefined, key: string): string =>
  source?.fields.get(key)?.label ?? builtinLabels[key] ?? key;

export function fieldOptions(field: DashboardField | undefined): Option[] {
  if (field?.kind === 'boolean') return [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }];
  return field?.options ?? [];
}

export function displayDashboardValue(field: DashboardField | undefined, value: string): string {
  return fieldOptions(field).find(option => option.value === value)?.label ?? value;
}
