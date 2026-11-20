import { RestApiClient } from 'twenty-client-sdk/rest';
import { DASHBOARD_PREFIX, defaultDashboard, normalizeDashboard, type Dashboard, type StoredDashboard } from './dashboard-model.ts';

// Keep old settings untouched for rollback, but do not grant their administrative
// read permission to regular members just so they can render a dashboard.
type LegacySetting = {id:string;key:string;valueText:string|null;enabled?:boolean};
type DashboardRecord = {id:string;dashboardKey:string;configJson:string|null;enabled?:boolean};

function unwrap(response:unknown,key:string):unknown[] {
  const root=response&&typeof response==='object'?response as Record<string,unknown>:{};
  const data=root.data&&typeof root.data==='object'?root.data as Record<string,unknown>:root;
  if(!Array.isArray(data[key]))throw Error('DASHBOARD_STORAGE_RESPONSE');
  return data[key] as unknown[];
}
const keyFor=(id:string)=>DASHBOARD_PREFIX+id;

async function readDedicated(client:RestApiClient):Promise<DashboardRecord[]> {
  const response:unknown=await client.get('/rest/supportDashboards',{
    query:{filter:'dashboardKey[startsWith]:'+JSON.stringify(DASHBOARD_PREFIX),
      limit:60,fields:'id,dashboardKey,configJson,enabled',depth:0},
  });
  return unwrap(response,'supportDashboards') as DashboardRecord[];
}

async function readLegacy(client:RestApiClient):Promise<LegacySetting[]> {
  const response:unknown=await client.get('/rest/supportSettings',{
    query:{filter:'key[startsWith]:'+JSON.stringify(DASHBOARD_PREFIX),
      limit:60,fields:'id,key,valueText,enabled',depth:0},
  });
  return unwrap(response,'supportSettings') as LegacySetting[];
}

function parseDashboard(key:string,value:unknown):Dashboard|null {
  if(typeof value!=='string'||!key.startsWith(DASHBOARD_PREFIX))return null;
  try {
    const dashboard=normalizeDashboard(JSON.parse(value));
    return keyFor(dashboard.id)===key?dashboard:null;
  }catch{/* Ignore invalid or unsupported historical JSON without deleting it. */}
  return null;
}

export async function loadDashboards(client:RestApiClient=new RestApiClient()):Promise<StoredDashboard[]> {
  // Dedicated records are the authoritative source, including archived records
  // that must mask (not resurrect) corresponding legacy settings.
  const rows=await readDedicated(client);
  const seen=new Set<string>();
  const dashboards:StoredDashboard[]=[];
  for(const row of rows) {
    if(typeof row.dashboardKey!=='string'||!row.dashboardKey.startsWith(DASHBOARD_PREFIX))continue;
    seen.add(row.dashboardKey);
    if(row.enabled===false)continue;
    const dashboard=parseDashboard(row.dashboardKey,row.configJson);
    if(dashboard)dashboards.push({settingId:row.id,dashboard,storage:'dedicated'});
  }
  // A member without Settings permissions can still read new dashboards. A
  // denied legacy request cannot silently widen that member's privileges.
  let legacy:LegacySetting[]=[];
  try { legacy=await readLegacy(client); }catch{/* Access denied is expected for non-admin roles. */}
  for(const row of legacy){
    if(!row.key?.startsWith(DASHBOARD_PREFIX)||seen.has(row.key)||row.enabled===false)continue;
    const dashboard=parseDashboard(row.key,row.valueText);
    if(dashboard)dashboards.push({settingId:row.id,dashboard,storage:'legacy'});
  }
  return dashboards.sort((a,b)=>Number(b.dashboard.isDefault)-Number(a.dashboard.isDefault)||
    a.dashboard.title.localeCompare(b.dashboard.title));
}

export async function persistDashboard(client:RestApiClient,dashboard:Dashboard,recordId:string|null):Promise<string>{
  const normalized=normalizeDashboard({...dashboard,updatedAt:new Date().toISOString()});
  const configJson=JSON.stringify(normalized);
  if(configJson.length>45000)throw Error('DASHBOARD_CONFIG_TOO_LARGE');
  if(recordId){
    await client.patch('/rest/supportDashboards/'+encodeURIComponent(recordId),{configJson});
    return recordId;
  }
  const response:unknown=await client.post('/rest/supportDashboards',{
    dashboardKey:keyFor(normalized.id),configJson,enabled:true,
  });
  const root=response&&typeof response==='object'?response as Record<string,unknown>:{};
  const data=root.data&&typeof root.data==='object'?root.data as Record<string,unknown>:root;
  const row=data.createSupportDashboard as {id?:unknown}|undefined;
  if(typeof row?.id!=='string')throw Error('DASHBOARD_SAVE_RESPONSE');
  return row.id;
}

export async function removeDashboard(client:RestApiClient,recordId:string):Promise<void>{
  // Soft archive retains the stable unique key and masks any legacy copy.
  await client.patch('/rest/supportDashboards/'+encodeURIComponent(recordId),{enabled:false});
}

/**
 * Admin-only, explicit and idempotent migration. Copies valid legacy records
 * into the separately permissioned dashboard object without deleting or
 * modifying any old supportSetting; unique keys prevent duplicate copies.
 * Re-running safely skips dashboards already migrated or archived.
 */
export async function migrateLegacyDashboards(client:RestApiClient=new RestApiClient()):Promise<number> {
  const dedicated=await readDedicated(client);
  const existing=new Set(dedicated.map(row=>row.dashboardKey));
  const legacy=await readLegacy(client);
  let copied=0;
  for(const row of legacy){
    if(!row.key?.startsWith(DASHBOARD_PREFIX)||row.enabled===false||existing.has(row.key))continue;
    const dashboard=parseDashboard(row.key,row.valueText);
    if(!dashboard)continue;
    await persistDashboard(client,dashboard,null);
    existing.add(row.key);
    copied++;
  }
  return copied;
}

export function importDashboard(json:string):Dashboard{
  if(json.length>45000)throw Error('DASHBOARD_CONFIG_TOO_LARGE');
  const raw:unknown=JSON.parse(json);
  const entry=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
  if(entry.schemaVersion!==2)throw Error('DASHBOARD_IMPORT_VERSION');
  const dashboard=normalizeDashboard(entry.dashboard);
  return {...dashboard,id:defaultDashboard().id,isDefault:false,title:dashboard.title+' (importado)'};
}
export const exportDashboard=(dashboard:Dashboard):string=>
  JSON.stringify({schemaVersion:2,dashboard:normalizeDashboard(dashboard)},null,2);
