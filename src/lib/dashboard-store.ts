import { RestApiClient } from 'twenty-client-sdk/rest';
import { DASHBOARD_PREFIX, defaultDashboard, normalizeDashboard, type Dashboard, type StoredDashboard } from './dashboard-model.ts';

type Setting = {id:string;key:string;valueText:string|null};
function unwrap(response:unknown,key:string):unknown[] {
  const root=response&&typeof response==='object'?response as Record<string,unknown>:{};
  const data=root.data&&typeof root.data==='object'?root.data as Record<string,unknown>:root;
  if(!Array.isArray(data[key]))throw Error('DASHBOARD_SETTINGS_RESPONSE');
  return data[key] as unknown[];
}
const keyFor=(id:string)=>DASHBOARD_PREFIX+id;
export async function loadDashboards(client:RestApiClient=new RestApiClient()):Promise<StoredDashboard[]>{
  const response:unknown=await client.get('/rest/supportSettings',{
    query:{filter:'key[startsWith]:'+JSON.stringify(DASHBOARD_PREFIX),limit:60,fields:'id,key,valueText',depth:0},
  });
  const settings=unwrap(response,'supportSettings') as Setting[];
  const result:StoredDashboard[]=[];
  for(const setting of settings){
    if(!setting.key.startsWith(DASHBOARD_PREFIX)||!setting.valueText)continue;
    try {
      const dashboard=normalizeDashboard(JSON.parse(setting.valueText));
      if(keyFor(dashboard.id)!==setting.key)continue;
      result.push({settingId:setting.id,dashboard});
    }catch{/* Unknown version or malformed legacy configuration: skip safely. */}
  }
  return result.sort((a,b)=>Number(b.dashboard.isDefault)-Number(a.dashboard.isDefault)||a.dashboard.title.localeCompare(b.dashboard.title));
}
export async function persistDashboard(client:RestApiClient,dashboard:Dashboard,settingId:string|null):Promise<string>{
  const normalized=normalizeDashboard({...dashboard,updatedAt:new Date().toISOString()});
  const valueText=JSON.stringify(normalized);
  // The storage type is TEXT. Keep well below the backend's field limits.
  if(valueText.length>45000)throw Error('DASHBOARD_CONFIG_TOO_LARGE');
  if(settingId){
    await client.patch('/rest/supportSettings/'+encodeURIComponent(settingId),{valueText});
    return settingId;
  }
  const response:unknown=await client.post('/rest/supportSettings',{key:keyFor(normalized.id),valueType:'TEXT',valueText,enabled:true});
  const root=response&&typeof response==='object'?response as Record<string,unknown>:{};
  const data=root.data&&typeof root.data==='object'?root.data as Record<string,unknown>:root;
  const row=data.createSupportSetting as {id?:unknown}|undefined;
  if(typeof row?.id!=='string')throw Error('DASHBOARD_SAVE_RESPONSE');
  return row.id;
}
export async function removeDashboard(client:RestApiClient,settingId:string):Promise<void>{
  // Deliberately soft-remove: preserve history and avoid requiring destroy permissions.
  await client.patch('/rest/supportSettings/'+encodeURIComponent(settingId),{enabled:false,key:'omnichannel.dashboard.archived.'+settingId});
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
