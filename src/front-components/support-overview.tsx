import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { getChannels } from '../lib/support-channels.ts';
import type { SupportChannel } from '../lib/support-channels.ts';
import { readTotalCount } from '../lib/overview.ts';

type Metric = 'total' | 'pendingHuman' | 'technicalError' | 'incorrect';
type Totals = Record<Metric,number|null>;
const KPI_LIST: {key:Metric;title:string}[] = [
  {key:'total',title:'Conversaciones registradas'},
  {key:'pendingHuman',title:'Necesitan atención humana'},
  {key:'technicalError',title:'Errores técnicos'},
  {key:'incorrect',title:'Evaluaciones incorrectas'},
];
const DEFAULT_VISIBLE: Metric[]=['total','pendingHuman','technicalError','incorrect'];
const CONFIG_KEY='omnichannel.dashboard.visibleKpis';

function extractSettings(response:unknown): {id:string;valueText:string|null}[] {
  if(!response||typeof response!=='object')return [];
  const root=response as Record<string,unknown>;
  const data=root.data && typeof root.data==='object'?root.data as Record<string,unknown>:root;
  return Array.isArray(data.supportSettings)?data.supportSettings as {id:string;valueText:string|null}[]:[];
}
function parseVisibility(raw:string|null|undefined): Metric[] {
  if(!raw)return DEFAULT_VISIBLE;
  try{
    const parsed:unknown=JSON.parse(raw);
    if(!Array.isArray(parsed))return DEFAULT_VISIBLE;
    return KPI_LIST.map(k=>k.key).filter(key=>parsed.includes(key));
  }catch{return DEFAULT_VISIBLE;}
}

