/**
 * Workspace dashboard definitions. Persisted as versioned JSON in the existing
 * supportSettings object (one setting per dashboard, never in browser storage).
 * The catalogs are intentionally allow-listed: widget config cannot select
 * arbitrary REST endpoints or metadata fields.
 */
export const DASHBOARD_PREFIX = 'omnichannel.dashboard.v2.';
export const MAX_WIDGETS = 36;
export const MAX_DASHBOARDS = 30;

export const SOURCES = {
  supportCases: {
    label: 'Conversaciones', singular: 'Conversación',
    dates: ['createdAt','firstMessageAt','lastMessageAt','resolvedAt','escalatedAt','followUpAt'],
    dimensions: ['channel','status','resolution','automation','technicalStatus','followUp','language','categoryId','caseTypeId','assignedTo'],
    numeric: ['responseCount'],
    fields: ['id','subject','channel','status','resolution','automation','technicalStatus','followUp','language','categoryId','caseTypeId','assignedTo','responseCount','createdAt','firstMessageAt','lastMessageAt','resolvedAt','escalatedAt','followUpAt'],
  },
  supportMessages: {
    label: 'Mensajes', singular: 'Mensaje',
    dates: ['createdAt','occurredAt','sentAt','deliveredAt'],
    dimensions: ['direction','senderType','deliveryStatus','replyDecision','provider'],
    numeric: ['botConfidence'],
    fields: ['id','subject','direction','senderType','deliveryStatus','replyDecision','provider','botConfidence','createdAt','occurredAt','sentAt','deliveredAt'],
  },
  supportEvaluations: {
    label: 'Evaluaciones', singular: 'Evaluación',
    dates: ['createdAt','reviewedAt'],
    dimensions: ['verdict','targetScope','followupStatus','reviewer'],
    numeric: ['score'],
    fields: ['id','verdict','targetScope','followupStatus','reviewer','score','createdAt','reviewedAt'],
  },
  supportChannels: {
    label: 'Canales', singular: 'Canal',
    dates: ['createdAt','lastEventAt','lastErrorAt'],
    dimensions: ['channelType','status','health'],
    numeric: [],
    fields: ['id','name','code','channelType','status','health','createdAt','lastEventAt','lastErrorAt'],
  },
  supportFaqs: {
    label: 'FAQs', singular: 'FAQ',
    dates: ['createdAt','publishedAt','lastSyncedAt'],
    dimensions: ['status','language','categoryId'],
    numeric: ['revision'],
    fields: ['id','question','status','language','categoryId','revision','createdAt','publishedAt','lastSyncedAt'],
  },
} as const;

export type Source = keyof typeof SOURCES;
export type WidgetKind = 'kpi'|'bar'|'donut'|'line'|'area'|'table'|'hour'|'shortcut'|'text';
export type Aggregation = 'count'|'sum'|'avg'|'min'|'max'|'distinct'|'ratio';
export type PeriodKey = 'today'|'yesterday'|'7d'|'30d'|'90d'|'thisMonth'|'previousMonth'|'all'|'custom';
export type Period = { key: PeriodKey; start?: string; end?: string };
export type DashboardFilter = { field: string; operator: 'eq'|'neq'; value: string };
export type DashboardWidget = {
  id: string; title: string; kind: WidgetKind; source: Source;
  aggregation: Aggregation; valueField: string; groupBy: string; dateField: string;
  filters: DashboardFilter[]; ratioField: string; ratioValue: string;
  width: 3|4|6|8|12; compare: boolean;
  periodOverride: Period|null; text: string; url: string;
};
export type Dashboard = {
  id: string; title: string; description: string; icon: string; period: Period;
  widgets: DashboardWidget[]; isDefault: boolean; updatedAt: string;
};
export type StoredDashboard = { settingId: string|null; dashboard: Dashboard };

