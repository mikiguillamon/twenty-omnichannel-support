import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent, PageLayoutType } from 'twenty-sdk/define';
import { useColorScheme, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { GENERAL_FAQ_SCOPE, normalizeFaqScope, normalizeFaqScopes } from '../lib/faq-scopes.ts';

type Faq = { id: string; scopeTags?: string[] | null };
function faqRecord(raw: unknown): Faq | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  const record = data.supportFaq ?? data.record;
  return record && typeof record === 'object' && !Array.isArray(record) ? record as Faq : null;
}

function FaqScopeEditor() {
  const [faqId] = useSelectedRecordIds();
  return <SelectedFaqScopeEditor key={faqId} faqId={faqId} />;
}

function SelectedFaqScopeEditor({ faqId }: { faqId: string | undefined }) {
  const dark = useColorScheme() === 'dark';
  const [scopes, setScopes] = useState<string[] | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(Boolean(faqId));
  const [saving, setSaving] = useState(false);
  const canEdit = Boolean(faqId) && scopes !== null && !saving;
  const border = dark ? '#475569' : '#CBD5E1';
  const muted = dark ? '#CBD5E1' : '#64748B';

  useEffect(() => {
    let active = true;
    if (!faqId) return;
    void new RestApiClient().get('/rest/supportFaqs/' + encodeURIComponent(faqId))
      .then((response: unknown) => {
        if (!active) return;
        const record = faqRecord(response);
        if (!record || record.id !== faqId || (record.scopeTags !== null && !Array.isArray(record.scopeTags))) {
          throw new Error('FAQ scope unavailable');
        }
        setScopes(record.scopeTags ?? []);
      }).catch(() => { if (active) setError('No se pudo cargar el alcance del FAQ.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [faqId]);

  const add = () => {
    if (scopes === null || saving) return;
    try {
      const value = normalizeFaqScope(input);
      setScopes(normalizeFaqScopes([...scopes, value]));
      setInput(''); setError(''); setFeedback('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Alcance inválido'); }
  };
  const save = async () => {
    if (!faqId || scopes === null || saving) return;
    setSaving(true); setError(''); setFeedback('');
    try {
      const values = normalizeFaqScopes(scopes);
      await new RestApiClient().patch('/rest/supportFaqs/' + encodeURIComponent(faqId), { scopeTags: values });
      setScopes(values);
      setFeedback('Alcance guardado.');
    } catch { setError('No se pudo guardar. Revisa los permisos de las FAQs.'); }
    finally { setSaving(false); }
  };

  return <section style={{padding:14,display:'flex',flexDirection:'column',gap:12}}>
    <div>
      <strong>Alcance de esta FAQ</strong>
      <p style={{fontSize:13,color:muted}}>El bot con alcance VERANO consultará FAQs de GENERAL y VERANO. Las FAQs sin alcance no se incluyen. El alcance no sustituye al estado Publicada.</p>
    </div>
    {loading && <p>Cargando alcance…</p>}
    {scopes !== null && <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
      {scopes.map(scope => <span key={scope} style={{border:'1px solid '+border,borderRadius:999,padding:'5px 10px',display:'inline-flex',alignItems:'center',gap:8,fontSize:13}}>
        {scope === GENERAL_FAQ_SCOPE ? 'General' : scope.replace(/_/g,' ')}
        <button type="button" aria-label={'Quitar '+scope} disabled={!canEdit} onClick={() => {setScopes(scopes.filter(x => x !== scope));setFeedback('');}} style={{border:0,background:'transparent',color:dark?'#E2E8F0':'#475569',cursor:'pointer'}}>×</button>
      </span>)}
      {scopes.length === 0 && <span style={{fontSize:13,color:muted}}>Sin alcance asignado</span>}
    </div>}
    <form onSubmit={event => { event.preventDefault(); add(); }} style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <input aria-label="Nuevo alcance" placeholder="General, Verano, Campaña 2027…" value={input} onChange={event=>setInput(event.target.value)}
        maxLength={64} disabled={!canEdit} style={{flex:'1 1 180px',padding:9,border:'1px solid '+border,borderRadius:7,background:dark?'#1E293B':'white',color:dark?'white':'#0F172A'}} />
      <button type="submit" disabled={!canEdit||!input.trim()}>Añadir</button>
      <button type="button" disabled={!canEdit||scopes?.includes(GENERAL_FAQ_SCOPE)} onClick={()=>{if(scopes){setScopes([...scopes,GENERAL_FAQ_SCOPE]);setFeedback('');}}}>General</button>
    </form>
    <div><button type="button" disabled={!canEdit} onClick={()=>void save()}>{saving?'Guardando…':'Guardar alcance'}</button></div>
    {error && <p role="alert" style={{color:dark?'#FDA4AF':'#B91C1C'}}>{error}</p>}
    {feedback && <p role="status" style={{fontSize:13,color:muted}}>{feedback}</p>}
  </section>;
}

export default defineFrontComponent({
  universalIdentifier: IDS.FRONT_FAQ_SCOPE_EDITOR,
  name: 'faq-scope-editor',
  description: 'Editor libre de etiquetas de alcance para el FAQ actual.',
  component: FaqScopeEditor,
  widgetAvailability: { pageLayoutType: PageLayoutType.RECORD_PAGE, objectUniversalIdentifiers: [IDS.FAQ_OBJECT] },
});
