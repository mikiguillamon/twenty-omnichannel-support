import { RestApiClient } from 'twenty-client-sdk/rest';
import { fieldsFor, isBuiltinSource, type DashboardWidget, type Period, type Source } from './dashboard-model.ts';
import { displayDashboardValue, type DashboardField, type DashboardSource } from './dashboard-metadata.ts';

export type RecordData = Record<string,unknown>;
export type Dataset = {rows:RecordData[];complete:boolean;total:number;fields?: ReadonlyMap<string,DashboardField>};
export type Point = {name:string;value:number};
export type Summary = {value:number|null;points:Point[];previous:number|null;complete:boolean;total:number;overlappingGroups:boolean};
const PAGE_SIZE=60;
const MAX_RECORDS=3000;

function responseCollection(response:unknown,resource:string):{rows:RecordData[];cursor:string|null;total:number|null}{
  if(!response||typeof response!=='object')throw Error('DASHBOARD_REST_INVALID');
  const root=response as Record<string,unknown>;
  const data=root.data&&typeof root.data==='object'?root.data as Record<string,unknown>:root;
  const rows=data[resource];
  if(!Array.isArray(rows))throw Error('DASHBOARD_REST_COLLECTION');
  const page=(root.pageInfo??data.pageInfo) as {hasNextPage?:boolean;endCursor?:string}|undefined;
  const count=root.totalCount??data.totalCount;
  const total=typeof count==='number'&&Number.isSafeInteger(count)&&count>=0?count:null;
  if(page&&page.hasNextPage===true&&!page.endCursor)throw Error('DASHBOARD_REST_CURSOR');
  if(!page&&rows.length===PAGE_SIZE)throw Error('DASHBOARD_REST_CURSOR');
  return {rows:rows as RecordData[],cursor:page?.hasNextPage?page.endCursor??null:null,total};
}
async function fetchRecords(source:Source,columns:string[],api:RestApiClient,signal?:{cancelled:boolean}):Promise<Dataset>{
  const records=new Map<string, RecordData>();
  const seenCursors=new Set<string>();
  let cursor:string|null=null,total=0;
  for(let index=0;index<MAX_RECORDS/PAGE_SIZE;index++){
    if(signal?.cancelled)throw Error('DASHBOARD_CANCELLED');
    const query:Record<string,string|number>={fields:columns.join(','),limit:PAGE_SIZE,depth:0,order_by:'id[AscNullsLast]'};
    if(cursor)query.starting_after=cursor;
    const response:unknown=await api.get('/rest/'+source,{query});
    const page=responseCollection(response,source);
    for (const row of page.rows) {
      if (!row || typeof row.id!=='string' || !row.id) throw Error('DASHBOARD_REST_RECORD_ID');
      records.set(row.id,row);
    }
    total=Math.max(total,page.total??0);
    cursor=page.cursor;
    if(!cursor)break;
    if(seenCursors.has(cursor))throw Error('DASHBOARD_REST_CURSOR_LOOP');
    seenCursors.add(cursor);
  }
  return {rows:[...records.values()],complete:!cursor&&total<=records.size,total:Math.max(total,records.size)};
}

export function fetchDataset(source:Source,api:RestApiClient,signal?:{cancelled:boolean}):Promise<Dataset>{
  if(!isBuiltinSource(source))return Promise.reject(Error('DASHBOARD_SOURCE_UNAVAILABLE'));
  return fetchRecords(source,[...fieldsFor(source,'fields')],api,signal);
}

export function workspaceWidgetFields(widget: DashboardWidget): string[] {
  if (widget.kind === 'text' || widget.kind === 'shortcut') return [];
  const group = widget.kind === 'bar' || widget.kind === 'donut' || widget.kind === 'table' ? widget.groupBy : '';
  const metric = widget.aggregation === 'ratio' ? widget.ratioField : widget.aggregation === 'count' ? '' : widget.valueField;
  return [...new Set([widget.dateField, group, metric, ...widget.filters.map(filter => filter.field)].filter(Boolean))];
}

