import { useEffect, useId, useRef, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent, PageLayoutType } from 'twenty-sdk/define';
import { useSelectedRecordIds, useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { replyLinkFor, replyUnavailableReason } from '../lib/reply-link.ts';
import type { ReplyCase, ReplyIdentity, ReplyAlias } from '../lib/reply-link.ts';
import {
  decideConversationProposal, loadConversationMessages, mergeConversationMessages,
  PROPOSAL_BODY_LIMIT, proposalDecisionError, type ConversationMessage, type ProposalStatus,
} from '../lib/conversation-thread.ts';
import { conversationThreadStyles } from '../ui/conversation-thread.styles.ts';

function unwrapRecord<T>(response: unknown, name: string): T | null {
  if (!response || typeof response !== 'object') return null;
  const root = response as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  const record = data[name] ?? data.record;
  return record && typeof record === 'object' && !Array.isArray(record) ? record as T : null;
}

const deliveryLabels: Record<string, string> = {
  RECEIVED: 'Recibido', PENDING: 'Pendiente de envío', SENT: 'Enviado', DELIVERED: 'Entregado', FAILED: 'Envío fallido',
};
const replyLabels = { EMAIL: 'Email', WHATSAPP: 'WhatsApp', PHONE: 'Llamar', TELEGRAM: 'Telegram', INSTAGRAM: 'Instagram' };
const dateLabel = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

type DecisionProps = {
  message: ConversationMessage;
  onDecide: (status: ProposalStatus, text: string) => void;
};

function ProposalEditor({ message, onDecide }: DecisionProps) {
  const inputId = useId();
  const submitLock = useRef(false);
  const [value, setValue] = useState(message.draftBody ?? '');
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState('');

  async function submit(confirmed: boolean) {
    const text = value.trim();
    if (submitLock.current || (confirmed && !text)) return;
    submitLock.current = true;
    setBusy(true);
    setError('');
    try {
      const status = await decideConversationProposal(new RestApiClient(), message.id, confirmed, text);
      onDecide(status, text);
    } catch (cause) {
      setError(proposalDecisionError(cause));
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  return <div className="omni-thread-editor" aria-busy={busy}>
    <label htmlFor={inputId}>Respuesta propuesta</label>
    <textarea id={inputId} rows={5} value={value} maxLength={PROPOSAL_BODY_LIMIT}
      disabled={busy || discard} onChange={event => setValue(event.target.value)} />
    {discard ? <>
      <p className="omni-thread-hint">n8n recibirá el descarte y continuará sin el texto de la propuesta.</p>
      <div className="omni-thread-actions">
        <button type="button" className="omni-thread-button" data-tone="danger" disabled={busy} onClick={() => void submit(false)}>Confirmar descarte</button>
        <button type="button" className="omni-thread-button" disabled={busy} onClick={() => { setDiscard(false); setError(''); }}>Volver</button>
      </div>
    </> : <div className="omni-thread-actions">
      <button type="button" className="omni-thread-button" data-tone="primary" disabled={busy || !value.trim()} onClick={() => void submit(true)}>Confirmar en n8n</button>
      <button type="button" className="omni-thread-button" disabled={busy} onClick={() => { setDiscard(true); setError(''); }}>Descartar</button>
    </div>}
    {busy && <p className="omni-thread-hint" role="status">Registrando decisión…</p>}
    {error && <p className="omni-thread-error" role="alert">{error}</p>}
  </div>;
}

function ThreadMessage({ message, onDecide }: DecisionProps) {
  const outbound = message.direction === 'OUTBOUND';
  const sender = message.senderType === 'BOT' ? 'Bot' : message.senderType === 'AGENT' ? 'Agente' : outbound ? 'Operador' : 'Cliente';
  const occurred = message.occurredAt ? new Date(message.occurredAt) : null;
  const validDate = occurred && Number.isFinite(occurred.getTime());
  const proposal = message.proposalStatus;
  const recording = message.callRecording?.primaryLinkUrl;
  const content = message.body || message.draftBody;

  return <li className="omni-thread-message" data-outbound={outbound} data-proposal={Boolean(proposal)}>
    <header className="omni-thread-meta">
      <strong>{sender}</strong>
      {validDate && <time dateTime={occurred.toISOString()}>{dateLabel.format(occurred)}</time>}
      {proposal === 'PENDING' && <span className="omni-thread-tag">Por revisar</span>}
      {proposal === 'CONFIRMED' && <span className="omni-thread-tag">Aprobada en n8n</span>}
      {proposal === 'DISCARDED' && <span className="omni-thread-tag">Descartada</span>}
      {!proposal && message.deliveryStatus && <span>{deliveryLabels[message.deliveryStatus] ?? message.deliveryStatus}</span>}
      {!proposal && !message.body && message.draftBody && <span>Borrador</span>}
    </header>
    {proposal === 'PENDING' ? <ProposalEditor message={message} onDecide={onDecide} /> :
      proposal !== 'DISCARDED' && <p className="omni-thread-text">{content || 'Sin contenido'}</p>}
    {(message.callTranscription || recording?.startsWith('https://')) && <div className="omni-thread-media">
      {message.callTranscription && <details><summary>Ver transcripción</summary><p className="omni-thread-text">{message.callTranscription}</p></details>}
      {recording?.startsWith('https://') && <>
        <audio controls preload="none" src={recording} aria-label="Grabación de la llamada" />
        <a href={recording} target="_blank" rel="noreferrer noopener">Abrir grabación</a>
      </>}
    </div>}
  </li>;
}

function CaseTimeline() {
  const [caseId] = useSelectedRecordIds();
  return <ConversationThread caseId={caseId} />;
}

export function ConversationThread({ caseId }: { caseId: string | undefined }) {
  return <SelectedCaseTimeline key={caseId} caseId={caseId} />;
}

function SelectedCaseTimeline({ caseId }: { caseId: string | undefined }) {
  const colorScheme = useColorScheme();
  const [items, setItems] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(caseId));
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [olderError, setOlderError] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [replyCase, setReplyCase] = useState<ReplyCase | null>(null);
  const [replyIdentity, setReplyIdentity] = useState<ReplyIdentity | null>(null);
  const [replyAliases, setReplyAliases] = useState<ReplyAlias[]>([]);
  const [replyLoading, setReplyLoading] = useState(Boolean(caseId));
  const [replyError, setReplyError] = useState('');

  useEffect(() => {
    if (!caseId) return;
    let active = true;
    setLoading(true);
    setError('');
    setOlderError('');
    void loadConversationMessages(new RestApiClient(), caseId).then(({ records, nextCursor }) => {
      if (!active) return;
      setItems(mergeConversationMessages(records, []));
      setNextCursor(nextCursor);
    }).catch(() => {
      if (active) setError('No se pudieron cargar los mensajes. Actualiza el historial o revisa tus permisos en Twenty.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId, revision]);

  async function loadOlder() {
    if (!caseId || !nextCursor || loading || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError('');
    try {
      const page = await loadConversationMessages(new RestApiClient(), caseId, nextCursor);
      if (page.nextCursor === nextCursor) throw new Error('REST_CURSOR_LOOP');
      setItems(current => mergeConversationMessages(current, page.records));
      setNextCursor(page.nextCursor);
    } catch {
      setOlderError('No se pudieron cargar los mensajes anteriores. Vuelve a intentarlo.');
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    if (!caseId) return;
    let active = true;
    setReplyCase(null);
    setReplyIdentity(null);
    setReplyAliases([]);
    setReplyError('');
    setReplyLoading(true);
    const api = new RestApiClient();
    void (async () => {
      try {
        const caseResponse = await api.get('/rest/supportCases/' + encodeURIComponent(caseId));
        const record = unwrapRecord<ReplyCase>(caseResponse, 'supportCase');
        if (!active) return;
        if (!record) throw new Error('CASE_UNAVAILABLE');
        setReplyCase(record);
        if (!record.externalIdentityId || replyLinkFor(record)) return;
        const identityResponse = await api.get('/rest/supportExternalIdentities/' + encodeURIComponent(record.externalIdentityId));
        if (!active) return;
        setReplyIdentity(unwrapRecord<ReplyIdentity>(identityResponse, 'supportExternalIdentity'));
        if (record.channel !== 'WHATSAPP') return;
        const aliases = await api.get<{ data?: { supportIdentityAliases?: ReplyAlias[] }; pageInfo?: { hasNextPage?: boolean } }>(
          '/rest/supportIdentityAliases', {
            query: { filter: 'externalIdentityId[eq]:' + JSON.stringify(record.externalIdentityId), limit: 60, depth: 0 },
          },
        );
        if (!Array.isArray(aliases.data?.supportIdentityAliases) || aliases.pageInfo?.hasNextPage) {
          throw new Error('ALIASES_UNAVAILABLE');
        }
        if (active) setReplyAliases(aliases.data.supportIdentityAliases);
      } catch {
        if (active) setReplyError('No se pudo verificar el destinatario de la conversación.');
      } finally {
        if (active) setReplyLoading(false);
      }
    })();
    return () => { active = false; };
  }, [caseId, revision]);

  const canResolveReply = replyCase && (replyCase.channel !== 'WHATSAPP' || (!replyLoading && !replyError));
  const reply = canResolveReply ? replyLinkFor(replyCase, replyIdentity, replyAliases) : null;

  return (
    <section className="omni-thread" data-scheme={colorScheme} aria-label="Historial de conversación">
      <style>{conversationThreadStyles}</style>
      <div className="omni-thread-toolbar">
        <h2>Historial</h2>
        {caseId && <button type="button" className="omni-thread-button" disabled={loading || loadingOlder}
          onClick={() => setRevision(current => current + 1)}>Actualizar</button>}
      </div>
      {!caseId && <p className="omni-thread-hint omni-thread-state">Abre una conversación para ver el historial.</p>}
      {loading && <p className="omni-thread-hint omni-thread-state" role="status">Cargando mensajes…</p>}
      {error && <p className="omni-thread-error omni-thread-state" role="alert">{error}</p>}
      {!loading && !error && caseId && items.length === 0 && <p className="omni-thread-hint omni-thread-state">Todavía no hay mensajes.</p>}
      {nextCursor && !loading && <div className="omni-thread-older">
        <button type="button" className="omni-thread-button" disabled={loadingOlder} onClick={() => void loadOlder()}>
          {loadingOlder ? 'Cargando…' : 'Cargar mensajes anteriores'}
        </button>
        {olderError && <p className="omni-thread-error" role="alert">{olderError}</p>}
      </div>}
      {items.length > 0 && <ol className="omni-thread-list">{items.map(message => <ThreadMessage key={message.id} message={message}
        onDecide={(proposalStatus, text) => setItems(current => current.map(item => item.id === message.id ? {
          ...item, proposalStatus, ...(proposalStatus === 'CONFIRMED' ? { draftBody: text } : {}),
        } : item))} />)}</ol>}
      {caseId && <footer className="omni-thread-footer">
        {reply ? <>
          <small>{reply.destination}</small>
          <a className="omni-thread-button" href={reply.href} target={reply.newTab ? '_blank' : undefined}
            rel={reply.newTab ? 'noopener noreferrer' : undefined}>Responder · {replyLabels[reply.channel]}</a>
        </> : <small role={replyError ? 'alert' : undefined}>{replyLoading ? 'Buscando destinatario…' : replyError || replyUnavailableReason(replyCase?.channel)}</small>}
      </footer>}
    </section>
  );
}

export default defineFrontComponent({
  universalIdentifier: IDS.FRONT_CASE_TIMELINE,
  name: 'case-timeline',
  description: 'Historial de mensajes y revisión de propuestas de la conversación.',
  component: CaseTimeline,
  widgetAvailability: { pageLayoutType: PageLayoutType.RECORD_PAGE, objectUniversalIdentifiers: [IDS.CASE_OBJECT] },
});
