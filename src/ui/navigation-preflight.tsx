import { useState } from 'react';
import { inspectLegacyNavigation, preserveWorkspaceNavigation } from '../lib/navigation-preflight.ts';

export function NavigationPreflight(){
  const [count,setCount]=useState<number|null>(null);
  const [others,setOthers]=useState(0);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  async function inspect(){
    setBusy(true);setError('');setNotice('');
    try{
      const result=await inspectLegacyNavigation();
      setCount(result.toMove.length);
      setOthers(result.totalChildren-result.childrenOwnedByApp-result.toMove.length);
      setNotice(result.folderId
        ?'Analizados los enlaces directos de la antigua carpeta Omnichannel.'
        :'La carpeta antigua ya no existe; no hay enlaces que preparar.');
    }catch{
      setError('No se ha podido consultar la navegación. Revisa el permiso Aplicaciones y vuelve a intentarlo.');
    }finally{setBusy(false);}
  }
  async function preserve(){
    setBusy(true);setError('');setNotice('');
    try{
      const moved=await preserveWorkspaceNavigation();
      const result=await inspectLegacyNavigation();
      setCount(result.toMove.length);
      setOthers(result.totalChildren-result.childrenOwnedByApp-result.toMove.length);
      setNotice(moved?moved+' acceso(s) compartidos movidos a la raíz. No se han borrado.':
        'No había enlaces compartidos pendientes de trasladar.');
    }catch{
      setError('No se han podido trasladar todos los enlaces. Se conservan los existentes; vuelve a inspeccionar antes de repetir.');
    }finally{setBusy(false);}
  }
  const button={border:'1px solid #A5ACB8',borderRadius:7,padding:'8px 12px',
    background:'transparent',color:'inherit',fontSize:12,cursor:'pointer'};
  return <section aria-label="Preparar migración del menú" style={{border:'1px solid #CBD2DB',borderRadius:10,
    padding:16,display:'flex',flexDirection:'column',gap:10}}>
    <strong style={{fontSize:15}}>Preparar el menú para Omnichannel 1.0</strong>
    <p style={{fontSize:12,lineHeight:1.6,margin:0}}>
      Twenty elimina en cascada los enlaces que sigan dentro de una carpeta retirada por la aplicación.
      Este paso detecta los accesos compartidos creados por el workspace en la antigua carpeta
      Omnichannel y permite moverlos a la raíz, conservando su destino y sus identificadores.
      No elimina ni modifica los accesos que pertenecen a Omnichannel.
    </p>
    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <button type="button" style={button} disabled={busy} onClick={()=>void inspect()}>
        {busy?'Comprobando…':'Inspeccionar menú'}
      </button>
      {count!==null&&count>0&&<button type="button" style={button} disabled={busy} onClick={()=>void preserve()}>
        Proteger {count} acceso(s) compartido(s)
      </button>}
    </div>
    {count!==null&&<span role="status" style={{fontSize:12}}>
      Accesos compartidos pendientes: {count}. {others>0?
        'Hay '+others+' elemento(s) adicionales, posiblemente personales, que debes revisar desde el menú de Twenty.':''}
    </span>}
    {notice&&<span role="status" style={{fontSize:12}}>{notice}</span>}
    {error&&<p role="alert" style={{fontSize:12,color:'#D74C4C',margin:0}}>{error}</p>}
  </section>;
}
