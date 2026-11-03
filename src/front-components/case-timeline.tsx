import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent, PageLayoutType } from 'twenty-sdk/define';
import { useSelectedRecordIds, useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';

type SupportMessage = {
  id: string;
  body?: string | null;
  draftBody?: string | null;
  occurredAt?: string | null;
  senderType?: string | null;
  direction?: string | null;
  deliveryStatus?: string | null;
  replyDecision?: string | null;
  externalKey?: string | null;
};

const unwrap = (response: unknown): SupportMessage[] => {
  if (!response || typeof response !== 'object') return [];
  const r = response as Record<string, unknown>;
  const data = r.data && typeof r.data === 'object' ? r.data as Record<string, unknown> : r;
  const values = data.supportMessages ?? data.records;
  return Array.isArray(values) ? values as SupportMessage[] : [];
};

function CaseTimeline() {
  const [caseId] = useSelectedRecordIds();
  const colorScheme=useColorScheme();
  const dark=colorScheme==='dark';
  const [items, setItems] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    if (!caseId) {setItems([]);return;}
    setLoading(true);
    setError('');
    new RestApiClient().get('/rest/supportMessages', {
      query: {
        filter: `supportCaseId[eq]:${caseId}`,
        orderBy: 'occurredAt[AscNullsLast]',
        limit: 100,
      },
    }).then((response: unknown) => {
      if (!active) return;
      setItems(unwrap(response));
    }).catch(() => {
      if (!active) return;
      setError('No se ha podido cargar la conversación. Comprueba los permisos y el filtro REST en el API Playground.');
    }).finally(() => {if(active)setLoading(false);});
    return () => {active=false;};
  },[caseId,revision]);

  const label = (message:SupportMessage) => {
    if (message.senderType==='BOT') return 'Bot';
    if (message.senderType==='AGENT') return 'Agente';
    return message.direction==='INBOUND'?'Cliente':'Operador';
  };

  return (
    <div style={{padding:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}>
        <strong>Conversación</strong>
        <button onClick={()=>setRevision(v=>v+1)}>Actualizar</button>
      </div>
      {!caseId && <p>Abre una consulta para ver su conversación.</p>}
      {loading && <p>Cargando mensajes…</p>}
      {error && <p role="alert" style={{color:'#B91C1C'}}>{error}</p>}
      {!loading && !error && !!caseId && items.length===0 && <p>Todavía no hay mensajes en esta consulta.</p>}
      {items.map(message => {
        const outbound=message.direction==='OUTBOUND';
        return (
          <section key={message.id} style={{
            maxWidth:'90%',alignSelf:outbound?'flex-end':'flex-start',padding:'12px',
            border:dark?'1px solid #475569':'1px solid #CBD5E1',borderRadius:'12px',backgroundColor:outbound?(dark?'#173752':'#E0F2FE'):(dark?'#243247':'#F8FAFC'),color:dark?'#F8FAFC':'#0F172A'
          }}>
            <div style={{display:'flex',justifyContent:'space-between',gap:'12px',fontSize:'12px',marginBottom:'6px'}}>
              <strong>{label(message)}</strong>
              <span>{message.occurredAt?new Date(message.occurredAt).toLocaleString('es-ES'):''}</span>
            </div>
            <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{message.body || message.draftBody || '(Sin contenido)'}</div>
            <div style={{marginTop:'8px',display:'flex',gap:'8px',fontSize:'11px',color:dark?'#CBD5E1':'#475569'}}>
              {message.deliveryStatus && <span>{message.deliveryStatus}</span>}
              {message.replyDecision && <span>· {message.replyDecision}</span>}
              {!message.body && message.draftBody && <span>· Borrador, no enviado</span>}
            </div>
          </section>
        );
      })}
      {items.length>=100 && <p style={{fontSize:'12px'}}>Se muestran los primeros 100 mensajes. Para el historial completo, usa la relación Mensajes.</p>}
    </div>
  );
}

export default defineFrontComponent({
  universalIdentifier:IDS.FRONT_CASE_TIMELINE,
  name:'case-timeline',
  description:'Vista cronológica de los mensajes de la consulta actual.',
  component:CaseTimeline,
  widgetAvailability:{pageLayoutType:PageLayoutType.RECORD_PAGE,objectUniversalIdentifiers:[IDS.CASE_OBJECT]},
});
