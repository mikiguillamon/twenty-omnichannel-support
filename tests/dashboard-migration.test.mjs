import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadDashboards, migrateLegacyDashboards, persistDashboard, removeDashboard,
} from '../src/lib/dashboard-store.ts';
import { defaultDashboard, DASHBOARD_PREFIX } from '../src/lib/dashboard-model.ts';

const fixture = () => {
  const original=defaultDashboard();
  const key=DASHBOARD_PREFIX+original.id;
  const legacy=[{id:'old-1',key,valueText:JSON.stringify(original),enabled:true}];
  const records=[];
  let next=0;
  const fake={
    async get(path){
      if(path==='/rest/supportDashboards')return {data:{supportDashboards:records.map(row=>({...row}))}};
      if(path==='/rest/supportSettings')return {data:{supportSettings:legacy.map(row=>({...row}))}};
      throw Error('Unexpected GET: '+path);
    },
    async post(path,payload){
      if(path!=='/rest/supportDashboards')throw Error('Unexpected POST: '+path);
      if(records.some(row=>row.dashboardKey===payload.dashboardKey))throw Error('duplicate index');
      const row={id:'new-'+(++next),...payload};
      records.push(row);
      return {data:{createSupportDashboard:{id:row.id}}};
    },
    async patch(path,payload){
      const id=path.replace('/rest/supportDashboards/','');
      const row=records.find(row=>row.id===id);
      if(!row)throw Error('Unknown dashboard');
      Object.assign(row,payload);
      return {data:{updateSupportDashboard:row}};
    },
  };
  return {fake,original,legacy,records,key};
};

test('legacy migration is non-destructive, idempotent, and preserves dashboard ids',async()=>{
  const {fake,original,legacy,records}=fixture();
  assert.equal((await loadDashboards(fake))[0].storage,'legacy');
  assert.equal(await migrateLegacyDashboards(fake),1);
  assert.equal(await migrateLegacyDashboards(fake),0);
  assert.equal(records.length,1);
  assert.equal(legacy.length,1);
  const [row]=await loadDashboards(fake);
  assert.equal(row.storage,'dedicated');
  assert.equal(row.dashboard.id,original.id);
  assert.equal(row.dashboard.widgets[0].id,original.widgets[0].id);
  assert.equal(row.dashboard.widgets[0].height,original.widgets[0].height);
});

test('archived new records mask legacy copies rather than resurrecting old dashboards',async()=>{
  const {fake}=fixture();
  await migrateLegacyDashboards(fake);
  const row=(await loadDashboards(fake))[0];
  await removeDashboard(fake,row.settingId);
  assert.deepEqual(await loadDashboards(fake),[]);
});

test('an archived dashboard on a later page still masks its legacy copy', async () => {
  const { fake, key, records } = fixture();
  records.push(...Array.from({ length: 60 }, (_, index) => ({
    id: 'archived-' + index, dashboardKey: DASHBOARD_PREFIX + 'archived-' + index, enabled: false,
  })), { id: 'archived-legacy', dashboardKey: key, enabled: false });
  const get = fake.get.bind(fake);
  fake.get = async (path, options) => {
    if (path !== '/rest/supportDashboards') return get(path, options);
    if (options.query.starting_after === 'second-page') {
      return { data: { supportDashboards: records.slice(60) }, pageInfo: { hasNextPage: false } };
    }
    return {
      data: { supportDashboards: records.slice(0, 60) },
      pageInfo: { hasNextPage: true, endCursor: 'second-page' },
    };
  };

  assert.deepEqual(await loadDashboards(fake), []);
  assert.equal(await migrateLegacyDashboards(fake), 0);
});

test('non-admins can read dedicated dashboards when access to supportSettings is denied',async()=>{
  const {fake,original}=fixture();
  await migrateLegacyDashboards(fake);
  const limited={
    get(path,params){
      if(path==='/rest/supportSettings')throw Object.assign(Error('forbidden'),{status:403});
      return fake.get(path,params);
    },
  };
  const rows=await loadDashboards(limited);
  assert.equal(rows.length,1);
  assert.equal(rows[0].dashboard.id,original.id);
});

test('updated dashboard is saved in dedicated object, never patching settings',async()=>{
  const {fake,records,original,legacy}=fixture();
  const id=await persistDashboard(fake,original,null);
  await persistDashboard(fake,{...original,title:'Operativa'},id);
  assert.equal(records[0].id,id);
  assert.equal(records[0].dashboardKey,DASHBOARD_PREFIX+original.id);
  assert.equal(JSON.parse(records[0].configJson).title,'Operativa');
  assert.equal(JSON.parse(legacy[0].valueText).title,original.title);
});
