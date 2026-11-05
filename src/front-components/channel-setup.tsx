import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { addChannel, getChannels, isValidCode, normalizeCode, updateChannelStatus } from '../lib/support-channels.ts';
import type { ChannelStatus, ChannelType, SupportChannel } from '../lib/support-channels.ts';

function ChannelSetup() {
  const dark=useColorScheme()==='dark';
  const [rows,setRows]=useState<SupportChannel[]>([]);
  const [loading,setLoading]=useState(true);
  const [readError,setReadError]=useState(false);
  const [revision,setRevision]=useState(0);
  const [name,setName]=useState('');
  const [code,setCode]=useState('');
  const [kind,setKind]=useState<ChannelType>('EMAIL');
  const [provider,setProvider]=useState('');
  const [identifier,setIdentifier]=useState('');
  const [busy,setBusy]=useState(false);
  const [verified,setVerified]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    let live=true;setLoading(true);setReadError(false);
    getChannels().then(data=>{if(live)setRows(data.sort((a,b)=>(a.name||'').localeCompare(b.name||'')));})
      .catch(()=>{if(live)setReadError(true);}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[revision]);
  const border=dark?'#475569':'#CBD5E1';
  const muted=dark?'#CBD5E1':'#64748B';
  const field={padding:'9px',border:'1px solid '+border,borderRadius:'7px',width:'100%',background:dark?'#1E293B':'#FFFFFF',color:dark?'#F8FAFC':'#0F172A'};
  const button={padding:'8px 12px',border:'1px solid '+border,borderRadius:'7px',cursor:'pointer',background:dark?'#334155':'#F8FAFC',color:dark?'#F8FAFC':'#0F172A'};
  async function create() {
    setError('');setFeedback('');
    const key=code.trim().toLowerCase();
    if(!name.trim())return setError('Indica un nombre para el canal.');
    if(!isValidCode(key))return setError('El código debe tener 3-64 caracteres: minúsculas, números y guiones.');
    if(rows.some(r=>r.code?.toLowerCase()===key))return setError('Ya existe un canal con ese código.');
    setBusy(true);
    try {
      await addChannel({name:name.trim(),code:key,channelType:kind,provider:provider.trim(),externalIdentifier:identifier.trim()});
      setName('');setCode('');setProvider('');setIdentifier('');
      setFeedback('Canal creado desactivado. Comprueba la integración antes de marcarlo activo.');
      setRevision(n=>n+1);
    }catch{setError('No se pudo crear el canal. Comprueba tus permisos y el API Playground.');}
    finally{setBusy(false);}
  }
  async function changeStatus(row:SupportChannel,status:ChannelStatus) {
    setError('');setFeedback('');setBusy(true);
    try {
      await updateChannelStatus(row.id,status);
      setVerified(false);
      setFeedback('Estado actualizado en Twenty. Los workflows externos no se activan ni detienen automáticamente.');
      setRevision(n=>n+1);
    }catch{setError('No se pudo actualizar el estado del canal. Comprueba los permisos.');}
    finally{setBusy(false);}
  }
  const active=rows.filter(row=>row.status==='ACTIVE').length;
  return <div style={{padding:14,display:'flex',flexDirection:'column',gap:18}}>
    <header><strong style={{fontSize:18}}>Configuración de canales</strong>
      <p style={{fontSize:13,color:muted}}>Cada cliente crea solo los buzones y números que utiliza. No hay canales predeterminados.</p></header>
    <section style={{border:'1px solid '+border,borderRadius:10,padding:14,display:'flex',flexDirection:'column',gap:12}}>
      <strong>Añadir canal</strong>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(195px, 1fr))',gap:12}}>
        <label>Nombre<input style={field} value={name} placeholder="Email - Información" onChange={e=>{
          const next=e.target.value;if(!code||code===normalizeCode(name))setCode(normalizeCode(next));setName(next);
        }}/></label>
        <label>Código único<input style={field} value={code} placeholder="email-informacion" onChange={e=>setCode(e.target.value.toLowerCase())}/></label>
        <label>Tipo<select style={field} value={kind} onChange={e=>setKind(e.target.value as ChannelType)}>
          <option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="TELEGRAM">Telegram</option>
        </select></label>
        <label>Proveedor<input style={field} value={provider} placeholder="Gmail, Microsoft 365, Evolution API" onChange={e=>setProvider(e.target.value)}/></label>
        <label>Identificador externo<input style={field} value={identifier} placeholder="Buzón o ID de instancia" onChange={e=>setIdentifier(e.target.value)}/></label>
      </div>
      <p style={{color:muted,fontSize:12}}>No introduzcas contraseñas ni claves API. El canal se creará en estado Desactivado.</p>
      <div><button type="button" style={button} disabled={busy||loading||readError} onClick={()=>void create()}>
        {busy?'Guardando…':'Crear canal desactivado'}</button></div>
    </section>
    <section style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <strong>Canales de este workspace</strong>
        <button type="button" style={button} disabled={busy} onClick={()=>setRevision(n=>n+1)}>Actualizar</button>
      </div>
      {loading&&<p>Cargando canales…</p>}
      {readError&&<p role="alert">No se pudieron leer los canales. Comprueba el permiso de lectura y la API REST.</p>}
      {!loading&&!readError&&rows.length===0&&<p style={{color:muted}}>Todavía no hay canales. Puedes crear el primero arriba.</p>}
      {!loading&&!readError&&rows.map(row=><article key={row.id} style={{border:'1px solid '+border,padding:12,borderRadius:10,display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div><strong>{row.name||row.code||'Sin nombre'}</strong>
            <p style={{fontSize:12,color:muted,margin:'5px 0'}}>
              {row.channelType==='WHATSAPP'?'WhatsApp':row.channelType==='INSTAGRAM'?'Instagram':row.channelType==='TELEGRAM'?'Telegram':'Email'} · {row.code||'Sin código'} · {row.provider||'Proveedor no definido'}
            </p></div>
          <div style={{fontSize:12}}>{row.status||'DISABLED'} · Salud: {row.health||'UNKNOWN'}</div>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {row.status!=='ACTIVE'&&<button type="button" style={button} disabled={busy||!verified} onClick={()=>void changeStatus(row,'ACTIVE')}>Marcar activo</button>}
          {row.status==='ACTIVE'&&<button type="button" style={button} disabled={busy} onClick={()=>void changeStatus(row,'PAUSED')}>Pausar</button>}
          {row.status!=='DISABLED'&&<button type="button" style={button} disabled={busy} onClick={()=>void changeStatus(row,'DISABLED')}>Desactivar</button>}
        </div>
      </article>)}
      {!readError&&!loading&&rows.length>0&&<label style={{fontSize:12,color:muted}}>
        <input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>
        {' '}Confirmo que he comprobado la integración del canal antes de marcarlo activo.
      </label>}
      {!readError&&!loading&&<p style={{fontSize:12,color:muted}}>{active} canal(es) activo(s) de {rows.length}. El estado en Twenty no enciende ni detiene n8n.</p>}
      {rows.length>=100&&<p style={{fontSize:12,color:muted}}>Se muestran hasta 100 canales. Utiliza la tabla de abajo para acceder al resto.</p>}
    </section>
    {error&&<p role="alert" style={{color:'#DC2626'}}>{error}</p>}
    {feedback&&<p role="status" style={{color:dark?'#86EFAC':'#166534'}}>{feedback}</p>}
    <section style={{padding:14,border:'1px solid '+border,borderRadius:10}}>
      <strong>Cómo conectar cada canal</strong>
      <ol style={{paddingLeft:22,display:'flex',flexDirection:'column',gap:6,fontSize:13}}>
        <li>Crea solo los buzones o números que utiliza este cliente. El estado inicial es Desactivado.</li>
        <li>Configura Gmail, Microsoft 365 o Evolution API por separado en n8n.</li>
        <li>Usa el nodo Twenty CRM de n8n para leer el código, la política y el estado ACTIVE del canal.</li>
        <li>Registra las Consultas y Mensajes mediante las operaciones Record del nodo Twenty CRM de n8n.</li>
        <li>Define las reglas desde la pestaña Gestión de consultas. Tras probar el flujo, confirma la integración y marca el canal activo.</li>
      </ol>
      <p style={{fontSize:12,color:muted}}>El estado aquí es informativo hasta que el flujo externo respete esa comprobación. No introduzcas credenciales en estos registros.</p>
    </section>
  </div>;
}
export default defineFrontComponent({
  universalIdentifier:IDS.FRONT_CHANNEL_SETUP,
  name:'channel-setup',
  description:'Configuración por workspace de canales de atención.',
  component:ChannelSetup,
});
