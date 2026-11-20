import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { DASHBOARD_QUERY_KEY } from './dashboard-links.ts';

export type PublishedDashboardLink = {
  id:string;
  name:string;
  link:string;
  position:number;
  icon:string|null;
};

type NavigationRow = {
  id:string;
  name?:string|null;
  link?:string|null;
  icon?:string|null;
  position:number;
  type:string;
  applicationId?:string|null;
  userWorkspaceId?:string|null;
  folderId?:string|null;
};

const dashboardIdPattern=/^[a-zA-Z0-9-]{4,70}$/;
/** Provenance marker: never manage manually created dashboard links without this flag. */
const OWNERSHIP_KEY='omniShortcut';
const OWNERSHIP_VALUE='managed-v1';

/** Only relative operational Twenty routes are eligible, never Settings links or external URLs. */
export function normalizeDashboardNavigationLink(value:string):string {
  const input=value.trim();
  if(!input.startsWith('/page/')||input.startsWith('//')||input.includes('\\'))throw Error('INVALID_PAGE_LINK');
  let url:URL;
  try{url=new URL(input,'https://internal.invalid');}catch{throw Error('INVALID_PAGE_LINK');}
  if(url.origin!=='https://internal.invalid'||!url.pathname.startsWith('/page/'))throw Error('INVALID_PAGE_LINK');
  if(url.hash||url.username||url.password)throw Error('INVALID_PAGE_LINK');
  const ids=url.searchParams.getAll(DASHBOARD_QUERY_KEY);
  if(ids.length!==1||!dashboardIdPattern.test(ids[0]))throw Error('INVALID_DASHBOARD_ID');
  const keys=[...url.searchParams.keys()];
  if(keys.some(key=>key!==DASHBOARD_QUERY_KEY&&key!==OWNERSHIP_KEY))throw Error('INVALID_QUERY_PARAMETERS');
  const marker=url.searchParams.getAll(OWNERSHIP_KEY);
  if(marker.length>1||(marker.length===1&&marker[0]!==OWNERSHIP_VALUE))throw Error('INVALID_OWNERSHIP_MARKER');
  return url.pathname+'?'+DASHBOARD_QUERY_KEY+'='+encodeURIComponent(ids[0])+(marker.length?'&'+OWNERSHIP_KEY+'='+OWNERSHIP_VALUE:'');
}

export function isPublishedDashboardLink(row: NavigationRow, workspaceCustomApplicationId: string): boolean {
  if(row.type!=='LINK'||row.applicationId!==workspaceCustomApplicationId||row.userWorkspaceId!==null||row.folderId!==null||!row.link)return false;
  try{
    const canonical=normalizeDashboardNavigationLink(row.link);
    return canonical===row.link&&new URLSearchParams(canonical.split('?')[1]).get(OWNERSHIP_KEY)===OWNERSHIP_VALUE;
  }catch{return false;}
}

async function readNavigation(client: MetadataApiClient): Promise<{ rows: NavigationRow[]; workspaceCustomApplicationId: string }> {
  const { currentWorkspace, navigationMenuItems } = await client.query({
    currentWorkspace: { workspaceCustomApplicationId: true },
    navigationMenuItems:{
      id:true,name:true,link:true,icon:true,position:true,type:true,
      applicationId:true,userWorkspaceId:true,folderId:true,
    },
  });
  const workspaceCustomApplicationId = currentWorkspace?.workspaceCustomApplicationId;
  if (!workspaceCustomApplicationId || !Array.isArray(navigationMenuItems)) throw Error('NAVIGATION_UNAVAILABLE');
  return { rows: navigationMenuItems, workspaceCustomApplicationId };
}

export async function listPublishedDashboardLinks(client=new MetadataApiClient()):Promise<PublishedDashboardLink[]> {
  const { rows, workspaceCustomApplicationId } = await readNavigation(client);
  return rows.filter(row => isPublishedDashboardLink(row, workspaceCustomApplicationId))
    .sort((a,b)=>a.position-b.position)
    .map(row=>({id:row.id,name:row.name||'Dashboard',link:row.link!,position:row.position,icon:row.icon??null}));
}

export function validateNavigationName(name:string):string {
  const result=name.trim();
  if(result.length<1||result.length>80||/[\u0000-\u001f\u007f]/.test(result))throw Error('INVALID_NAME');
  return result;
}

/** Workspace-owned LINK at the root, not tied to the application lifecycle. */
export async function publishDashboardLink(input:{name:string;link:string;icon?:string},client=new MetadataApiClient()):Promise<PublishedDashboardLink> {
  const name=validateNavigationName(input.name);
  const normalized=normalizeDashboardNavigationLink(input.link);
  const link=normalized.includes('&'+OWNERSHIP_KEY+'=')?normalized:normalized+'&'+OWNERSHIP_KEY+'='+OWNERSHIP_VALUE;
  const { rows, workspaceCustomApplicationId } = await readNavigation(client);
  const duplicate=rows.find(row=>row.type==='LINK'&&row.userWorkspaceId===null&&row.link&&
    (row.link===link||row.link===normalized));
  if(duplicate)throw Error('ALREADY_PUBLISHED');
  const position=rows.filter(row=>row.userWorkspaceId===null&&row.folderId===null)
    .reduce((max,row)=>Math.max(max,row.position),-1)+1;
  const {createNavigationMenuItem}=await client.mutation({
    createNavigationMenuItem:{
      __args:{input:{name,link,icon:input.icon||'IconLayoutDashboard',type:'LINK',position,userWorkspaceId:null}},
      id:true,name:true,link:true,icon:true,position:true,applicationId:true,userWorkspaceId:true,folderId:true,type:true,
    },
  });
  if(!createNavigationMenuItem?.id||createNavigationMenuItem.link!==link)throw Error('PUBLISH_NOT_CONFIRMED');
  // Fail closed if the server silently creates a personal, app-owned or nested item.
  // Never delete a server-created item implicitly: an admin must inspect first.
  if (!isPublishedDashboardLink(createNavigationMenuItem, workspaceCustomApplicationId)) throw Error('PUBLISH_NOT_SHARED');
  return {id:createNavigationMenuItem.id,name:createNavigationMenuItem.name||name,link,icon:createNavigationMenuItem.icon||null,position:createNavigationMenuItem.position};
}

export async function renameDashboardLink(id:string,name:string,client=new MetadataApiClient()):Promise<void> {
  const { rows, workspaceCustomApplicationId } = await readNavigation(client);
  const item=rows.find(row=>row.id===id);
  if (!item || !isPublishedDashboardLink(item, workspaceCustomApplicationId)) throw Error('LINK_NOT_MANAGED');
  const {updateNavigationMenuItem}=await client.mutation({updateNavigationMenuItem:{__args:{input:{id,update:{name:validateNavigationName(name)}}},id:true,name:true}});
  if(updateNavigationMenuItem?.id!==id)throw Error('UPDATE_NOT_CONFIRMED');
}

export async function unpublishDashboardLink(id:string,client=new MetadataApiClient()):Promise<void> {
  const { rows, workspaceCustomApplicationId } = await readNavigation(client);
  const item=rows.find(row=>row.id===id);
  if (!item || !isPublishedDashboardLink(item, workspaceCustomApplicationId)) throw Error('LINK_NOT_MANAGED');
  const {deleteNavigationMenuItem}=await client.mutation({deleteNavigationMenuItem:{__args:{id},id:true}});
  if(deleteNavigationMenuItem?.id!==id)throw Error('DELETE_NOT_CONFIRMED');
}
