import { useEffect, useState } from 'react';
import { useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { effectivePolicy, getChannels, updateChannelPolicy, validatePolicy } from '../lib/support-channels.ts';
import type { ChannelPolicy, ChannelType, SupportChannel } from '../lib/support-channels.ts';

const channelLabel:Record<ChannelType,string> = {
  EMAIL:'Email',WHATSAPP:'WhatsApp',INSTAGRAM:'Instagram',TELEGRAM:'Telegram',PHONE:'Llamadas',
};

export function ChannelPolicies() {
  const dark=useColorScheme()==='dark';
  const [channels,setChannels]=useState<SupportChannel[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState('');
  const [policy,setPolicy]=useState<ChannelPolicy|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [feedback,setFeedback]=useState('');
  const border=dark?'#455164':'#E1E6ED';
  const muted=dark?'#AAB6C6':'#657385';
  const surface=dark?'#252D38':'#FFFFFF';
  const canvas=dark?'#1D232C':'#F8FAFC';
  const fg=dark?'#F4F6FA':'#20252D';
  const field={padding:'9px 10px',border:'1px solid '+border,borderRadius:7,width:'100%',boxSizing:'border-box' as const,
    background:surface,color:fg,fontSize:13,fontFamily:'inherit'};
  const button={padding:'9px 13px',border:'1px solid '+border,borderRadius:7,background:surface,color:fg,cursor:'pointer',fontSize:13,fontFamily:'inherit'};
  useEffect(()=>{
    let live=true;setLoading(true);setLoadError('');
    getChannels().then(rows=>{if(live)setChannels(rows.sort((a,b)=>(a.name||a.code||'').localeCompare(b.name||b.code||'')));})
      .catch(()=>{if(live)setLoadError('No se pudieron cargar los canales. Comprueba los permisos de Twenty.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[revision]);
  const current=channels.find(c=>c.id===selected);
  const kind=current?.channelType??'EMAIL';
  function choose(id:string) {
    setSelected(id);setError('');setFeedback('');
    const channel=channels.find(c=>c.id===id);
    setPolicy(channel?effectivePolicy(channel):null);
  }
  function setValue<K extends keyof ChannelPolicy>(key:K,value:ChannelPolicy[K]){
    setPolicy(old=>old?{...old,[key]:value}:old);
  }
  async function save(){
    if(!current||!policy)return;
    const issue=validatePolicy(policy,kind);
    if(issue){setError(issue);return;}
    setSaving(true);setError('');setFeedback('');
    try {
      await updateChannelPolicy(current.id,kind,policy);
      setFeedback('Configuración guardada. Omnichannel aplicará automáticamente la continuidad y reapertura al registrar mensajes nuevos.');
      setRevision(n=>n+1);
    }catch {
      setError('No se pudo guardar. Comprueba los permisos y que el workspace tenga el esquema actualizado.');
    }finally {setSaving(false);}
  }
  return <div style={{padding:'20px 22px 24px',background:canvas,color:fg,fontFamily:'inherit',minHeight:'100%',display:'flex',flexDirection:'column',gap:16}}>
    <header>
      <h1 style={{fontSize:22,fontWeight:650,margin:0,letterSpacing:'-0.02em'}}>Gestión de consultas por canal</h1>
      <p style={{fontSize:13,color:muted}}>La API de Omnichannel aplica estas reglas al recibir cada mensaje nuevo. No necesitas buscar previamente la conversación desde n8n. La clasificación semántica con IA, si se utiliza, sigue siendo externa.</p>
    </header>
    {loading&&<p>Cargando canales…</p>}
    {loadError&&<p role="alert">{loadError}</p>}
    {!loading&&!loadError&&channels.length===0&&<p>Crea un canal antes de configurar sus consultas.</p>}
    {!loading&&!loadError&&channels.length>0&&<>
      <label>Canal
        <select style={field} value={selected} onChange={e=>choose(e.target.value)}>
          <option value="">Selecciona un canal…</option>
          {channels.map(ch=><option key={ch.id} value={ch.id}>{ch.name||ch.code||'Canal'} ({channelLabel[ch.channelType??'EMAIL']})</option>)}
        </select>
      </label>
      {current&&policy&&<section style={{background:surface,border:'1px solid '+border,borderRadius:10,padding:16,display:'flex',flexDirection:'column',gap:15}}>
        <div>
          <strong>{current.name||current.code||'Canal'}</strong>
          <p style={{fontSize:12,color:muted}}>{channelLabel[kind]} · {current.code||'Sin código'} · Estado {current.status||'DISABLED'}</p>
        </div>
        <label>Estrategia de agrupación
          <select style={field} value={policy.groupingMode} onChange={e=>setValue('groupingMode',e.target.value as ChannelPolicy['groupingMode'])}>
            {kind==='EMAIL'?<>
              <option value="THREAD">Una consulta por hilo de correo (recomendado)</option>
              <option value="MESSAGE">Una consulta por correo entrante</option>
              <option value="MANUAL">Decisión manual</option>
            </>:<>
              <option value="HYBRID">Agrupación automática: identidad y continuidad (recomendado)</option>
              <option value="SESSION">Agrupación por sesión de actividad</option>
              <option value="MESSAGE">Una consulta por mensaje entrante</option>
              <option value="MANUAL">Decisión manual</option>
            </>}
          </select>
        </label>
        {kind!=='EMAIL'&&<p style={{fontSize:12,color:muted,margin:0}}>En Agrupación automática, Twenty conserva el hilo del mismo contacto y canal si existe una única conversación compatible dentro de la ventana de continuidad. Las notificaciones automáticas también pueden continuarla; cuando hay varias conversaciones posibles, aplica la política de dudas. Las consultas resueltas solo se reabren dentro de la ventana indicada y con un nuevo estado activo. La app no clasifica semánticamente el contenido.</p>}
        {kind==='EMAIL'&&<p style={{fontSize:12,color:muted,margin:0}}>
          Por hilo: el correo original y sus respuestas se guardan en una consulta, usando el identificador de hilo o cabeceras del proveedor.
          Por mensaje: cada correo entrante inicia una consulta, pero las respuestas a ese correo deben vincularse a su consulta.
        </p>}
        {kind!=='EMAIL'&&policy.groupingMode!=='MANUAL'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:12}}>
          <label>Continuidad de actividad (horas)
            <input type="number" min={1} max={8760} step={1} value={policy.continuationHours} style={field}
              onChange={e=>setValue('continuationHours',Number(e.target.value))}/>
          </label>
          <label>Ventana de reapertura (horas)
            <input type="number" min={0} max={8760} step={1} value={policy.reopenHours} style={field}
              onChange={e=>setValue('reopenHours',Number(e.target.value))}/>
          </label>
        </div>}
        {policy.groupingMode==='HYBRID'&&<label style={{display:'flex',gap:9,alignItems:'center'}}>
          <input type="checkbox" checked={policy.semanticClassification} onChange={e=>setValue('semanticClassification',e.target.checked)}/>
          Consultar un clasificador en n8n si hay dudas sobre el asunto
        </label>}
        {policy.groupingMode==='HYBRID'&&policy.semanticClassification&&<label>
          Confianza mínima ({Math.round(policy.minClassificationConfidence*100)} %)
          <input type="range" style={{width:'100%'}} min={50} max={100} step={5}
            value={Math.round(policy.minClassificationConfidence*100)}
            onChange={e=>setValue('minClassificationConfidence',Number(e.target.value)/100)}/>
        </label>}
        <label>Cuando no se pueda asociar con seguridad
          <select style={field} value={policy.ambiguousAction}
            onChange={e=>setValue('ambiguousAction',e.target.value as ChannelPolicy['ambiguousAction'])}>
            <option value="REVIEW">Enviar a revisión sin perder el mensaje</option>
            <option value="NEW">Crear una consulta independiente</option>
          </select>
        </label>
        {policy.groupingMode!=='MANUAL'&&<label style={{display:'flex',gap:9,alignItems:'center'}}>
          <input type="checkbox" checked={policy.autoCloseEnabled} onChange={e=>setValue('autoCloseEnabled',e.target.checked)}/>
          Permitir cierre por inactividad mediante un workflow externo
        </label>}
        {policy.groupingMode!=='MANUAL'&&policy.autoCloseEnabled&&<label>
          Días sin actividad para cerrar
          <input type="number" min={1} max={365} step={1} style={field} value={policy.autoCloseDays}
            onChange={e=>setValue('autoCloseDays',Number(e.target.value))}/>
        </label>}
        <p style={{fontSize:12,color:muted,margin:0}}>
          Nunca cerrar automáticamente consultas HUMAN_REQUIRED. Los parámetros de inactividad no son límites impuestos por WhatsApp o Telegram.
          Las respuestas que citan un mensaje conocido deben recuperar su consulta antes de aplicar reglas de tiempo.
        </p>
        {error&&<p role="alert" style={{fontSize:13,color:'#DC2626'}}>{error}</p>}
        {feedback&&<p role="status" style={{fontSize:13,color:dark?'#86EFAC':'#166534'}}>{feedback}</p>}
        <div><button type="button" style={button} disabled={saving} onClick={()=>void save()}>{saving?'Guardando…':'Guardar configuración'}</button></div>
      </section>}
    </>}
    {channels.length>=100&&<p style={{fontSize:12,color:muted}}>Se muestran hasta 100 canales. Usa la tabla nativa para acceder al resto.</p>}
  </div>;
}
