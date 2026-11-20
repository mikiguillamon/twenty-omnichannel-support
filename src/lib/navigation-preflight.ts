import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { IDS } from '../constants/ids.ts';

/**
 * Prevent Twenty 2.50 from cascading workspace-owned menu links when the
 * application-owned Omnichannel FOLDER is retired on the next major upgrade.
 *
 * This never deletes a navigation entity. Only workspace-owned children are
 * moved to the root; app-owned children stay untouched for regular app prune.
 */
type NavigationItem = {
  id:string;
  name:string|null;
  applicationId:string|null;
  folderId:string|null;
  type:string;
  userWorkspaceId:string|null;
  position:number;
};

type NavigationInspection = {
  folderId:string|null;
  folderName:string;
  toMove:NavigationItem[];
  childrenOwnedByApp:number;
  totalChildren:number;
};

const readItems = async(client:MetadataApiClient):Promise<{applicationId:string;items:NavigationItem[]}>=>{
  const { findOneApplication } = await client.query({
    findOneApplication:{
      __args:{universalIdentifier:IDS.APPLICATION},
      id:true,
    },
  });
  if(!findOneApplication?.id)throw Error('OMNI_APP_NOT_FOUND');
  const { navigationMenuItems } = await client.query({
    navigationMenuItems:{
      id:true,name:true,type:true,applicationId:true,folderId:true,userWorkspaceId:true,position:true,
    },
  });
  if(!Array.isArray(navigationMenuItems))throw Error('NAVIGATION_UNAVAILABLE');
  return {applicationId:findOneApplication.id,items:navigationMenuItems as NavigationItem[]};
};

export async function inspectLegacyNavigation(client:MetadataApiClient=new MetadataApiClient()):Promise<NavigationInspection> {
  const { applicationId,items }=await readItems(client);
  const folders=items.filter(item=>item.applicationId===applicationId&&item.type==='FOLDER'&&item.name==='Omnichannel');
  if(folders.length>1)throw Error('MULTIPLE_OMNICHANNEL_FOLDERS');
  if(folders.length===0)return {folderId:null,folderName:'Omnichannel',toMove:[],childrenOwnedByApp:0,totalChildren:0};
  const folder=folders[0];
  const children=items.filter(item=>item.folderId===folder.id);
  // Only workspace-owned, shared entries are moved. Per-user entries are
  // intentionally left alone and must be handled by each member themselves.
  const ownedByWorkspace=children.filter(item=>item.applicationId!==applicationId&&item.userWorkspaceId===null);
  return {folderId:folder.id,folderName:folder.name||'Omnichannel',toMove:ownedByWorkspace,
    childrenOwnedByApp:children.filter(item=>item.applicationId===applicationId).length,
    totalChildren:children.length};
}

export async function preserveWorkspaceNavigation(client:MetadataApiClient=new MetadataApiClient()):Promise<number>{
  const {folderId,toMove}=await inspectLegacyNavigation(client);
  if(!folderId||!toMove.length)return 0;
  // Revalidate every item immediately before writing. A stale folder
  // membership must never result in an unrelated navigation rewrite.
  const {items}=await readItems(client);
  const live=toMove.filter(item=>items.some(candidate=>candidate.id===item.id&&
    candidate.folderId===folderId&&candidate.applicationId===item.applicationId&&
    candidate.userWorkspaceId===null));
  if(live.length!==toMove.length)throw Error('NAVIGATION_CHANGED_REINSPECT');
  for(const row of live){
    await client.mutation({
      updateNavigationMenuItem:{
        __args:{input:{id:row.id,update:{folderId:null}}},
        id:true,
      },
    });
  }
  return live.length;
}
