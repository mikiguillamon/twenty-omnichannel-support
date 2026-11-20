import { useEffect,useState } from 'react';
import { useColorScheme } from 'twenty-sdk/front-component';
import {
  listPublishedDashboardLinks,publishDashboardLink,renameDashboardLink,unpublishDashboardLink,
  type PublishedDashboardLink,
} from '../lib/dashboard-navigation.ts';

export function DashboardNavigationManager(){
  const dark=useColorScheme()==='dark';
  const [items,setItems]=useState<PublishedDashboardLink[]>([]);
  const [name,setName]=useState('');
  const [link,setLink]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [confirmId,setConfirmId]=useState<string|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);
  const border=dark?'#455164':'#E1E6ED';
  const muted=dark?'#AAB6C6':'#657385';
  const btn={background:'transparent',color:'inherit',border:'1px solid '+border,borderRadius:7,padding:'9px 12px',cursor:'pointer',fontSize:12};
  const input={background:'transparent',color:'inherit',border:'1px solid '+border,borderRadius:7,padding:'10px 12px',fontSize:13,width:'100%',boxSizing:'border-box' as const};
  async function refresh(){
    setError('');
    try{setItems(await listPublishedDashboardLinks());}
    catch{setError('No se pueden consultar los accesos. Comprueba los permisos de administración del menú.');}
  }
  useEffect(()=>{void refresh();},[]);
  async function publish(){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      await publishDashboardLink({name,link});
      setName('');setLink('');
      await refresh();
      setNotice('Acceso compartido creado. Comprueba su visibilidad en el menú de Twenty.');
    }catch(err){
      const code=err instanceof Error?err.message:'';
      setError(code==='ALREADY_PUBLISHED'?'Este dashboard ya tiene un acceso compartido.':
        code.startsWith('INVALID_')?'Indica un nombre válido y copia el enlace interno desde la página operativa del dashboard.':
        code==='PUBLISH_NOT_SHARED'?'Twenty ha creado el acceso, pero no ha confirmado que sea compartido. Comprueba el menú antes de repetir la operación.':
        'No se ha podido confirmar la publicación. Inspecciona el menú antes de reintentar para evitar duplicados.');
    }finally{setBusy(false);}
  }
  async function rename(item:PublishedDashboardLink){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{await renameDashboardLink(item.id,name);setEditingId(null);setName('');await refresh();setNotice('Nombre actualizado.');}
    catch{setError('No se pudo cambiar el nombre. Actualiza la lista y vuelve a intentarlo.');}
    finally{setBusy(false);}
  }
  async function remove(item:PublishedDashboardLink){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{await unpublishDashboardLink(item.id);setConfirmId(null);await refresh();setNotice('Acceso retirado. El dashboard y sus datos se conservan.');}
    catch{setError('No se pudo retirar el acceso. Comprueba los permisos y vuelve a cargar la lista.');}
    finally{setBusy(false);}
  }
  return <section aria-label="Accesos compartidos de dashboards" style={{border:'1px solid '+border,borderRadius:12,padding:18,display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between'}}>
      <div><strong style={{fontSize:15}}>Accesos publicados por Omnichannel</strong>
        <p style={{fontSize:12,color:muted,margin:'5px 0 0',lineHeight:1.6}}>Publica un dashboard en la raíz del menú del workspace sin vincular el acceso al ciclo de vida de Omnichannel.</p></div>
      <button type="button" style={btn} disabled={busy} onClick={()=>void refresh()}>Actualizar lista</button>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:12}}>
      <label style={{fontSize:12}}>Nombre del acceso<input aria-label="Nombre del acceso" style={{...input,marginTop:5}} maxLength={80} value={name} onChange={event=>setName(event.target.value)} placeholder="Ej. Soporte · General"/></label>
      <label style={{fontSize:12}}>Enlace interno del dashboard<input aria-label="Enlace interno del dashboard" style={{...input,marginTop:5}} value={link} onChange={event=>setLink(event.target.value)} placeholder="/page/...?..."/></label>
    </div>
    <div><button type="button" style={{...btn,background:'#5363E9',color:'#fff',borderColor:'#5363E9'}} disabled={busy||!name.trim()||!link.trim()} onClick={()=>void publish()}>{busy?'Guardando…':'Publicar acceso'}</button></div>
    <p style={{fontSize:12,color:muted,margin:0,lineHeight:1.6}}>Utiliza el botón «Copiar enlace» desde un dashboard abierto fuera de Ajustes. Solo se aceptan rutas internas de página con identificador de dashboard. Los permisos de lectura de los datos siguen dependiendo de Twenty.</p>
    {error&&<p role="alert" style={{fontSize:12,color:'#D74C4C',margin:0}}>{error}</p>}
    {notice&&<p role="status" style={{fontSize:12,margin:0}}>{notice}</p>}
    {items.length===0?<p style={{fontSize:12,color:muted,margin:0}}>No hay accesos publicados desde este gestor. Los enlaces creados manualmente en Twenty no se modifican aquí.</p>:
    <div style={{display:'flex',flexDirection:'column',gap:8}}>{items.map(item=><div key={item.id} style={{border:'1px solid '+border,borderRadius:8,padding:12,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
      <div style={{minWidth:0,flex:1}}><strong style={{fontSize:13}}>{item.name}</strong><div style={{fontSize:11,color:muted,overflowWrap:'anywhere',marginTop:4}}>{item.link}</div></div>
      {editingId===item.id?<div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button type="button" style={btn} disabled={busy} onClick={()=>void rename(item)}>Guardar nombre</button><button type="button" style={btn} onClick={()=>{setEditingId(null);setName('');}}>Cancelar</button></div>:
      confirmId===item.id?<div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button type="button" style={btn} disabled={busy} onClick={()=>void remove(item)}>Confirmar retirada</button><button type="button" style={btn} onClick={()=>setConfirmId(null)}>Cancelar</button></div>:
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button type="button" style={btn} disabled={busy} onClick={()=>{setEditingId(item.id);setName(item.name);setConfirmId(null);}}>Renombrar</button><button type="button" style={btn} disabled={busy} onClick={()=>{setConfirmId(item.id);setEditingId(null);}}>Retirar</button></div>}
    </div>)}</div>}
  </section>;
}
