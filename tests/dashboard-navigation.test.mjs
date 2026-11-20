import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDashboardNavigationLink, isPublishedDashboardLink,
  listPublishedDashboardLinks, publishDashboardLink, renameDashboardLink, unpublishDashboardLink,
} from '../src/lib/dashboard-navigation.ts';

const operational='/page/1234abcd?omniDashboard=dashboard-1234';
const good=operational+'&omniShortcut=managed-v1';
const item=(overrides={})=>({
  id:'shared-1',name:'General',link:good,icon:'IconLayoutDashboard',
  position:1,type:'LINK',applicationId:null,userWorkspaceId:null,folderId:null,...overrides,
});
const mock=()=>{
  const entries=[item()];
  const mutations=[];
  const client={
    async query(){return {navigationMenuItems:entries.map(x=>({...x}))};},
    async mutation(q){
      mutations.push(q);
      if(q.createNavigationMenuItem){
        const input=q.createNavigationMenuItem.__args.input;
        const created=item({...input,id:'created-1',applicationId:null,userWorkspaceId:null,folderId:null});
        entries.push(created);
        return {createNavigationMenuItem:created};
      }
      if(q.updateNavigationMenuItem){
        const {id,update}=q.updateNavigationMenuItem.__args.input;
        const row=entries.find(x=>x.id===id);
        Object.assign(row,update);
        return {updateNavigationMenuItem:{id,name:row.name}};
      }
      if(q.deleteNavigationMenuItem){
        const {id}=q.deleteNavigationMenuItem.__args;
        const idx=entries.findIndex(x=>x.id===id);
        const [deleted]=entries.splice(idx,1);
        return {deleteNavigationMenuItem:deleted};
      }
      throw Error('Unknown metadata mutation');
    },
  };
  return {client,entries,mutations};
};

test('dashboard URL allowlist rejects external, Settings and ambiguous routes',()=>{
  assert.equal(normalizeDashboardNavigationLink(good),good);
  assert.equal(normalizeDashboardNavigationLink(operational),operational);
  for(const invalid of [
    'https://evil.example/page/1234?omniDashboard=dashboard-1234',
    '//evil.example/page/1234?omniDashboard=dashboard-1234',
    '/settings/apps?omniDashboard=dashboard-1234',
    '/page/1234?omniDashboard=dashboard-1234&redirect=https://evil.example',
    '/page/1234?omniDashboard=dashboard-1234&omniDashboard=other-1234',
    '/page/1234?omniDashboard=abc',
    '/page/1234#fragment?omniDashboard=dashboard-1234',
  ])assert.throws(()=>normalizeDashboardNavigationLink(invalid));
});
test('navigation manager excludes personal, app-owned and nested links',()=>{
  assert.equal(isPublishedDashboardLink(item()),true);
  assert.equal(isPublishedDashboardLink(item({link:operational})),false);
  assert.equal(isPublishedDashboardLink(item({applicationId:'app'})),false);
  assert.equal(isPublishedDashboardLink(item({userWorkspaceId:'person'})),false);
  assert.equal(isPublishedDashboardLink(item({folderId:'folder'})),false);
});
test('published links are created shared, renamed and removed without deleting dashboards',async()=>{
  const {client,mutations}=mock();
  const created=await publishDashboardLink({name:'Incidencias',link:'/page/1234abcd?omniDashboard=issues-1234'},client);
  assert.equal(created.link,'/page/1234abcd?omniDashboard=issues-1234&omniShortcut=managed-v1');
  assert.equal(mutations[0].createNavigationMenuItem.__args.input.userWorkspaceId,null);
  assert.equal((await listPublishedDashboardLinks(client)).length,2);
  await renameDashboardLink(created.id,'Incidencias activas',client);
  assert.equal((await listPublishedDashboardLinks(client)).find(x=>x.id===created.id).name,'Incidencias activas');
  await unpublishDashboardLink(created.id,client);
  assert.equal((await listPublishedDashboardLinks(client)).length,1);
});
test('refuse mutations of unrelated navigation entries',async()=>{
  const {client,entries,mutations}=mock();
  entries.push(item({id:'personal',userWorkspaceId:'user-1'}));
  await assert.rejects(()=>renameDashboardLink('personal','Changed',client),/LINK_NOT_MANAGED/);
  await assert.rejects(()=>unpublishDashboardLink('personal',client),/LINK_NOT_MANAGED/);
  await assert.rejects(()=>publishDashboardLink({name:'Duplicate',link:good},client),/ALREADY_PUBLISHED/);
  entries.push(item({id:'manual',link:'/page/xyz12345?omniDashboard=manual-1234'}));
  await assert.rejects(()=>unpublishDashboardLink('manual',client),/LINK_NOT_MANAGED/);
  assert.equal(mutations.length,0);
});
