import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent, PageLayoutType } from 'twenty-sdk/define';
import { useSelectedRecordIds, useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { sortMessagesChronologically } from '../lib/sort-support-messages.ts';
import { replyLinkFor, replyUnavailableReason } from '../lib/reply-link.ts';
import type { ReplyCase, ReplyIdentity, ReplyAlias } from '../lib/reply-link.ts';

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
  callTranscription?: string | null;
  callRecording?: { primaryLinkUrl?: string | null; primaryLinkLabel?: string | null } | null;
};

const unwrapRecord = <T,>(response: unknown, name: string): T | null => {
  if (!response || typeof response !== 'object') return null;
  const root = response as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  const record = data[name] ?? data.record;
  return record && typeof record === 'object' && !Array.isArray(record) ? record as T : null;
};

const unwrapAliases = (response: unknown): ReplyAlias[] => {
  if (!response || typeof response !== 'object') return [];
  const root = response as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  return Array.isArray(data.supportIdentityAliases) ? data.supportIdentityAliases as ReplyAlias[] : [];
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
  return <SelectedCaseTimeline key={caseId} caseId={caseId} />;
}

function SelectedCaseTimeline({ caseId }: { caseId: string | undefined }) {
  const colorScheme=useColorScheme();
  const dark=colorScheme==='dark';
  const [items, setItems] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [replyCase, setReplyCase] = useState<ReplyCase | null>(null);
  const [replyIdentity, setReplyIdentity] = useState<ReplyIdentity | null>(null);
  const [replyAliases, setReplyAliases] = useState<ReplyAlias[]>([]);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState('');

  useEffect(() => {
    let active = true;
    if (!caseId) {setItems([]);return;}
    setLoading(true);
    setError('');
    new RestApiClient().get('/rest/supportMessages', {
      query: {
        filter: `supportCaseId[eq]:${caseId}`,
        order_by: 'occurredAt[AscNullsLast]',
        limit: 100,
      },
    }).then((response: unknown) => {
      if (!active) return;
      setItems(sortMessagesChronologically(unwrap(response)));
    }).catch(() => {
      if (!active) return;
      setError('No se ha podido cargar la conversación. Comprueba los permisos y el filtro REST en el API Playground.');
    }).finally(() => {if(active)setLoading(false);});
    return () => {active=false;};
  },[caseId,revision]);

  useEffect(() => {
    let active = true;
    setReplyCase(null);
    setReplyIdentity(null);
    setReplyAliases([]);
    setReplyError('');
    if (!caseId) { setReplyLoading(false); return; }
    setReplyLoading(true);
    const api = new RestApiClient();
    void (async () => {
      try {
        const caseResponse: unknown = await api.get('/rest/supportCases/' + encodeURIComponent(caseId));
        const record = unwrapRecord<ReplyCase>(caseResponse, 'supportCase');
        if (!record || !active) {
          if (active) setReplyError('No se ha podido consultar el destinatario de esta conversación.');
          return;
        }
        setReplyCase(record);
        if (!record.externalIdentityId) return;
        if (record.channel === 'WHATSAPP' && replyLinkFor(record)) return;
        const identityId = encodeURIComponent(record.externalIdentityId);
        // The case's linked identity, not an arbitrary Person's contacts, determines the recipient.
        const identityResponse: unknown = await api.get('/rest/supportExternalIdentities/' + identityId);
        if (!active) return;
        setReplyIdentity(unwrapRecord<ReplyIdentity>(identityResponse, 'supportExternalIdentity'));
        if (record.channel !== 'WHATSAPP') return;
        const aliasResponse: unknown = await api.get('/rest/supportIdentityAliases', {
          query: { filter: 'externalIdentityId[eq]:' + JSON.stringify(record.externalIdentityId), limit: 60 },
        });
        if (active) setReplyAliases(unwrapAliases(aliasResponse));
      } catch {
        if (active) setReplyError('No se pudo cargar la identidad externa. Comprueba los permisos REST de Twenty.');
      } finally {
        if (active) setReplyLoading(false);
      }
    })();
    return () => { active = false; };
  }, [caseId, revision]);

  const canResolveReply = replyCase && (replyCase.channel !== 'WHATSAPP' || (!replyLoading && !replyError));
  const reply = canResolveReply ? replyLinkFor(replyCase, replyIdentity, replyAliases) : null;

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
            {message.callTranscription && <details><summary>Transcripción de la llamada</summary>
              <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{message.callTranscription}</p></details>}
            {message.callRecording?.primaryLinkUrl?.startsWith('https://') && <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>
              <strong style={{fontSize:12}}>Grabación de la llamada</strong>
              <audio controls preload="none" src={message.callRecording.primaryLinkUrl} style={{width:'100%',maxWidth:360}}>
                Tu navegador no admite reproducción de audio.
              </audio>
              <a href={message.callRecording.primaryLinkUrl} target="_blank" rel="noreferrer noopener"
                style={{fontSize:12}}>Abrir grabación</a>
            </div>}
            <div style={{marginTop:'8px',display:'flex',gap:'8px',fontSize:'11px',color:dark?'#CBD5E1':'#475569'}}>
              {message.deliveryStatus && <span>{message.deliveryStatus}</span>}
              {message.replyDecision && <span>· {message.replyDecision}</span>}
              {!message.body && message.draftBody && <span>· Borrador, no enviado</span>}
            </div>
          </section>
        );
      })}
      {items.length>=100 && <p style={{fontSize:'12px'}}>Se muestran los primeros 100 mensajes. Para el historial completo, usa la relación Mensajes.</p>}
      {!!caseId && <footer style={{borderTop:dark?'1px solid #475569':'1px solid #CBD5E1',paddingTop:12,display:'flex',flexDirection:'column',gap:8}}>
        {reply ? <a href={reply.href} target={reply.newTab?'_blank':undefined} rel={reply.newTab?'noopener noreferrer':undefined}
          style={{display:'inline-block',textAlign:'center',padding:'10px 14px',borderRadius:8,background:dark?'#2563EB':'#1D4ED8',color:'#FFFFFF',fontWeight:600,textDecoration:'none'}}>
          Responder · {reply.channel==='EMAIL'?'Email':reply.channel==='WHATSAPP'?'WhatsApp':reply.channel==='PHONE'?'Llamar':reply.channel==='TELEGRAM'?'Telegram':'Instagram'}
        </a> : <button type="button" disabled style={{padding:'10px 14px',borderRadius:8,opacity:0.55,cursor:'not-allowed'}}>Responder</button>}
        {reply && <span style={{fontSize:12,color:dark?'#CBD5E1':'#64748B'}}>Abre {reply.destination} en una aplicación externa. La respuesta no se registra automáticamente en Twenty.</span>}
        {!reply && <span style={{fontSize:12,color:dark?'#CBD5E1':'#64748B'}} role={replyError?'alert':undefined}>{replyLoading?'Buscando destinatario…':replyError||replyUnavailableReason(replyCase?.channel)}</span>}
      </footer>}
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
