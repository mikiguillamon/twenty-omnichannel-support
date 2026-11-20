import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectLegacyNavigation, preserveWorkspaceNavigation } from '../src/lib/navigation-preflight.ts';

const makeClient=()=>{
  const appId='app-1',folderId='folder-1';
  const entries=[
    {id:folderId,name:'Omnichannel',applicationId:appId,folderId:null,type:'FOLDER',userWorkspaceId:null,position:0},
    {id:'plugin-faq',name:'FAQs',applicationId:appId,folderId,type:'PAGE_LAYOUT',userWorkspaceId:null,position:1},
    {id:'shared-shortcut',name:'Mi dashboard',applicationId:'workspace-custom',folderId,type:'LINK',userWorkspaceId:null,position:2},
    {id:'personal-shortcut',name:'Mis enlaces',applicationId:'workspace-custom',folderId,type:'LINK',userWorkspaceId:'member-1',position:3},
    {id:'root',name:'Otro',applicationId:'workspace-custom',folderId:null,type:'LINK',userWorkspaceId:null,position:4},
  ];
  const calls=[];
  const client={
    async query(query){
      if(query.findOneApplication)return {findOneApplication:{id:appId}};
      if(query.navigationMenuItems)return {navigationMenuItems:entries.map(x=>({...x}))};
      throw Error('Unexpected metadata query');
    },
    async mutation(query){
      const mutation=query.updateNavigationMenuItem;
      const {id,update}=mutation.__args.input;
      const entry=entries.find(x=>x.id===id);
      if(!entry)throw Error('Unknown nav id');
      if(update.folderId!==null)throw Error('Must move to root');
      calls.push(id);
      entry.folderId=null;
      return {updateNavigationMenuItem:{id}};
    },
  };
  return {client,calls,entries,appId,folderId};
};

test('navigation preflight classifies workspace and user shortcuts without touching app-owned items',async()=>{
  const {client}=makeClient();
  const result=await inspectLegacyNavigation(client);
  assert.equal(result.totalChildren,3);
  assert.equal(result.childrenOwnedByApp,1);
  assert.deepEqual(result.toMove.map(x=>x.id),['shared-shortcut']);
});

test('preflight only moves shared workspace items, preserving ids and destinations',async()=>{
  const {client,calls,entries}=makeClient();
  assert.equal(await preserveWorkspaceNavigation(client),1);
  assert.equal(await preserveWorkspaceNavigation(client),0);
  assert.deepEqual(calls,['shared-shortcut']);
  assert.equal(entries.find(x=>x.id==='shared-shortcut').folderId,null);
  assert.equal(entries.find(x=>x.id==='personal-shortcut').folderId,'folder-1');
  assert.equal(entries.find(x=>x.id==='plugin-faq').folderId,'folder-1');
});
