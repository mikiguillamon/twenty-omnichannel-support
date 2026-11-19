import { useEffect, useMemo, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { openCommandConfirmationModal, useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import {
  blankFaqEditor, editorFromFaq, faqEditorPayload, fetchAllRestRecords, filterFaqs,
} from '../lib/faq-manager.ts';
import type { FaqEditor, FaqStatus, SupportFaq, SupportFaqCategory } from '../lib/faq-manager.ts';

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

function FaqManager() {
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<FaqEditor | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

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

  function beginCreate() {
    setEditingId('new'); setEditor(blankFaqEditor()); setAdvanced(false);
    setError(''); setFeedback('');
  }
  function beginEdit(faq: SupportFaq) {
    setEditingId(faq.id); setEditor(editorFromFaq(faq));
    setAdvanced(false); setError(''); setFeedback('');
  }
  function cancelEdit() { setEditingId(null); setEditor(null); setAdvanced(false); }
  function updateEditor<K extends keyof FaqEditor>(field: K, value: FaqEditor[K]) {
    setEditor(previous => previous ? { ...previous, [field]: value } : null);
  }
  async function saveEditor() {
    if (!editor || !editingId || busyId) return;
    const previous = faqs.find(faq => faq.id === editingId);
    setBusyId(editingId); setError(''); setFeedback('');
    try {
      const payload = faqEditorPayload(editor, previous);
      const api = new RestApiClient();
      if (editingId === 'new') {
        await api.post('/rest/supportFaqs', payload);
        setFeedback('FAQ creada correctamente.');
      } else {
        await api.patch('/rest/supportFaqs/' + encodeURIComponent(editingId), payload);
        setFeedback('FAQ actualizada correctamente.');
      }
      cancelEdit(); setRefresh(value => value + 1);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally { setBusyId(null); }
  }
  async function updateStatus(faq: SupportFaq, next: FaqStatus) {
    if (busyId || loading) return;
    if (next === 'ARCHIVED') {
      const answer = await openCommandConfirmationModal({
        title: '¿Archivar esta FAQ?',
        subtitle: 'Dejará de estar publicada para los bots. Podrás restaurarla desde el filtro Archivadas.',
        confirmButtonText: 'Archivar',
        confirmButtonAccent: 'danger',
      });
      if (answer !== 'confirm') return;
    }
    setBusyId(faq.id); setError(''); setFeedback('');
    try {
      await new RestApiClient().patch('/rest/supportFaqs/' + encodeURIComponent(faq.id), {
        status: next,
        ...(next === 'PUBLISHED' && !faq.publishedAt ? { publishedAt: new Date().toISOString() } : {}),
      });
      setFeedback('Estado de la FAQ actualizado.');
      setRefresh(value => value + 1);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusyId(null); }
  }

  const shownGroups: { name: string; rows: SupportFaq[] }[] = [];
  let remaining = visibleCount;
  for (const group of groups) {
    if (remaining <= 0) break;
    const rows = group.rows.slice(0, remaining);
    if (rows.length) shownGroups.push({ name: group.name, rows });
    remaining -= rows.length;
  }
  const isEditing = editor !== null;

  return <div style={{ padding: '20px 22px', color: fg, background, minHeight: '100%', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 18 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 650 }}>Preguntas frecuentes</h2>
        <div style={{ fontSize: 13, color: muted, marginTop: 5 }}>
          {loading ? 'Cargando FAQs…' : faqs.length + ' FAQs · ' + totalPublished + ' publicadas · ' + totalDrafts + ' borradores'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" style={buttonStyle} disabled={loading || Boolean(busyId)} onClick={() => setRefresh(n => n + 1)}>Actualizar</button>
        <button type="button" style={primaryStyle} disabled={loading || Boolean(busyId)} onClick={beginCreate}>+ Nueva FAQ</button>
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
    {feedback && <p role="status" style={{ color: dark ? '#8DE0AD' : '#257549', margin: 0 }}>{feedback}</p>}
    {loading && <p style={{ color: muted }}>Cargando preguntas y categorías del workspace…</p>}

    {isEditing && <section aria-label={editingId === 'new' ? 'Crear FAQ' : 'Editar FAQ'} style={{ ...cardStyle, borderColor: dark ? '#8490FF' : '#8C97FF', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <strong style={{ fontSize: 16 }}>{editingId === 'new' ? 'Nueva FAQ' : 'Editar FAQ'}</strong>
        <button type="button" style={buttonStyle} disabled={Boolean(busyId)} onClick={cancelEdit}>Cerrar</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <label style={{ fontSize: 12 }}>Categoría
          <select style={{ ...fieldStyle, marginTop: 5 }} value={editor.categoryId} onChange={e => updateEditor('categoryId', e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map(category => <option key={category.id} value={category.id}>
              {categoryLabels.get(category.id)}{category.enabled === false ? ' (inactiva)' : ''}
            </option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Idioma
          <select style={{ ...fieldStyle, marginTop: 5 }} value={editor.language} onChange={e => updateEditor('language', e.target.value as FaqEditor['language'])}>
            {Object.entries(LANGUAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Estado
          <select style={{ ...fieldStyle, marginTop: 5 }} value={editor.status} onChange={e => updateEditor('status', e.target.value as FaqStatus)}>
            <option value="DRAFT">Borrador</option><option value="PUBLISHED">Publicada</option><option value="ARCHIVED">Archivada</option>
          </select>
        </label>
      </div>
      <label style={{ fontSize: 12 }}>Pregunta *
        <textarea value={editor.question} rows={2} maxLength={2000} style={{ ...fieldStyle, marginTop: 5, resize: 'vertical' }}
          onChange={e => updateEditor('question', e.target.value)} />
      </label>
      <label style={{ fontSize: 12 }}>Respuesta *
        <textarea value={editor.answer} rows={5} maxLength={25000} style={{ ...fieldStyle, marginTop: 5, resize: 'vertical' }}
          onChange={e => updateEditor('answer', e.target.value)} />
      </label>
      <button type="button" style={{ ...buttonStyle, alignSelf: 'flex-start' }} onClick={() => setAdvanced(value => !value)}>
        {advanced ? 'Ocultar opciones avanzadas' : 'Mostrar opciones avanzadas'}
      </button>
      {advanced && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12 }}>Alcances (separados por coma o salto de línea)
          <textarea style={{ ...fieldStyle, marginTop: 5 }} rows={2} value={editor.scopeTags} onChange={e => updateEditor('scopeTags', e.target.value)} />
        </label>
        <label style={{ fontSize: 12 }}>Variantes de pregunta (una por línea)
          <textarea style={{ ...fieldStyle, marginTop: 5 }} rows={3} value={editor.variants} onChange={e => updateEditor('variants', e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {TAG_OPTIONS.map(tag => <label key={tag} style={{ fontSize: 12, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={editor.tags.includes(tag)}
              onChange={e => updateEditor('tags', e.target.checked ? [...editor.tags, tag] : editor.tags.filter(value => value !== tag))} />
            {tag}
          </label>)}
        </div>
        <label style={{ fontSize: 12 }}>Etiquetas propias (separadas por coma)
          <input style={{ ...fieldStyle, marginTop: 5 }} value={editor.customTags} onChange={e => updateEditor('customTags', e.target.value)} />
        </label>
        <label style={{ fontSize: 12 }}>URL de referencia (HTTPS)
          <input style={{ ...fieldStyle, marginTop: 5 }} value={editor.sourceUrl} onChange={e => updateEditor('sourceUrl', e.target.value)} />
        </label>
        <label style={{ fontSize: 12 }}>Revisado por
          <input style={{ ...fieldStyle, marginTop: 5 }} value={editor.updatedByReference} onChange={e => updateEditor('updatedByReference', e.target.value)} />
        </label>
      </div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" style={buttonStyle} disabled={Boolean(busyId)} onClick={cancelEdit}>Cancelar</button>
        <button type="button" style={primaryStyle} disabled={Boolean(busyId)} onClick={() => void saveEditor()}>
          {busyId ? 'Guardando…' : 'Guardar FAQ'}
        </button>
      </div>
    </section>}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, flexWrap: 'wrap' }}>
              <label title="Publicar o pasar a borrador" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: muted }}>
                <input aria-label={'Publicar ' + (faq.question ?? 'FAQ')} type="checkbox" checked={isPublished}
                  disabled={Boolean(busyId)} onChange={e => void updateStatus(faq, e.target.checked ? 'PUBLISHED' : 'DRAFT')} />
                {isPublished ? 'Publicada' : 'Sin publicar'}
              </label>
              <button type="button" style={buttonStyle} disabled={Boolean(busyId)} onClick={() => beginEdit(faq)}>Editar</button>
              {faq.status === 'ARCHIVED'
                ? <button type="button" style={buttonStyle} disabled={Boolean(busyId)} onClick={() => void updateStatus(faq, 'DRAFT')}>Restaurar</button>
                : <button type="button" style={buttonStyle} disabled={Boolean(busyId)} onClick={() => void updateStatus(faq, 'ARCHIVED')}>Archivar</button>}
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

export default defineFrontComponent({
  universalIdentifier: IDS.FRONT_FAQ_MANAGER,
  name: 'faq-manager',
  description: 'Gestión visual de preguntas frecuentes con categorías, filtros y editor.',
  component: FaqManager,
});