function Overview() {
  const dark=useColorScheme()==='dark';
  const [totals,setTotals]=useState<Totals>({total:null,pendingHuman:null,technicalError:null,incorrect:null});
  const [errors,setErrors]=useState<Metric[]>([]);
  const [refresh,setRefresh]=useState(0);
  const [channels,setChannels]=useState<SupportChannel[]|null>(null);
  const [channelsError,setChannelsError]=useState(false);
  const [visible,setVisible]=useState<Metric[]>(DEFAULT_VISIBLE);
  const [settingId,setSettingId]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [configError,setConfigError]=useState('');
  const [editing,setEditing]=useState(false);

  useEffect(()=>{
    let live=true;
    const client=new RestApiClient();
    const requests: {key:Metric;path:string;filter?:string}[] = [
      {key:'total',path:'/rest/supportCases'},
      {key:'pendingHuman',path:'/rest/supportCases',filter:'status[eq]:"HUMAN_REQUIRED"'},
      {key:'technicalError',path:'/rest/supportCases',filter:'technicalStatus[eq]:"ERROR"'},
      {key:'incorrect',path:'/rest/supportEvaluations',filter:'verdict[eq]:"INCORRECT"'},
    ];
    setTotals({total:null,pendingHuman:null,technicalError:null,incorrect:null});
    setErrors([]);
    void Promise.all(requests.map(async req=>{
      try{
        const result:unknown=await client.get(req.path,{query:{limit:1,fields:'id',...(req.filter?{filter:req.filter}:{})}});
        if(!live)return;
        const count=readTotalCount(result);
        if(count===null)throw new Error('Missing totalCount');
        setTotals(prev=>({...prev,[req.key]:count}));
      }catch {
        if(live)setErrors(prev=>[...prev,req.key]);
      }
    }));
    return()=>{live=false;};
  },[refresh]);

  useEffect(()=>{
    let live=true;setChannelsError(false);
    void getChannels().then(data=>{if(live)setChannels(data);}).catch(()=>{if(live){setChannels(null);setChannelsError(true);}});
    return()=>{live=false;};
  },[refresh]);

  useEffect(()=>{
    let live=true;
    const client=new RestApiClient();
    void client.get('/rest/supportSettings',{query:{filter:'key[eq]:"'+CONFIG_KEY+'"',limit:2,fields:'id,valueText'}})
      .then((response:unknown)=>{
        if(!live)return;
        const setting=extractSettings(response)[0];
        if(setting){setSettingId(setting.id);setVisible(parseVisibility(setting.valueText));}
      }).catch(()=>{if(live)setConfigError('No se pudo leer la configuración del dashboard.');});
    return()=>{live=false;};
  },[]);

  async function saveVisibility(next:Metric[]) {
    setSaving(true);setConfigError('');
    try {
      const client=new RestApiClient();
      const valueText=JSON.stringify(next);
      if(settingId)await client.patch('/rest/supportSettings/'+encodeURIComponent(settingId),{valueText});
      else {
        const response:unknown=await client.post('/rest/supportSettings',{key:CONFIG_KEY,valueType:'TEXT',valueText,enabled:true});
        const obj=response&&typeof response==='object'?response as Record<string,unknown>:{};
        const data=obj.data && typeof obj.data==='object'?obj.data as Record<string,unknown>:{};
        const record=data.createSupportSetting as {id?:string}|undefined;
        if(record?.id)setSettingId(record.id);
      }
      setVisible(next);
    }catch{setConfigError('No se pudo guardar esta preferencia. Revisa los permisos de Ajustes.');}
    finally{setSaving(false);}
  }
  const border=dark?'1px solid #475569':'1px solid #CBD5E1';
  const muted=dark?'#CBD5E1':'#64748B';
  const activeChannels=(channels||[]).filter(c=>c.status==='ACTIVE');
  return (
    <div style={{padding:12,display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <strong>Indicadores de Omnichannel</strong>
        <div style={{display:'flex',gap:10}}>
          <button type="button" onClick={()=>setEditing(v=>!v)}>{editing?'Cerrar configuración':'Personalizar indicadores'}</button>
          <button type="button" onClick={()=>setRefresh(v=>v+1)}>Actualizar</button>
        </div>
      </div>
      {editing && <section style={{border,padding:12,borderRadius:10}}>
        <strong>Indicadores visibles en este workspace</strong>
        <div style={{display:'flex',flexWrap:'wrap',gap:14,marginTop:12}}>
          {KPI_LIST.map(item=><label key={item.key} style={{display:'flex',gap:6,alignItems:'center'}}>
            <input type="checkbox" disabled={saving} checked={visible.includes(item.key)}
              onChange={e=>void saveVisibility(e.target.checked?[...visible,item.key]:visible.filter(k=>k!==item.key))}/>{item.title}
          </label>)}
        </div>
        <p style={{fontSize:12,color:muted}}>Para gráficos, periodos, agrupaciones y widgets adicionales utiliza los dashboards nativos de Twenty: cada workspace mantiene sus propios paneles.</p>
      </section>}
      {configError && <p role="alert">{configError}</p>}
      <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
        {KPI_LIST.filter(item=>visible.includes(item.key)).map(item=><section key={item.key}
          style={{flex:'1 1 185px',padding:16,border,borderRadius:10}}>
          <div style={{fontSize:12,color:muted}}>{item.title}</div>
          <strong style={{fontSize:28}}>{errors.includes(item.key)?'—':totals[item.key]===null?'…':totals[item.key]}</strong>
          {errors.includes(item.key)&&<p role="alert" style={{fontSize:12}}>No se ha podido consultar este indicador.</p>}
        </section>)}
      </div>
      <section style={{border,borderRadius:10,padding:14}}>
        <strong>Canales activos del workspace</strong>
        {channelsError && <p role="alert">No se pudieron cargar los canales.</p>}
        {!channelsError && channels===null && <p>Cargando canales…</p>}
        {!channelsError && channels!==null && activeChannels.length===0 && <p>No hay canales activos.</p>}
        {!channelsError && activeChannels.map(channel=><p key={channel.id} style={{fontSize:13}}>
          {channel.channelType==='PHONE'?'Llamada':channel.channelType==='WHATSAPP'?'WhatsApp':channel.channelType==='INSTAGRAM'?'Instagram':channel.channelType==='TELEGRAM'?'Telegram':'Email'} · {channel.name||channel.code||'Sin nombre'}
        </p>)}
        {!channelsError && channels!==null && <p style={{fontSize:12,color:muted}}>{activeChannels.length} activo(s) de {channels.length}. El estado activo no implica que el proveedor esté operativo.</p>}
      </section>
      <p style={{fontSize:12,color:muted}}>Datos acumulados de este workspace. Personaliza las gráficas y los filtros por fecha en los dashboards nativos de Twenty.</p>
    </div>
  );
}
export default defineFrontComponent({
  universalIdentifier:IDS.FRONT_SUPPORT_OVERVIEW,
  name:'support-overview',
  description:'Indicadores de conversaciones configurables por workspace, con fuente REST.',
  component:Overview,
});
