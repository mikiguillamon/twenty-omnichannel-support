import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { effectivePolicy, getChannels, updateChannelPolicy, validatePolicy } from '../lib/support-channels.ts';
import type { ChannelPolicy, ChannelType, SupportChannel } from '../lib/support-channels.ts';

const channelLabel:Record<ChannelType,string> = {
  EMAIL:'Email',WHATSAPP:'WhatsApp',INSTAGRAM:'Instagram',TELEGRAM:'Telegram',
};
const groupLabel:Record<ChannelPolicy['groupingMode'],string> = {
  THREAD:'Por hilo',MESSAGE:'Por mensaje entrante',HYBRID:'Inteligente',SESSION:'Por actividad',MANUAL:'Manual',
};

function ChannelPolicies() {
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
  const border=dark?'#475569':'#CBD5E1';
  const muted=dark?'#CBD5E1':'#64748B';
  const field={padding:'9px',border:'1px solid '+border,borderRadius:'7px',width:'100%',background:dark?'#1E293B':'#FFFFFF',color:dark?'#F8FAFC':'#0F172A'};
  const button={padding:'9px 13px',border:'1px solid '+border,borderRadius:'7px',background:dark?'#334155':'#F8FAFC',color:dark?'#F8FAFC':'#0F172A',cursor:'pointer'};
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
      setFeedback('Configuración guardada. Los workflows de n8n deben leer y aplicar estas reglas.');
      setRevision(n=>n+1);
    }catch {
      setError('No se pudo guardar. Comprueba los permisos y que el workspace tenga el esquema actualizado.');
    }finally {setSaving(false);}
  }
  return <div style={{padding:14,display:'flex',flexDirection:'column',gap:16}}>
    <header>
      <strong style={{fontSize:18}}>Gestión de consultas por canal</strong>
      <p style={{fontSize:13,color:muted}}>Cada buzón, cuenta o número puede agrupar sus mensajes de forma distinta. Esta configuración se guarda en Twenty y la interpreta n8n; la app no llama a modelos de IA ni envía mensajes.</p>
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
      {current&&policy&&<section style={{border:'1px solid '+border,borderRadius:10,padding:14,display:'flex',flexDirection:'column',gap:15}}>
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
              <option value="HYBRID">Inteligente: continuidad y asunto (recomendado)</option>
              <option value="SESSION">Por periodo de actividad</option>
              <option value="MESSAGE">Una consulta por mensaje entrante</option>
              <option value="MANUAL">Decisión manual</option>
            </>}
          </select>
        </label>
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
export default defineFrontComponent({
  universalIdentifier: IDS.FRONT_CHANNEL_POLICIES,
  name: 'channel-policies',
  description: 'Editor por canal de reglas de agrupación, reapertura y clasificación de consultas.',
  component: ChannelPolicies,
});
