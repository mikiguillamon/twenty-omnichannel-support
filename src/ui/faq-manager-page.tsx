import { useEffect, useMemo, useRef, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import {
  closeSidePanel, enqueueSnackbar, openCommandConfirmationModal, openSidePanelPage,
  SidePanelPages, useColorScheme, useFrontComponentId, useSelectedObjectMetadata,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import {
  FAQ_FIELDS, blankFaqEditor, editorFromFaq, faqEditorPayload, filterFaqs,
} from '../lib/faq-manager.ts';
import type { FaqEditor, FaqStatus, SupportFaq, SupportFaqCategory } from '../lib/faq-manager.ts';
import { fetchAllRestRecords } from '../lib/rest-collections.ts';

const TAG_OPTIONS = ['URGENTE', 'INTERNA', 'FRECUENTE', 'REVISAR'];
const LANGUAGES: Record<string, string> = { CA: 'Català', ES: 'Español', EN: 'English' };
const STATUS: Record<string, string> = { DRAFT: 'Borrador', PUBLISHED: 'Publicada', ARCHIVED: 'Archivada' };
const INITIAL_VISIBLE = 40;
const inputBase = { boxSizing: 'border-box' as const, width: '100%', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit' };

function errorMessage(error: unknown): string {
  const status = error && typeof error === 'object' && 'status' in error
    ? (error as { status?: unknown }).status : null;
  if (status === 401 || status === 403) return 'No tienes permisos para realizar esta operación en Twenty.';
  if (error instanceof Error) {
    if (error.message === 'QUESTION_ANSWER_REQUIRED') return 'La pregunta y la respuesta son obligatorias.';
    if (error.message === 'FAQ_TOO_LONG') return 'El contenido excede la longitud admitida.';
    if (error.message === 'INVALID_FAQ_URL') return 'La referencia debe ser una URL HTTPS.';
    if (error.message === 'INVALID_FAQ_TAG' || error.message === 'TOO_MANY_FAQ_TAGS')
      return 'Revisa las etiquetas: máximo 30 valores y 64 caracteres por etiqueta.';
    if (error.message === 'REST_TOO_MANY_RECORDS')
      return 'Hay demasiados registros para esta vista. Utiliza la tabla nativa de Twenty.';
  }
  return 'Twenty no ha podido completar la operación. Comprueba los permisos y vuelve a intentarlo.';
}


type FaqSidePanelProps = { recordId: string | null };

function faqFromRestResponse(response: unknown, expectedId: string): SupportFaq {
  const root = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  const value = data.supportFaq ?? data.record ?? data;
  if (!value || typeof value !== 'object' || (value as SupportFaq).id !== expectedId) {
    throw new Error('FAQ_NOT_FOUND');
  }
  return value as SupportFaq;
}

/** This component is rendered by Twenty inside its native side panel.
 * No app-owned Dialog, portal or global DOM access is necessary. */
function FaqEditorSidePanel({ recordId }: FaqSidePanelProps) {
  const dark = useColorScheme() === 'dark';
  const [editor, setEditor] = useState<FaqEditor | null>(null);
  const [previousFaq, setPreviousFaq] = useState<SupportFaq | undefined>(undefined);
  const [categories, setCategories] = useState<SupportFaqCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fg = dark ? '#F1F5F9' : '#20252D';
  const muted = dark ? '#A8B4C4' : '#667382';
  const border = dark ? '#465162' : '#E0E4EA';
  const surface = dark ? '#252B34' : '#FFFFFF';
  const fieldStyle = { ...inputBase, background: surface, color: fg, border: '1px solid ' + border };
  const buttonStyle = { border: '1px solid ' + border, background: surface, color: fg, padding: '8px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 13 };
  const primaryStyle = { ...buttonStyle, color: '#fff', background: '#485BFA', borderColor: '#485BFA' };

  useEffect(() => {
    let live = true;
    setError('');
    setLoading(true);
    setEditor(null);
    setPreviousFaq(undefined);
    setAdvanced(false);
    const api = new RestApiClient();
    void Promise.all([
      fetchAllRestRecords<SupportFaqCategory>(api, 'supportCategories', 'id,name,code,enabled'),
      recordId
        ? api.get('/rest/supportFaqs/' + encodeURIComponent(recordId), { query: { fields: FAQ_FIELDS, depth: 0 } })
        : Promise.resolve(null),
    ]).then(([nextCategories, faqResponse]) => {
      if (!live) return;
      const existing = recordId ? faqFromRestResponse(faqResponse, recordId) : undefined;
      setCategories(nextCategories);
      setPreviousFaq(existing);
      setEditor(existing ? editorFromFaq(existing) : blankFaqEditor());
    }).catch(reason => {
      if (live) setError(reason instanceof Error && reason.message === 'FAQ_NOT_FOUND'
        ? 'La FAQ ya no existe o no se puede leer.' : errorMessage(reason));
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [recordId]);

  function updateEditor<K extends keyof FaqEditor>(field: K, value: FaqEditor[K]) {
    setEditor(prev => prev ? { ...prev, [field]: value } : null);
  }
  async function save() {
    if (saving || loading || !editor) return;
    setSaving(true); setError('');
    try {
      const payload = faqEditorPayload(editor, previousFaq);
      const api = new RestApiClient();
      if (recordId) await api.patch('/rest/supportFaqs/' + encodeURIComponent(recordId), payload);
      else await api.post('/rest/supportFaqs', payload);
      await enqueueSnackbar({
        message: 'FAQ guardada. Pulsa Actualizar para ver los cambios en el listado.',
        variant: 'success',
      });
      await closeSidePanel();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  return <section style={{
    padding: '16px 18px 24px', display: 'flex', flexDirection: 'column', gap: 15,
    color: fg, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
  }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
      <div>
        <strong style={{ fontSize: 16 }}>{recordId ? 'Editar FAQ' : 'Nueva FAQ'}</strong>
        <p style={{ color: muted, fontSize: 12, margin: '5px 0 0' }}>Pregunta y respuesta para el asistente.</p>
      </div>
      <button type="button" title="Cerrar editor" aria-label="Cerrar editor" disabled={saving}
        onClick={() => void closeSidePanel()} style={{ ...buttonStyle, padding: 6, display: 'inline-flex' }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </header>
    {loading && <p style={{ fontSize: 13, color: muted }}>Cargando formulario…</p>}
    {error && <p role="alert" style={{ fontSize: 13, color: dark ? '#FFB0B0' : '#B42318', margin: 0 }}>{error}</p>}
    {editor && <form onSubmit={event => { event.preventDefault(); void save(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ fontSize: 12 }}>Categoría
        <select style={{ ...fieldStyle, marginTop: 5 }} value={editor.categoryId}
          onChange={e => updateEditor('categoryId', e.target.value)}>
          <option value="">Sin categoría</option>
          {categories.map(category => <option key={category.id} value={category.id}>
            {category.name?.trim() || category.code || 'Sin nombre'}{category.enabled === false ? ' (inactiva)' : ''}
          </option>)}
        </select>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <label style={{ fontSize: 12 }}>Idioma
          <select style={{ ...fieldStyle, marginTop: 5 }} value={editor.language}
            onChange={e => updateEditor('language', e.target.value as FaqEditor['language'])}>
            {Object.entries(LANGUAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Estado
          <select style={{ ...fieldStyle, marginTop: 5 }} value={editor.status}
            onChange={e => updateEditor('status', e.target.value as FaqStatus)}>
            <option value="DRAFT">Borrador</option>
            <option value="PUBLISHED">Publicada</option>
            <option value="ARCHIVED">Archivada</option>
          </select>
        </label>
      </div>
      <label style={{ fontSize: 12 }}>Pregunta *
        <textarea required value={editor.question} rows={3} maxLength={2000}
          style={{ ...fieldStyle, marginTop: 5, resize: 'vertical' }}
          onChange={e => updateEditor('question', e.target.value)} />
      </label>
      <label style={{ fontSize: 12 }}>Respuesta *
        <textarea required value={editor.answer} rows={7} maxLength={25000}
          style={{ ...fieldStyle, marginTop: 5, resize: 'vertical' }}
          onChange={e => updateEditor('answer', e.target.value)} />
      </label>
      <button type="button" style={{ ...buttonStyle, alignSelf: 'flex-start' }} disabled={saving}
        onClick={() => setAdvanced(value => !value)}>
        {advanced ? 'Ocultar opciones avanzadas' : 'Mostrar opciones avanzadas'}
      </button>
      {advanced && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12 }}>Alcances (separados por coma o salto de línea)
          <textarea style={{ ...fieldStyle, marginTop: 5 }} rows={3} value={editor.scopeTags}
            onChange={e => updateEditor('scopeTags', e.target.value)} />
        </label>
        <label style={{ fontSize: 12 }}>Variantes de pregunta (una por línea)
          <textarea style={{ ...fieldStyle, marginTop: 5 }} rows={4} value={editor.variants}
            onChange={e => updateEditor('variants', e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {TAG_OPTIONS.map(tag => <label key={tag}
            style={{ fontSize: 12, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <input type="checkbox" checked={editor.tags.includes(tag)}
              onChange={e => updateEditor('tags', e.target.checked
                ? [...editor.tags, tag] : editor.tags.filter(value => value !== tag))} />
            {tag}
          </label>)}
        </div>
        <label style={{ fontSize: 12 }}>Etiquetas propias (separadas por coma)
          <input style={{ ...fieldStyle, marginTop: 5 }} value={editor.customTags}
            onChange={e => updateEditor('customTags', e.target.value)} />
        </label>
        <label style={{ fontSize: 12 }}>URL de referencia (HTTPS)
          <input style={{ ...fieldStyle, marginTop: 5 }} value={editor.sourceUrl}
            onChange={e => updateEditor('sourceUrl', e.target.value)} />
        </label>
        <label style={{ fontSize: 12 }}>Revisado por
          <input style={{ ...fieldStyle, marginTop: 5 }} value={editor.updatedByReference}
            onChange={e => updateEditor('updatedByReference', e.target.value)} />
        </label>
      </div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 7 }}>
        <button type="button" style={buttonStyle} disabled={saving}
          onClick={() => void closeSidePanel()}>Cancelar</button>
        <button type="submit" style={primaryStyle} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar FAQ'}
        </button>
      </div>
    </form>}
  </section>;
}

function ActionIcon({ icon }: { icon: 'edit' | 'archive' | 'restore' }) {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    {icon === 'edit' && <>
      <path d="M12 20h9" />
      <path d="M16.6 3.8a2.1 2.1 0 0 1 3 3L9.4 17.1 5 18l.9-4.4L16.6 3.8Z" />
    </>}
    {icon === 'archive' && <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v12h14V8M10 12h4" />
    </>}
    {icon === 'restore' && <>
      <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M3 3v5h5" />
      <path d="M10 12h4" />
    </>}
  </svg>;
}

function FaqManager({ frontComponentId }: { frontComponentId: string }) {
  const dark = useColorScheme() === 'dark';
  const [faqs, setFaqs] = useState<SupportFaq[]>([]);
  const [categories, setCategories] = useState<SupportFaqCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [language, setLanguage] = useState('all');
  const [scope, setScope] = useState('all');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  // Ref blocks repeated clicks before React commits the pending state.
  const statusRequests = useRef(new Set<string>());
  const [error, setError] = useState('');

  const fg = dark ? '#F1F5F9' : '#20252D';
  const muted = dark ? '#A8B4C4' : '#667382';
  const border = dark ? '#465162' : '#E0E4EA';
  const surface = dark ? '#252B34' : '#FFFFFF';
  const background = dark ? '#1A2028' : '#F9FAFC';
  const fieldStyle = { ...inputBase, background: surface, color: fg, border: '1px solid ' + border };
  const buttonStyle = { border: '1px solid ' + border, background: surface, color: fg, padding: '8px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 13 };
  const primaryStyle = { ...buttonStyle, color: '#fff', background: '#485BFA', borderColor: '#485BFA' };
  const cardStyle = { border: '1px solid ' + border, borderRadius: 9, background: surface, padding: '15px 18px' };

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    const api = new RestApiClient();
    void Promise.all([
      fetchAllRestRecords<SupportFaq>(api, 'supportFaqs',
        'id,question,answer,category,status,language,scopeTags,variants,tags,customTags,sourceUrl,updatedByReference,revision,publishedAt,lastSyncedAt'),
      fetchAllRestRecords<SupportFaqCategory>(api, 'supportCategories', 'id,name,code,enabled'),
    ]).then(([nextFaqs, nextCategories]) => {
      if (live) { setFaqs(nextFaqs); setCategories(nextCategories); }
    }).catch(reason => { if (live) setError(errorMessage(reason)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [refresh]);

  const categoryLabels = useMemo(() =>
    new Map(categories.map(cat => [cat.id, cat.name?.trim() || cat.code?.trim() || 'Sin nombre'])),
  [categories]);
  const scopes = useMemo(() => [...new Set(faqs.flatMap(row => row.scopeTags ?? []))].sort((a, b) => a.localeCompare(b)), [faqs]);
  const filtered = useMemo(() => filterFaqs(faqs, { query, status, language, scope }), [faqs, query, status, language, scope]);
  const groups = useMemo(() => {
    const mapping = new Map<string, SupportFaq[]>();
    for (const faq of filtered) {
      const name = categoryLabels.get(faq.categoryId ?? '') || 'Sin categoría';
      mapping.set(name, [...(mapping.get(name) ?? []), faq]);
    }
    return [...mapping.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([name, rows]) => ({
        name, rows: rows.sort((a, b) => (a.question || '').localeCompare(b.question || '', 'es')),
      }));
  }, [filtered, categoryLabels]);
  const totalPublished = faqs.filter(faq => faq.status === 'PUBLISHED').length;
  const totalDrafts = faqs.filter(faq => faq.status === 'DRAFT').length;

  async function openEditor(recordId?: string) {
    setError('');
    try {
      await openSidePanelPage({
        page: SidePanelPages.ViewFrontComponent,
        frontComponentId,
        objectNameSingular: 'supportFaq',
        selectedRecordIds: recordId ? [recordId] : [],
        pageTitle: recordId ? 'Editar FAQ' : 'Nueva FAQ',
        pageIcon: 'IconBook',
        resetNavigationStack: true,
      });
    } catch {
      setError('Twenty no ha podido abrir el editor. Comprueba que la app esté actualizada.');
    }
  }
  async function updateStatus(faq: SupportFaq, next: FaqStatus) {
    if (loading || statusRequests.current.has(faq.id)) return;
    if (next === 'ARCHIVED') {
      const answer = await openCommandConfirmationModal({
        title: '¿Archivar esta FAQ?',
        subtitle: 'Dejará de estar publicada para los bots. Podrás restaurarla desde el filtro Archivadas.',
        confirmButtonText: 'Archivar',
        confirmButtonAccent: 'danger',
      });
      if (answer !== 'confirm' || statusRequests.current.has(faq.id)) return;
    }
    statusRequests.current.add(faq.id);
    setBusyIds(current => new Set([...current, faq.id]));
    setError('');
    const publishedAt = next === 'PUBLISHED' && !faq.publishedAt
      ? new Date().toISOString() : faq.publishedAt;
    // Update only the affected FAQ; keep scroll, filters and expanded answers.
    setFaqs(current => current.map(row => row.id === faq.id
      ? {...row, status: next, publishedAt} : row));
    try {
      await new RestApiClient().patch('/rest/supportFaqs/' + encodeURIComponent(faq.id), {
        status: next,
        ...(next === 'PUBLISHED' && !faq.publishedAt ? {publishedAt} : {}),
      });
      // The native toast does not move the list or steal focus.
      void enqueueSnackbar({
        message: next === 'PUBLISHED' ? 'FAQ activada' : next === 'DRAFT' ? 'FAQ desactivada' : 'FAQ archivada',
        variant: 'success', duration: 2000, dedupeKey: 'faq-status-' + faq.id,
      }).catch(() => {});
    } catch (reason) {
      setFaqs(current => current.map(row => row.id === faq.id ? faq : row));
      setError('No se pudo cambiar el estado de la FAQ. ' + errorMessage(reason));
    } finally {
      statusRequests.current.delete(faq.id);
      setBusyIds(current => {const nextIds=new Set(current);nextIds.delete(faq.id);return nextIds;});
    }
  }

  const shownGroups: { name: string; rows: SupportFaq[] }[] = [];
  let remaining = visibleCount;
  for (const group of groups) {
    if (remaining <= 0) break;
    const rows = group.rows.slice(0, remaining);
    if (rows.length) shownGroups.push({ name: group.name, rows });
    remaining -= rows.length;
  }

  return <div style={{ padding: '20px 22px', color: fg, background, minHeight: '100%', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 18 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 650 }}>Preguntas frecuentes</h2>
        <div style={{ fontSize: 13, color: muted, marginTop: 5 }}>
          {loading ? 'Cargando FAQs…' : faqs.length + ' FAQs · ' + totalPublished + ' publicadas · ' + totalDrafts + ' borradores'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" style={buttonStyle} disabled={loading || busyIds.size > 0} onClick={() => setRefresh(n => n + 1)}>Actualizar</button>
        <button type="button" style={primaryStyle} disabled={loading || busyIds.size > 0} onClick={() => void openEditor()}>+ Nueva FAQ</button>
      </div>
    </header>

    <section aria-label="Buscar y filtrar FAQs" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <input aria-label="Buscar preguntas o respuestas" value={query} onChange={e => { setQuery(e.target.value); setVisibleCount(INITIAL_VISIBLE); }}
        placeholder="Buscar preguntas, respuestas o variantes…" style={{ ...fieldStyle, flex: '3 1 270px', width: 'auto' }} />
      <select aria-label="Estado" value={status} style={{ ...fieldStyle, flex: '1 1 140px', width: 'auto' }}
        onChange={e => { setStatus(e.target.value); setVisibleCount(INITIAL_VISIBLE); }}>
        <option value="active">Activas y borradores</option>
        <option value="all">Todos los estados</option>
        <option value="PUBLISHED">Publicadas</option>
        <option value="DRAFT">Borradores</option>
        <option value="ARCHIVED">Archivadas</option>
      </select>
      <select aria-label="Idioma" value={language} style={{ ...fieldStyle, flex: '1 1 120px', width: 'auto' }}
        onChange={e => { setLanguage(e.target.value); setVisibleCount(INITIAL_VISIBLE); }}>
        <option value="all">Todos los idiomas</option><option value="CA">Català</option>
        <option value="ES">Español</option><option value="EN">English</option>
      </select>
      <select aria-label="Alcance" value={scope} style={{ ...fieldStyle, flex: '1 1 150px', width: 'auto' }}
        onChange={e => { setScope(e.target.value); setVisibleCount(INITIAL_VISIBLE); }}>
        <option value="all">Todos los alcances</option>
        <option value="none">Sin alcance</option>
        {scopes.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </section>

    {error && <p role="alert" style={{ color: dark ? '#FFB0B0' : '#B42318', margin: 0 }}>{error}</p>}
    {loading && <p style={{ color: muted }}>Cargando preguntas y categorías del workspace…</p>}

    {!loading && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: muted, flexWrap: 'wrap' }}>
      <span>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''} en {groups.length} categoría{groups.length !== 1 ? 's' : ''}</span>
      <span>La vista nativa «FAQs publicadas» sigue disponible desde el objeto FAQ.</span>
    </div>}

    {!loading && !error && filtered.length === 0 && <div style={cardStyle}>No hay FAQs con esos filtros.</div>}
    {!loading && shownGroups.map(group => <section key={group.name} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <h3 style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.5, color: muted, margin: '11px 0 2px' }}>{group.name} ({groups.find(g => g.name === group.name)?.rows.length ?? group.rows.length})</h3>
      {group.rows.map(faq => {
        const opened = expanded.includes(faq.id);
        const isPublished = faq.status === 'PUBLISHED';
        return <article key={faq.id} style={cardStyle}>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 340px', minWidth: 0 }}>
              <div style={{ fontWeight: 650, fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                {faq.question?.trim() || 'Pregunta sin título'}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                color: muted, margin: '6px 0 8px', ...(opened ? {} : {
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                }) }}>{faq.answer || 'Sin respuesta'}</p>
              {(faq.answer?.length ?? 0) > 220 && <button type="button" style={{ ...buttonStyle, padding: '3px 7px', fontSize: 11 }}
                onClick={() => setExpanded(current => current.includes(faq.id) ? current.filter(id => id !== faq.id) : [...current, faq.id])}>
                {opened ? 'Ver menos' : 'Ver respuesta completa'}
              </button>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: muted }}>
                <span>{STATUS[faq.status || 'DRAFT'] || faq.status}</span>
                <span>· {LANGUAGES[faq.language || 'CA'] || 'Idioma sin definir'}</span>
                {faq.scopeTags?.length ? <span>· {faq.scopeTags.join(', ')}</span> : <span>· Sin alcance</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <button type="button" role="switch" aria-checked={isPublished}
                aria-label={'Activa: ' + (faq.question || 'FAQ')}
                aria-busy={busyIds.has(faq.id)}
                title={faq.status === 'ARCHIVED' ? 'Restaura la FAQ antes de activarla'
                  : isPublished ? 'Desactivar FAQ (pasar a borrador)' : 'Activar FAQ (publicar)'}
                disabled={busyIds.has(faq.id) || faq.status === 'ARCHIVED'}
                onClick={() => void updateStatus(faq, isPublished ? 'DRAFT' : 'PUBLISHED')}
                style={{
                  border: 0, background: 'transparent', color: muted, cursor: 'pointer',
                  fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 3px',
                  opacity: faq.status === 'ARCHIVED' ? 0.55 : busyIds.has(faq.id) ? 0.7 : 1,
                }}>
                <span aria-hidden="true" style={{
                  position: 'relative', display: 'inline-block', height: 20, width: 36,
                  borderRadius: 20, background: isPublished ? '#4C5DFF' : dark ? '#606878' : '#CDD3DD',
                  transition: 'background-color 0.15s ease',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: isPublished ? 18 : 2,
                    height: 16, width: 16, borderRadius: 10, background: '#FFFFFF',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.18)', transition: 'left 0.15s ease',
                  }} />
                </span>
                <span>Activa</span>
              </button>
              <button type="button" title="Editar FAQ" aria-label={'Editar FAQ: ' + (faq.question || '')}
                style={{
                  ...buttonStyle, padding: 6, borderColor: 'transparent', background: 'transparent',
                  display: 'inline-flex', justifyContent: 'center', alignItems: 'center',
                }}
                disabled={busyIds.has(faq.id)} onClick={() => void openEditor(faq.id)}>
                <ActionIcon icon="edit" />
              </button>
              <button type="button" title={faq.status === 'ARCHIVED' ? 'Restaurar FAQ' : 'Archivar FAQ'}
                aria-label={(faq.status === 'ARCHIVED' ? 'Restaurar FAQ: ' : 'Archivar FAQ: ') + (faq.question || '')}
                style={{
                  ...buttonStyle, padding: 6, borderColor: 'transparent', background: 'transparent',
                  display: 'inline-flex', justifyContent: 'center', alignItems: 'center',
                }}
                disabled={busyIds.has(faq.id)} onClick={() => void updateStatus(faq, faq.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED')}>
                <ActionIcon icon={faq.status === 'ARCHIVED' ? 'restore' : 'archive'} />
              </button>
            </div>
          </div>
        </article>;
      })}
    </section>)}
    {!loading && filtered.length > visibleCount && <button type="button" style={{ ...buttonStyle, alignSelf: 'center' }}
      onClick={() => setVisibleCount(value => value + INITIAL_VISIBLE)}>
      Mostrar más FAQs ({Math.min(INITIAL_VISIBLE, filtered.length - visibleCount)} siguientes)
    </button>}
  </div>;
}


export function FaqManagerEntry() {
  const objectMetadata = useSelectedObjectMetadata();
  const selectedRecordIds = useSelectedRecordIds();
  const frontComponentId = useFrontComponentId();

  // A standalone page has no selected object. The native side panel provides
  // the supportFaq context, even for a new FAQ without a selected record.
  if (objectMetadata?.nameSingular === 'supportFaq') {
    return <FaqEditorSidePanel recordId={selectedRecordIds.length === 1 ? selectedRecordIds[0] : null} />;
  }
  return <FaqManager frontComponentId={frontComponentId} />;
}

