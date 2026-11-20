import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultDashboard,createDashboard,normalizeDashboard,normalizeWidget,makeWidget,periodFrom,MAX_WIDGETS,
  moveDashboardWidget,resizeDashboardWidget,
} from '../src/lib/dashboard-model.ts';
import {getRange,summarize,metricDelta} from '../src/lib/dashboard-analytics.ts';
import {importDashboard,exportDashboard} from '../src/lib/dashboard-store.ts';
import {getDashboardLink,readDashboardFromSearch} from '../src/lib/dashboard-links.ts';

test('starter dashboard provides configurable KPIs and visualizations',()=>{
  const dashboard=defaultDashboard();
  assert.equal(dashboard.isDefault,true);
  assert(dashboard.widgets.some(w=>w.kind==='kpi'&&w.aggregation==='ratio'));
  assert(dashboard.widgets.some(w=>w.kind==='line'));
  assert(dashboard.widgets.some(w=>w.kind==='hour'));
  assert.equal(normalizeDashboard(dashboard).widgets.length,dashboard.widgets.length);
});
test('dashboard config validation blocks injection and excessive widgets',()=>{
  const dashboard=createDashboard();
  dashboard.widgets=Array.from({length:MAX_WIDGETS+1},()=>makeWidget());
  assert.throws(()=>normalizeDashboard(dashboard),/TOO_MANY_WIDGETS/);
  const malicious=normalizeWidget({
    kind:'shortcut',source:'https://attacker.invalid',title:'Valid',
    url:'javascript:alert(1)',groupBy:'body',dateField:'password',
    filters:[{field:'password',operator:'eq',value:'secret'}],
  });
  assert.equal(malicious.source,'supportCases');
  assert.equal(malicious.url,'');
  assert.equal(malicious.filters.length,0);
});
test('period presets and custom periods are stable',()=>{
  const period=periodFrom({key:'custom',start:'2026-11-14',end:'2026-11-20'});
  assert.equal(period.key,'custom');
  const range=getRange(period);
  assert.equal(range.from?.getDate(),14);
  assert.equal(range.to?.getDate(),21);
  assert.equal(periodFrom({key:'custom'}).key,'custom');
  assert.equal(getRange({key:'today'},new Date(2026,10,20,12)).from?.getDate(),20);
});
test('metrics apply date, structured filters, ratios and comparisons correctly',()=>{
  const widget=makeWidget('kpi','supportCases');
  widget.aggregation='ratio';widget.ratioField='status';widget.ratioValue='AUTOMATED';
  widget.filters=[{field:'channel',operator:'eq',value:'WHATSAPP'}];
  widget.dateField='firstMessageAt';widget.compare=true;
  const dataset={complete:true,total:4,rows:[
    {id:'1',firstMessageAt:'2026-11-20T10:00:00',channel:'WHATSAPP',status:'AUTOMATED'},
    {id:'2',firstMessageAt:'2026-11-20T11:00:00',channel:'WHATSAPP',status:'NEW'},
    {id:'3',firstMessageAt:'2026-11-19T11:00:00',channel:'WHATSAPP',status:'NEW'},
    {id:'4',firstMessageAt:'2026-11-20T13:00:00',channel:'EMAIL',status:'AUTOMATED'},
  ]};
  const value=summarize(dataset,widget,{key:'today'},new Date(2026,10,20,15));
  assert.equal(value.value,50);
  assert.equal(value.previous,0);
  assert.equal(metricDelta(50,0),'Sin base');
});
test('dashboard JSON roundtrip creates independent ID on import',()=>{
  const dashboard=defaultDashboard();
  const parsed=importDashboard(exportDashboard(dashboard));
  assert.notEqual(parsed.id,dashboard.id);
  assert.equal(parsed.widgets.length,dashboard.widgets.length);
  assert.equal(parsed.isDefault,false);
  assert.throws(()=>importDashboard('{"schemaVersion":1,"dashboard":{}}'),/IMPORT_VERSION/);
});

test('timeline preserves missing dates and hourly chart has 24 buckets',()=>{
  const w=makeWidget('line','supportCases');
  w.dateField='firstMessageAt';
  const data={complete:true,total:2,rows:[
    {id:'a',firstMessageAt:'2026-11-18T13:00:00'},
    {id:'b',firstMessageAt:'2026-11-20T13:00:00'},
  ]};
  const time=new Date(2026,10,20,15);
  const series=summarize(data,w,{key:'7d'},time);
  assert.equal(series.points.length,7);
  assert(series.points.some(p=>p.name==='2026-11-19'&&p.value===0));
  w.kind='hour';
  const hours=summarize(data,w,{key:'7d'},time);
  assert.equal(hours.points.length,24);
});

test('widget reordering is immutable and preserves dimensions and IDs',()=>{
  const dashboard=defaultDashboard();
  const first=dashboard.widgets[0].id;
  const last=dashboard.widgets[dashboard.widgets.length-1].id;
  const reordered=moveDashboardWidget(dashboard,first,last);
  assert.notStrictEqual(reordered,dashboard);
  assert.equal(reordered.widgets.at(-1).id,first);
  assert.equal(dashboard.widgets[0].id,first);
  assert.equal(moveDashboardWidget(dashboard,first,'unknown'),dashboard);
  assert.equal(new Set(reordered.widgets.map(w=>w.id)).size,dashboard.widgets.length);
  assert.deepEqual(reordered.widgets.find(w=>w.id===first),dashboard.widgets[0]);
});

test('widget resize uses valid widths without mutating saved layouts',()=>{
  const dashboard=defaultDashboard();
  const id=dashboard.widgets[0].id;
  const enlarged=resizeDashboardWidget(dashboard,id,1);
  assert.equal(enlarged.widgets[0].width,4);
  assert.equal(dashboard.widgets[0].width,3);
  assert.equal(resizeDashboardWidget(dashboard,id,-1).widgets[0].width,3);
  const max=resizeDashboardWidget(enlarged,id,1);
  assert.equal(max.widgets[0].width,6);
  assert.deepEqual([...new Set(enlarged.widgets.map(w=>w.id))].length,dashboard.widgets.length);
});

test('dashboard direct links select only validated IDs and remain on current workspace',()=>{
  const current={origin:'https://twenty.example.es',pathname:'/page-layout/123',search:'?other=kept&filter=1'};
  const link=getDashboardLink(current,'d123456');
  assert.equal(link,'/page-layout/123?other=kept&filter=1&omniDashboard=d123456');
  assert.equal(readDashboardFromSearch(new URL(link,'https://twenty.example.es').search),'d123456');
  assert.equal(readDashboardFromSearch('?omniDashboard=javascript:alert(1)'),null);
  assert.equal(getDashboardLink(current,'../../evil'),null);
  assert.equal(getDashboardLink({...current,origin:'javascript:evil'},'d123456'),null);
});