/** Only columns sourced from current workspace metadata can be selected. */
export async function fetchWorkspaceDataset(source: DashboardSource, keys: string[], api: RestApiClient, signal?: {cancelled:boolean}): Promise<Dataset> {
  const fields = new Map<string, DashboardField>();
  for (const key of keys) {
    const field = source.fields.get(key);
    if (!field) throw Error('DASHBOARD_FIELD_UNAVAILABLE');
    fields.set(key, field);
  }
  const columns = [...new Set(['id', ...[...fields.values()].map(field => field.column).sort()])];
  const data = await fetchRecords(source.key, columns, api, signal);
  const rows = data.rows.map(row => {
    const projected: RecordData = { id: row.id };
    for (const field of fields.values()) {
      const raw = row[field.column];
      if (field.kind === 'composite') {
        projected[field.key] = raw && typeof raw === 'object' && field.property
          ? (raw as RecordData)[field.property] : undefined;
      } else if (field.kind === 'name') {
        const name = raw && typeof raw === 'object' ? raw as RecordData : {};
        projected[field.key] = [name.firstName, name.lastName].filter(v => typeof v === 'string' && v).join(' ');
      } else {
        projected[field.key] = field.kind === 'relation' ? row[field.key] : raw;
      }
    }
    return projected;
  });
  return { ...data, rows, fields };
}

export function dashboardValues(value: unknown): string[] {
  const values: unknown[] = Array.isArray(value) ? value : [value];
  return [...new Set(values.filter(entry => (typeof entry === 'string' && entry !== '') ||
    typeof entry === 'boolean' || (typeof entry === 'number' && Number.isFinite(entry))).map(String))];
}

function numericValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return Number(value);
  return NaN;
}
function localDate(date:Date):string{
  const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0');
  return year+'-'+month+'-'+day;
}
export type Range = {from:Date|null;to:Date|null};
export function getRange(period:Period,now=new Date()):Range{
  const day=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const end=new Date(day);end.setDate(end.getDate()+1);
  if(period.key==='all')return {from:null,to:null};
  if(period.key==='custom'&&period.start&&period.end&&period.start<=period.end){
    const from=new Date(period.start+'T00:00:00');
    const to=new Date(period.end+'T00:00:00');to.setDate(to.getDate()+1);
    return {from,to};
  }
  if(period.key==='custom')return getRange({key:'30d'},now);
  if(period.key==='thisMonth')return {from:new Date(day.getFullYear(),day.getMonth(),1),to:end};
  if(period.key==='previousMonth')return {from:new Date(day.getFullYear(),day.getMonth()-1,1),to:new Date(day.getFullYear(),day.getMonth(),1)};
  const from=new Date(day);
  if(period.key==='yesterday'){from.setDate(from.getDate()-1);return {from,to:day};}
  if(period.key==='today')return {from,to:end};
  from.setDate(from.getDate()-(period.key==='7d'?6:period.key==='90d'?89:29));
  return {from,to:end};
}
function prior(range:Range):Range{
  if(!range.from||!range.to)return {from:null,to:null};
  const len=range.to.getTime()-range.from.getTime();
  return {from:new Date(range.from.getTime()-len),to:range.from};
}
function within(value:unknown,range:Range):boolean{
  if(!range.from)return true;
  const millis=localTimestamp(value);
  return Number.isFinite(millis)&&millis>=range.from.getTime()&&(!range.to||millis<range.to.getTime());
}
const localTimestamp = (value: unknown): number => typeof value==='string'
  ? Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value+'T00:00:00' : value) : NaN;
function filtered(rows:RecordData[],w:DashboardWidget,range:Range):RecordData[]{
  return rows.filter(row=>(!w.dateField||within(row[w.dateField],range))&&w.filters.every(f=>{
    const matches=dashboardValues(row[f.field]).includes(f.value);
    return f.operator==='eq'?matches:!matches;
  }));
}
function aggregate(rows:RecordData[],w:DashboardWidget):number|null {
  if(w.aggregation==='count')return rows.length;
  if(w.aggregation==='ratio'){
    if(!w.ratioField)return null;
    if(!rows.length)return 0;
    return 100*rows.filter(row=>dashboardValues(row[w.ratioField]).includes(w.ratioValue)).length/rows.length;
  }
  if(w.aggregation==='distinct'){
    if(!w.valueField)return null;
    return new Set(rows.flatMap(row=>dashboardValues(row[w.valueField]))).size;
  }
  if(!w.valueField)return null;
  const numbers=rows.map(row=>numericValue(row[w.valueField])).filter(Number.isFinite);
  if(!numbers.length)return null;
  if(w.aggregation==='sum')return numbers.reduce((a,b)=>a+b,0);
  if(w.aggregation==='avg')return numbers.reduce((a,b)=>a+b,0)/numbers.length;
  if(w.aggregation==='min')return Math.min(...numbers);
  if(w.aggregation==='max')return Math.max(...numbers);
  return null;
}
function groupKeys(row:RecordData,w:DashboardWidget,monthly=false):string[]{
  if(w.kind==='hour'||w.kind==='line'||w.kind==='area'){
    const time=localTimestamp(row[w.dateField]);
    if(!Number.isFinite(time)) return [];
    const date=new Date(time);
    if(w.kind==='hour')return [String(date.getHours()).padStart(2,'0')+':00'];
    return [localDate(date).slice(0,monthly?7:10)];
  }
  const values = dashboardValues(row[w.groupBy]);
  return values.length ? values : [''];
}

