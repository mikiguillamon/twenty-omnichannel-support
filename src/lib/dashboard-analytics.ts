import { RestApiClient } from 'twenty-client-sdk/rest';
import { fieldsFor, type DashboardWidget, type Period, type Source } from './dashboard-model.ts';

export type RecordData = Record<string,unknown>;
export type Dataset = {rows:RecordData[];complete:boolean;total:number};
export type Point = {name:string;value:number};
export type Summary = {value:number|null;points:Point[];previous:number|null;complete:boolean;total:number};
const PAGE_SIZE=60;
const MAX_RECORDS=3000;

function responseCollection(response:unknown,resource:string):{rows:RecordData[];cursor:string|null;total:number}{
  if(!response||typeof response!=='object')throw Error('DASHBOARD_REST_INVALID');
  const root=response as Record<string,unknown>;
  const data=root.data&&typeof root.data==='object'?root.data as Record<string,unknown>:root;
  const rows=data[resource];
  if(!Array.isArray(rows))throw Error('DASHBOARD_REST_COLLECTION');
  const page=(root.pageInfo??data.pageInfo) as {hasNextPage?:boolean;endCursor?:string}|undefined;
  const total=typeof root.totalCount==='number'?root.totalCount:typeof data.totalCount==='number'?data.totalCount:rows.length;
  if(page&&page.hasNextPage===true&&!page.endCursor)throw Error('DASHBOARD_REST_CURSOR');
  if(!page&&rows.length===PAGE_SIZE)throw Error('DASHBOARD_REST_CURSOR');
  return {rows:rows as RecordData[],cursor:page?.hasNextPage?page.endCursor??null:null,total};
}
export async function fetchDataset(source:Source,api:RestApiClient,signal?:{cancelled:boolean}):Promise<Dataset>{
  const rows:RecordData[]=[];
  const seen=new Set<string>();
  let cursor:string|null=null,total=0,hasMore=false;
  for(let index=0;index<MAX_RECORDS/PAGE_SIZE;index++){
    if(signal?.cancelled)throw Error('DASHBOARD_CANCELLED');
    const query:Record<string,string|number>={fields:fieldsFor(source,'fields').join(','),limit:PAGE_SIZE,depth:0,order_by:'createdAt[DescNullsLast]'};
    if(cursor)query.starting_after=cursor;
    const response:unknown=await api.get('/rest/'+source,{query});
    const page=responseCollection(response,source);
    rows.push(...page.rows);
    total=page.total;
    cursor=page.cursor;hasMore=Boolean(cursor);
    if(!cursor)break;
    if(seen.has(cursor))throw Error('DASHBOARD_REST_CURSOR_LOOP');
    seen.add(cursor);
  }
  return {rows,complete:!hasMore,total};
}
const text=(value:unknown):string => value===null||value===undefined||value===''?'Sin clasificar':String(value);
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
  if(typeof value!=='string')return false;
  const millis=Date.parse(value);
  return Number.isFinite(millis)&&millis>=range.from.getTime()&&(!range.to||millis<range.to.getTime());
}
function filtered(rows:RecordData[],w:DashboardWidget,range:Range):RecordData[]{
  return rows.filter(row=>within(row[w.dateField],range)&&w.filters.every(f=>{
    const value=row[f.field];
    const matches=Array.isArray(value)?value.map(String).includes(f.value):String(value??'')===f.value;
    return f.operator==='eq'?matches:!matches;
  }));
}
function aggregate(rows:RecordData[],w:DashboardWidget):number|null {
  if(w.aggregation==='count')return rows.length;
  if(w.aggregation==='ratio'){
    if(!w.ratioField)return null;
    if(!rows.length)return 0;
    return 100*rows.filter(row=>text(row[w.ratioField])===w.ratioValue).length/rows.length;
  }
  if(w.aggregation==='distinct'){
    if(!w.valueField)return null;
    return new Set(rows.map(row=>text(row[w.valueField])).filter(v=>v!=='Sin clasificar')).size;
  }
  if(!fieldsFor(w.source,'numeric').includes(w.valueField))return null;
  const numbers=rows.map(row=>row[w.valueField]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
  if(!numbers.length)return null;
  if(w.aggregation==='sum')return numbers.reduce((a,b)=>a+b,0);
  if(w.aggregation==='avg')return numbers.reduce((a,b)=>a+b,0)/numbers.length;
  if(w.aggregation==='min')return Math.min(...numbers);
  if(w.aggregation==='max')return Math.max(...numbers);
  return null;
}
function groupKey(row:RecordData,w:DashboardWidget):string{
  if(w.kind==='hour'){
    const date=typeof row[w.dateField]==='string'?new Date(row[w.dateField] as string):null;
    return date&&!Number.isNaN(date.getTime())?String(date.getHours()).padStart(2,'0')+':00':'Sin hora';
  }
  if(w.kind==='line'||w.kind==='area'){
    const date=typeof row[w.dateField]==='string'?new Date(row[w.dateField] as string):null;
    return date&&!Number.isNaN(date.getTime())?localDate(date):'Sin fecha';
  }
  return text(row[w.groupBy]);
}
export function summarize(data:Dataset,w:DashboardWidget,period:Period):Summary{
  const effective=w.periodOverride??period;
  const range=getRange(effective);
  const relevant=filtered(data.rows,w,range);
  const previous=w.compare&&range.from?aggregate(filtered(data.rows,w,prior(range)),w):null;
  const groups=new Map<string,RecordData[]>();
  for(const row of relevant){
    const key=groupKey(row,w);
    const group=groups.get(key)??[];group.push(row);groups.set(key,group);
  }
  let points=[...groups.entries()].map(([name,records])=>({name,value:aggregate(records,w)??0}));
  if(w.kind==='line'||w.kind==='area'||w.kind==='hour')points.sort((a,b)=>a.name.localeCompare(b.name));
  else points.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
  return {value:aggregate(relevant,w),points:points.slice(0,20),previous,complete:data.complete,total:data.total};
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
