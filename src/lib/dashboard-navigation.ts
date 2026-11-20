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
  name:string|null;
  link:string|null;
  icon:string|null;
  position:number;
  type:string;
  applicationId:string|null;
  userWorkspaceId:string|null;
  folderId:string|null;
};

const dashboardIdPattern=/^[a-zA-Z0-9-]{4,70}$/;

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
  if([...url.searchParams.keys()].some(key=>key!==DASHBOARD_QUERY_KEY))throw Error('INVALID_QUERY_PARAMETERS');
  return url.pathname+'?'+DASHBOARD_QUERY_KEY+'='+encodeURIComponent(ids[0]);
}

export function isPublishedDashboardLink(row:NavigationRow):boolean {
  if(row.type!=='LINK'||row.applicationId!==null||row.userWorkspaceId!==null||row.folderId!==null||!row.link)return false;
  try{return normalizeDashboardNavigationLink(row.link)===row.link;}catch{return false;}
}

async function readNavigation(client:MetadataApiClient):Promise<NavigationRow[]> {
  const {navigationMenuItems}=await client.query({
    navigationMenuItems:{
      id:true,name:true,link:true,icon:true,position:true,type:true,
      applicationId:true,userWorkspaceId:true,folderId:true,
    },
  });
  if(!Array.isArray(navigationMenuItems))throw Error('NAVIGATION_UNAVAILABLE');
  return navigationMenuItems as NavigationRow[];
}

export async function listPublishedDashboardLinks(client=new MetadataApiClient()):Promise<PublishedDashboardLink[]> {
  return (await readNavigation(client)).filter(isPublishedDashboardLink)
    .sort((a,b)=>a.position-b.position)
    .map(row=>({id:row.id,name:row.name||'Dashboard',link:row.link!,position:row.position,icon:row.icon}));
}

function checkedName(name:string):string {
  const result=name.trim();
  if(result.length<2||result.length>80)throw Error('INVALID_NAME');
  return result;
}

/** Workspace-owned LINK at the root, not tied to the application lifecycle. */
export async function publishDashboardLink(input:{name:string;link:string;icon?:string},client=new MetadataApiClient()):Promise<PublishedDashboardLink> {
  const name=checkedName(input.name);
  const link=normalizeDashboardNavigationLink(input.link);
  const rows=await readNavigation(client);
  const duplicate=rows.find(row=>isPublishedDashboardLink(row)&&row.link===link);
  if(duplicate)throw Error('ALREADY_PUBLISHED');
  const position=rows.filter(row=>row.userWorkspaceId===null&&row.folderId===null)
    .reduce((max,row)=>Math.max(max,row.position),-1)+1;
  const {createNavigationMenuItem}=await client.mutation({
    createNavigationMenuItem:{
      __args:{input:{name,link,icon:input.icon||'IconLayoutDashboard',type:'LINK',position}},
      id:true,name:true,link:true,icon:true,position:true,
    },
  });
  if(!createNavigationMenuItem?.id||createNavigationMenuItem.link!==link)throw Error('PUBLISH_NOT_CONFIRMED');
  return {id:createNavigationMenuItem.id,name:createNavigationMenuItem.name||name,link,icon:createNavigationMenuItem.icon||null,position:createNavigationMenuItem.position};
}

export async function renameDashboardLink(id:string,name:string,client=new MetadataApiClient()):Promise<void> {
  const rows=await readNavigation(client);
  const item=rows.find(row=>row.id===id);
  if(!item||!isPublishedDashboardLink(item))throw Error('LINK_NOT_MANAGED');
  await client.mutation({updateNavigationMenuItem:{__args:{input:{id,update:{name:checkedName(name)}}},id:true}});
}

export async function unpublishDashboardLink(id:string,client=new MetadataApiClient()):Promise<void> {
  const rows=await readNavigation(client);
  const item=rows.find(row=>row.id===id);
  if(!item||!isPublishedDashboardLink(item))throw Error('LINK_NOT_MANAGED');
  await client.mutation({deleteNavigationMenuItem:{__args:{id},id:true}});
}