const PERIODS: PeriodKey[] = ['today','yesterday','7d','30d','90d','thisMonth','previousMonth','all','custom'];
const KINDS: WidgetKind[] = ['kpi','bar','donut','line','area','table','hour','shortcut','text'];
const AGGREGATIONS: Aggregation[] = ['count','sum','avg','min','max','distinct','ratio'];
const WIDTHS: DashboardWidget['width'][] = [3,4,6,8,12];
const safeText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const object = (value:unknown): Record<string,unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
const oneOf = <T extends string>(value:unknown, allowed: readonly T[], fallback:T):T =>
  typeof value==='string' && allowed.includes(value as T) ? value as T : fallback;
export const newId = ():string =>
  'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,12);
export const isSource = (value:unknown):value is Source =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(SOURCES,value);
export const fieldsFor = (source:Source, category:'dates'|'dimensions'|'numeric'|'fields'):readonly string[] =>
  SOURCES[source][category] as readonly string[];
export const dateFor = (source:Source) => fieldsFor(source,'dates')[0] || 'createdAt';
export function periodFrom(value:unknown):Period {
  const raw=object(value);
  const key=oneOf(raw.key,PERIODS,'30d');
  const date=(v:unknown)=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : '';
  const start=date(raw.start),end=date(raw.end);
  return key==='custom' && start && end && start<=end ? {key,start,end}
    : key==='custom' ? {key:'30d'} : {key};
}
export function makeWidget(kind:WidgetKind='kpi',source:Source='supportCases',title?:string):DashboardWidget {
  return {id:newId(),title:title||('Nuevo '+(kind==='kpi'?'indicador':'gráfico')),kind,source,
    aggregation:'count',valueField:'',groupBy:fieldsFor(source,'dimensions')[0]||'',
    dateField:dateFor(source),filters:[],ratioField:'',ratioValue:'',width:kind==='kpi'?3:kind==='text'||kind==='shortcut'?6:6,
    compare:kind==='kpi',periodOverride:null,text:'',url:''};
}
export function normalizeWidget(value:unknown):DashboardWidget {
  const raw=object(value);
  const source:Source=isSource(raw.source)?raw.source:'supportCases';
  const kind=oneOf(raw.kind,KINDS,'kpi');
  const aggregate=oneOf(raw.aggregation,AGGREGATIONS,'count');
  const numeric=fieldsFor(source,'numeric'),dimensions=fieldsFor(source,'dimensions');
  const valueField=safeText(raw.valueField,60);
  const groupBy=safeText(raw.groupBy,60);
  const ratioField=safeText(raw.ratioField,60);
  const dateField=safeText(raw.dateField,60);
  const filters=Array.isArray(raw.filters)?raw.filters.slice(0,5).map(object).filter(f=>dimensions.includes(String(f.field)) && (f.operator==='eq'||f.operator==='neq') && typeof f.value==='string' && f.value.length<=120)
    .map(f=>({field:String(f.field),operator:f.operator as 'eq'|'neq',value:String(f.value)})):[];
  const url=safeText(raw.url,500);
  const safeUrl=/^(https:\/\/[^\s]+|\/(?!\/)[\w/#?=&%+.-]+)$/.test(url) ? url : '';
  return {
    id:typeof raw.id==='string' && /^[a-zA-Z0-9-]{4,70}$/.test(raw.id)?raw.id:newId(),
    title:safeText(raw.title,90)||'Sin título',kind,source,aggregation:aggregate,
    valueField:numeric.includes(valueField) || dimensions.includes(valueField)?valueField:'',
    groupBy:dimensions.includes(groupBy)?groupBy:(dimensions[0]||''),
    dateField:fieldsFor(source,'dates').includes(dateField)?dateField:dateFor(source),
    filters,ratioField:dimensions.includes(ratioField)?ratioField:'',
    ratioValue:safeText(raw.ratioValue,120),
    width:WIDTHS.includes(raw.width as DashboardWidget['width'])?raw.width as DashboardWidget['width']:kind==='kpi'?3:6,
    compare:raw.compare===true,periodOverride:raw.periodOverride?periodFrom(raw.periodOverride):null,
    text:safeText(raw.text,4000),url:safeUrl,
  };
}
export function normalizeDashboard(value:unknown):Dashboard {
  const raw=object(value);
  if(!Array.isArray(raw.widgets))throw Error('DASHBOARD_INVALID_WIDGETS');
  if(raw.widgets.length>MAX_WIDGETS)throw Error('DASHBOARD_TOO_MANY_WIDGETS');
  const widgets=raw.widgets.map(normalizeWidget);
  if(new Set(widgets.map(w=>w.id)).size!==widgets.length)throw Error('DASHBOARD_DUPLICATE_WIDGETS');
  return {id:typeof raw.id==='string'&&/^[a-zA-Z0-9-]{4,70}$/.test(raw.id)?raw.id:newId(),
    title:safeText(raw.title,90)||'Nuevo dashboard',description:safeText(raw.description,240),
    icon:safeText(raw.icon,8)||'📊',period:periodFrom(raw.period),widgets,
    isDefault:raw.isDefault===true,
    updatedAt:typeof raw.updatedAt==='string'&&!Number.isNaN(Date.parse(raw.updatedAt))?raw.updatedAt:new Date().toISOString()};
}
export function createDashboard(title='Nuevo dashboard'):Dashboard {
  return {id:newId(),title,description:'',icon:'📊',period:{key:'30d'},widgets:[],isDefault:false,updatedAt:new Date().toISOString()};
}
export function defaultDashboard():Dashboard {
  const dashboard=createDashboard('Visión general');
  dashboard.description='Actividad, automatización y calidad de atención en todos los canales.';
  dashboard.isDefault=true;
  const kpi=(title:string,source:Source,filters:DashboardFilter[]=[],ratioField='',ratioValue='')=>{
    const widget=makeWidget('kpi',source,title);
    widget.filters=filters; widget.ratioField=ratioField;widget.ratioValue=ratioValue;
    if(ratioField)widget.aggregation='ratio';
    return widget;
  };
  const chart=(kind:WidgetKind,source:Source,title:string,groupBy?:string):DashboardWidget=>{
    const w=makeWidget(kind,source,title);if(groupBy)w.groupBy=groupBy;
    return w;
  };
  dashboard.widgets=[
    kpi('Conversaciones', 'supportCases'),
    kpi('Atención humana', 'supportCases',[{field:'status',operator:'eq',value:'HUMAN_REQUIRED'}]),
    kpi('Automatizadas', 'supportCases',[],'status','AUTOMATED'),
    kpi('Errores técnicos', 'supportCases',[{field:'technicalStatus',operator:'eq',value:'ERROR'}]),
    chart('line','supportCases','Evolución de conversaciones'),
    chart('donut','supportCases','Distribución por canal','channel'),
    chart('bar','supportCases','Estado de las conversaciones','status'),
    chart('donut','supportEvaluations','Calidad de respuestas','verdict'),
    chart('hour','supportMessages','Actividad por horas'),
    chart('table','supportCases','Tipos de conversación','caseTypeId'),
  ];
  dashboard.widgets[4].width=8;
  dashboard.widgets[5].width=4;
  dashboard.widgets[6].width=6;
  dashboard.widgets[7].width=6;
  dashboard.widgets[8].width=6;
  dashboard.widgets[9].width=6;
  return dashboard;
}
export const WIDGET_LABELS:Record<WidgetKind,string>={
  kpi:'Indicador KPI',bar:'Barras',donut:'Circular / donut',line:'Líneas',area:'Área',table:'Tabla',hour:'Actividad horaria',shortcut:'Acceso directo',text:'Texto',
};
export const PERIOD_LABELS:Record<PeriodKey,string>={
  today:'Hoy',yesterday:'Ayer','7d':'Últimos 7 días','30d':'Últimos 30 días','90d':'Últimos 90 días',
  thisMonth:'Este mes',previousMonth:'Mes anterior',all:'Todo',custom:'Rango personalizado',
};
