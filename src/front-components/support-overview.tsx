import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { getChannels } from '../lib/support-channels.ts';
import type { SupportChannel } from '../lib/support-channels.ts';

type Totals = {total:number|null; pendingHuman:number|null; technicalError:number|null; incorrect:number|null};
const graphql = `query OmnichannelSupportOverview {
  allCases: supportCases { totalCount }
  pendingHuman: supportCases(filter:{ status: { eq: HUMAN_REQUIRED } }) { totalCount }
  technicalError: supportCases(filter:{ technicalStatus: { eq: ERROR } }) { totalCount }
  incorrect: supportEvaluations(filter:{ verdict: { eq: INCORRECT } }) { totalCount }
}`;
function Overview() {
  const dark=useColorScheme()==='dark';
  const [totals,setTotals]=useState<Totals>({total:null,pendingHuman:null,technicalError:null,incorrect:null});
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [channels,setChannels]=useState<SupportChannel[]|null>(null);
  const [channelsError,setChannelsError]=useState(false);
  useEffect(()=>{
    let active=true;
    setError('');
    new RestApiClient().post('/graphql',{query:graphql}).then((result:unknown)=>{
      if(!active)return;
      const root=result && typeof result==='object'?result as Record<string,unknown>:{};
      const data=root.data && typeof root.data==='object'?root.data as Record<string,unknown>:{};
      const count=(key:string) => {
        const v=data[key] && typeof data[key]==='object' ? (data[key] as Record<string,unknown>).totalCount : null;
        return typeof v==='number'?v:null;
      };
      if(Array.isArray(root.errors) || count('allCases')===null){throw new Error('GraphQL data not available');}
      setTotals({total:count('allCases'),pendingHuman:count('pendingHuman'),technicalError:count('technicalError'),incorrect:count('incorrect')});
    }).catch(()=>{if(active)setError('Métricas no disponibles: comprueba los permisos y los campos GraphQL del workspace.');});
    return()=>{active=false;};
  },[refresh]);
  useEffect(()=>{
    let live=true;setChannelsError(false);
    getChannels().then(data=>{if(live)setChannels(data);}).catch(()=>{if(live){setChannels(null);setChannelsError(true);}});
    return()=>{live=false;};
  },[refresh]);
  const activeChannels=(channels||[]).filter(c=>c.status==='ACTIVE');
  const items=[
    {title:'Consultas registradas',value:totals.total},
    {title:'Necesitan atención humana',value:totals.pendingHuman},
    {title:'Errores técnicos',value:totals.technicalError},
    {title:'Evaluaciones incorrectas',value:totals.incorrect},
  ];
  return (
    <div style={{padding:'12px',display:'flex',flexDirection:'column',gap:'10px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <strong>Resumen de atención</strong><button onClick={()=>setRefresh(v=>v+1)}>Actualizar</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div style={{display:'flex',flexWrap:'wrap',gap:'10px'}}>
        {items.map(item=><section key={item.title} style={{flex:'1 1 185px',padding:'16px',border:dark?'1px solid #475569':'1px solid #CBD5E1',borderRadius:'10px'}}>
          <div style={{fontSize:'12px',color:dark?'#CBD5E1':'#64748B'}}>{item.title}</div>
          <strong style={{fontSize:'28px'}}>{error?'—':item.value===null?'…':item.value}</strong>
        </section>)}
      </div>
      <section style={{border:dark?'1px solid #475569':'1px solid #CBD5E1',borderRadius:'10px',padding:14}}>
        <strong>Canales activos del workspace</strong>
        {channelsError && <p role="alert">No se pudieron cargar los canales. Comprueba permisos.</p>}
        {!channelsError && channels===null && <p>Cargando canales…</p>}
        {!channelsError && channels!==null && activeChannels.length===0 && <p>No hay canales activos. Configúralos desde «Canales».</p>}
        {!channelsError && activeChannels.map(channel=>
          <p key={channel.id} style={{fontSize:13}}>{channel.channelType==='WHATSAPP'?'WhatsApp':channel.channelType==='INSTAGRAM'?'Instagram':channel.channelType==='TELEGRAM'?'Telegram':'Email'} · {channel.name||channel.code||'Sin nombre'}</p>)}
        {!channelsError && channels!==null && <p style={{fontSize:12,color:dark?'#CBD5E1':'#64748B'}}>
          {activeChannels.length} activo(s) de {channels.length}. El estado no indica que el proveedor esté funcionando.
        </p>}
      </section>
      <p style={{fontSize:'12px',color:dark?'#CBD5E1':'#64748B'}}>Valores acumulados, incluidos los canales desactivados. Los periodos y tendencias se configuran en los dashboards nativos de Twenty.</p>
    </div>
  );
}
export default defineFrontComponent({
  universalIdentifier:IDS.FRONT_SUPPORT_OVERVIEW,
  name:'support-overview',
  description:'Indicadores globales basados en el total de registros, con acceso a los datos desde Twenty.',
  component:Overview,
});