function seriesPeriod(range:Range,rows:RecordData[],w:DashboardWidget):Range {
  if(range.from&&range.to)return range;
  const values=rows.map(r=>localTimestamp(r[w.dateField])).filter(Number.isFinite);
  if(!values.length)return {from:null,to:null};
  const min=new Date(Math.min(...values));
  const max=new Date(Math.max(...values));
  return {from:new Date(min.getFullYear(),min.getMonth(),min.getDate()),
    to:new Date(max.getFullYear(),max.getMonth(),max.getDate()+1)};
}
function monthDistance(range:Range):boolean{
  return Boolean(range.from&&range.to&&range.to.getTime()-range.from.getTime()>120*86400000);
}
function timelinePoints(groups:Map<string,RecordData[]>,w:DashboardWidget,range:Range,monthly:boolean):Point[]{
  if(!range.from||!range.to)return [];
  const cursor=new Date(range.from);
  if(monthly)cursor.setDate(1);
  const points:Point[]=[];
  // At most 120 monthly buckets or 125 daily buckets. Longer historical ranges
  // are collapsed to existing buckets rather than silently truncating dates.
  const maxBuckets=monthly?120:125;
  for(let i=0;cursor<range.to&&i<maxBuckets;i++){
    const key=monthly?localDate(cursor).slice(0,7):localDate(cursor);
    points.push({name:key,value:aggregate(groups.get(key)??[],w)??0});
    if(monthly)cursor.setMonth(cursor.getMonth()+1);
    else cursor.setDate(cursor.getDate()+1);
  }
  if(cursor<range.to){
    // Highly unusual >10-year range. Preserve all known buckets rather than
    // representing a truncated timeline as the entire range.
    return [...groups.entries()].map(([name,records])=>({name,value:aggregate(records,w)??0}))
      .sort((a,b)=>a.name.localeCompare(b.name));
  }
  return points;
}
export function summarize(data:Dataset,w:DashboardWidget,period:Period,now=new Date()):Summary{
  const effective=w.periodOverride??period;
  const range=getRange(effective,now);
  const relevant=filtered(data.rows,w,range);
  const previous=w.compare&&w.dateField&&range.from?aggregate(filtered(data.rows,w,prior(range)),w):null;
  const isTimeline=w.kind==='line'||w.kind==='area';
  const timelineRange=isTimeline?seriesPeriod(range,relevant,w):range;
  const monthly=isTimeline&&monthDistance(timelineRange);
  const groups=new Map<string,RecordData[]>();
  let overlappingGroups=false;
  if(w.kind!=='kpi')for(const row of relevant){
    const keys=groupKeys(row,w,monthly);
    if(keys.length>1)overlappingGroups=true;
    for(const key of keys){
      const group=groups.get(key)??[];group.push(row);groups.set(key,group);
    }
  }
  let points:Point[];
  if(w.kind==='hour'){
    points=Array.from({length:24},(_,i)=>{
      const name=String(i).padStart(2,'0')+':00';
      return {name,value:aggregate(groups.get(name)??[],w)??0};
    });
  }else if(isTimeline){
    points=timelinePoints(groups,w,timelineRange,monthly);
  }else{
    const field = data.fields?.get(w.groupBy);
    points=[...groups.entries()].map(([key,records])=>({
      name:!w.groupBy ? 'Todos los registros' : key ? displayDashboardValue(field,key) : 'Sin clasificar',value:aggregate(records,w)??0,
    }));
    points.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
  }
  return {value:aggregate(relevant,w),points,previous,complete:data.complete,total:data.total,overlappingGroups};
}
export function formatMetric(value:number|null,aggregation:DashboardWidget['aggregation']):string{
  if(value===null||!Number.isFinite(value))return '—';
  return new Intl.NumberFormat('es-ES',{maximumFractionDigits:aggregation==='count'||aggregation==='distinct'?0:1}).format(value)+(aggregation==='ratio'?' %':'');
}
export function metricDelta(current:number|null,previous:number|null):string|null{
  if(current===null||previous===null)return null;
  if(previous===0)return current===0?'0 %':'Sin base';
  const difference=(current-previous)/Math.abs(previous)*100;
  return (difference>0?'+':'')+new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(difference)+' %';
}
