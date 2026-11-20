import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDashboardCatalog } from '../src/lib/dashboard-metadata.ts';
import { fetchWorkspaceDataset, summarize, workspaceWidgetFields } from '../src/lib/dashboard-analytics.ts';
import { createDashboard, makeWidget, normalizeWidget } from '../src/lib/dashboard-model.ts';
import { exportDashboard, importDashboard } from '../src/lib/dashboard-store.ts';

const field = (name, type, extra = {}) => ({ id: name, name, label: name, type, isActive: true, ...extra });
const recordType = (name, fieldsList) => ({
  id: name, namePlural: name, nameSingular: 'deal', labelPlural: 'Acuerdos', labelSingular: 'Acuerdo',
  isSystem: false, isActive: true, labelIdentifierFieldMetadataId: 'title', fieldsList,
});
const permission = (objectMetadataId, fields = {}) => ({ objectMetadataId, canReadObjectRecords: true, restrictedFields: fields });
const workspaceMetadata = {
  currentUser: { currentUserWorkspace: { objectPermissions: [permission('deals',{privateNote:{canRead:false}}), permission('nextDeals'), permission('supportSettings')] } },
  objects: {
    edges: [
      { node: recordType('deals', [
        field('id','UUID'), field('createdAt','DATE_TIME'), field('title','TEXT'),
        field('labels','ARRAY',{label:'Etiquetas'}), field('closed','BOOLEAN'),
        field('status','SELECT',{options:[{value:'WON',label:'Ganado'}]}),
        field('amount','NUMERIC'), field('personName','FULL_NAME',{label:'Cliente'}),
        field('secretText','TEXT'), field('privateNote','TEXT'), field('configJson','TEXT'),
      ]) },
      { node: recordType('hiddenDeals', [field('id','UUID'),field('title','TEXT')]) },
      { node: recordType('supportSettings', [field('id','UUID'),field('valueText','TEXT')]) },
    ],
    pageInfo: { hasNextPage: true, endCursor: 'next' },
  },
};

test('workspace catalog reads paginated metadata and includes the readable analytic fields', async () => {
  const requests = [];
  const catalog = await loadDashboardCatalog({ async query(input) {
    requests.push(input);
    if (!input.objects.__args.paging.after) return workspaceMetadata;
    return { objects: { edges: [{ node: recordType('nextDeals',[field('id','UUID')]) }], pageInfo: { hasNextPage: false } } };
  } });
  assert.deepEqual(requests.map(r => r.objects.__args.paging.after), [undefined, 'next']);
  assert.equal(catalog.get('deals').label, 'Acuerdos');
  assert.equal(catalog.get('deals').fields.get('labels').label, 'Etiquetas');
  assert.deepEqual(catalog.get('deals').fields.get('status').options, [{value:'WON',label:'Ganado'}]);
  assert.equal(catalog.get('deals').fields.get('amount').kind, 'number');
  assert.equal(catalog.get('deals').fields.get('closed').kind, 'boolean');
  assert(!catalog.get('deals').fields.has('secretText'));
  assert(!catalog.get('deals').fields.has('configJson'));
  assert(!catalog.get('deals').fields.has('privateNote'));
  assert(catalog.has('nextDeals'));
  assert(!catalog.has('hiddenDeals'));
  assert(!catalog.has('supportSettings'));
});

test('a dashboard imports and exports workspace fields without catalog access', () => {
  const dashboard = createDashboard();
  dashboard.widgets.push(normalizeWidget({
    source: 'deals', id: 'deals-by-label', groupBy: 'labels',
    aggregation: 'ratio', ratioField: 'labels', ratioValue: 'priority',
    dateField: 'createdAt', filters: [{field:'status', operator:'eq', value:'WON'}],
  }));
  const [widget] = importDashboard(exportDashboard(dashboard)).widgets;
  assert.equal(widget.source, 'deals');
  assert.equal(widget.groupBy, 'labels');
  assert.equal(widget.ratioField, 'labels');
  assert.equal(widget.filters[0]?.field, 'status');
});

test('projected columns come from readable workspace metadata rather than saved configuration', async () => {
  const catalog = await loadDashboardCatalog({ async query() {
    return { ...workspaceMetadata, objects:{ ...workspaceMetadata.objects, pageInfo:{hasNextPage:false} } };
  }});
  const source = catalog.get('deals');
  const signals = [];
  const api = { async get(path,{query}) {
    signals.push([path,query.fields,query.depth]);
    return { data: { deals: [{id:'one',labels:['priority'],personName:{firstName:'Ana',lastName:'Pérez'}}] } };
  }};
  const widget = normalizeWidget({kind:'table',source:'deals',groupBy:'labels',
    filters:[{field:'personName',operator:'eq',value:'Ana Pérez'}],dateField:'createdAt'});
  const data = await fetchWorkspaceDataset(source, workspaceWidgetFields(widget), api);
  assert.deepEqual(signals,[['/rest/deals','id,createdAt,labels,personName',0]]);
  assert.equal(data.rows[0].personName,'Ana Pérez');
  await assert.rejects(fetchWorkspaceDataset(source, ['secretText'], api), /DASHBOARD_FIELD_UNAVAILABLE/);
  assert.equal(signals.length, 1);
});

test('buckets de-duplicate array values per record and KPI, ratio and distinct count records or values correctly', () => {
  const rows = [
    { id:'c1', labels:['priority','enterprise','enterprise'] },
    { id:'c2', labels:['priority'] },
    { id:'c3', labels:[] },
    { id:'c4', labels:null },
  ];
  const data = { rows, complete:true, total:4 };
  const base = { ...makeWidget('bar'), source:'deals', groupBy:'labels' };
  const all = { key:'all' };
  const chart = summarize(data,base,all);
  assert.equal(chart.value,4);
  assert.equal(chart.overlappingGroups,true);
  assert.equal(chart.points.find(p => p.name==='enterprise')?.value,1);
  assert.equal(chart.points.find(p => p.name==='priority')?.value,2);
  assert.equal(summarize(data,{ ...base, filters:[{field:'labels',operator:'eq',value:'enterprise'}] },all).value,1);
  assert.equal(summarize(data,{ ...base, aggregation:'ratio', ratioField:'labels', ratioValue:'priority' },all).value,50);
  assert.equal(summarize(data,{ ...base, aggregation:'distinct', valueField:'labels' },all).value,2);
});

test('dataset page overlaps never inflate record count or hide missing records', async () => {
  const catalog = await loadDashboardCatalog({ async query() {
    return { ...workspaceMetadata, objects:{ ...workspaceMetadata.objects, pageInfo:{hasNextPage:false} } };
  }});
  const api = { async get(path,{query}) {
    return query.starting_after
      ? { data:{ deals:[{id:'second'},{id:'third'}] }, totalCount:4, pageInfo:{hasNextPage:false} }
      : { data:{ deals:[{id:'first'},{id:'second'}] }, totalCount:4, pageInfo:{hasNextPage:true,endCursor:'next'} };
  }};
  const data = await fetchWorkspaceDataset(catalog.get('deals'), [], api);
  assert.deepEqual(data.rows.map(row => row.id), ['first','second','third']);
  assert.equal(data.complete, false);
  assert.equal(data.total, 4);
});
