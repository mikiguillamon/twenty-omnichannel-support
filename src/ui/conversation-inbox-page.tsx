import { useEffect, useState, type FormEvent } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { AppPath, copyToClipboard, navigate, useColorScheme, useLocation } from 'twenty-sdk/front-component';
import {
  CONVERSATION_PAGE_SIZE, CONVERSATION_SEARCH_LIMIT, CONVERSATION_VIEW_NAME_LIMIT,
  conversationChannels, conversationFollowUps, conversationStatuses, conversationTagLabels, isRecordUuid,
  loadConversationCatalog, loadConversationPage, loadConversationViews, normalizeConversationFilters, saveConversationView,
  type ConversationCatalogItem, type ConversationFilters, type ConversationPage, type ConversationRow, type ConversationView,
} from '../lib/conversation-inbox.ts';
import {
  CONVERSATION_VIEW_PARAM, conversationViewLink, publishConversationViewLink, readConversationViewId,
} from '../lib/conversation-inbox-navigation.ts';
import {
  ConversationPanel, ConversationTable, InboxIcon, InboxSelect, InboxState, conversationCatalogLabel, type InboxCatalogs,
} from './conversation-inbox-list.tsx';
import { ConversationInboxStyles } from './conversation-inbox-styles.tsx';
import { stringTags, tagKey } from '../lib/tag-values.ts';

type LoadResult = { data: ConversationPage; key: string } | { error: string; key: string };
type ViewEditor = { id?: string; name: string };
type ActionMessage = { level: 'error' | 'success'; text: string };
const blankFilters: ConversationFilters = { sort: 'recent' };
const blankCatalogs: InboxCatalogs = { channels: [], types: [], categories: [] };
const channelOptions = Object.entries(conversationChannels);
const statusOptions = Object.entries(conversationStatuses);
const followUpOptions = Object.entries(conversationFollowUps);

function catalogOptions(items: ConversationCatalogItem[], current?: string): Array<[string, string]> {
  const options = items.map((item): [string, string] => [item.id, conversationCatalogLabel(item)])
    .sort((a, b) => a[1].localeCompare(b[1], 'es'));
  if (current && !options.some(([id]) => id === current)) options.unshift([current, 'Selección guardada']);
  return options;
}

function listError(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) {
    return 'Tu rol no tiene acceso a estas conversaciones.';
  }
  return 'No se pudo consultar la bandeja. Puedes volver a intentarlo con los mismos filtros.';
}

export function ConversationInbox() {
  const theme = useColorScheme();
  const location = useLocation();
  const pathname = location?.pathname ?? '';
  const linkedViewId = readConversationViewId(location?.search ?? '');
  const [filters, setFilters] = useState<ConversationFilters>(blankFilters);
  const [search, setSearch] = useState('');
  const [customTagText, setCustomTagText] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [appliedLink, setAppliedLink] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState('');
  const [catalogs, setCatalogs] = useState<InboxCatalogs>(blankCatalogs);
  const [catalogProblem, setCatalogProblem] = useState(false);
  const [views, setViews] = useState<ConversationView[] | null>(null);
  const [viewsError, setViewsError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [listVersion, setListVersion] = useState(0);
  const [pagination, setPagination] = useState<{ key: string; cursors: string[] }>({ key: '', cursors: [] });
  const [result, setResult] = useState<LoadResult | null>(null);
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [editor, setEditor] = useState<ViewEditor | null>(null);
  const [menuName, setMenuName] = useState<string | null>(null);
  const [action, setAction] = useState<ActionMessage | null>(null);
  const [working, setWorking] = useState<'save' | 'menu' | null>(null);
  const [sharedLink, setSharedLink] = useState('');

  const filterKey = JSON.stringify(normalizeConversationFilters(filters));
  const cursors = pagination.key === filterKey ? pagination.cursors : [];
  const cursor = cursors.at(-1);
  const requestKey = JSON.stringify([filterKey, cursor, listVersion]);
  const waitingForView = linkedViewId !== null && appliedLink !== linkedViewId;
  const loading = waitingForView || result?.key !== requestKey;
  const page = !loading && result && 'data' in result ? result.data : null;
  const error = !loading && result && 'error' in result ? result.error : '';
  const currentView = views?.find(item => item.id === viewId);
  const hasTagFilters = Boolean(filters.tag || filters.customTag);
  const hasFilters = Boolean(search.trim() || customTagText.trim() || hasTagFilters || filters.channel || filters.status || filters.followUp || filters.caseTypeId || filters.categoryId || filters.channelInstanceId);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const next = normalizeConversationFilters({ search, customTag: customTagText });
      if (filters.search === next.search && filters.customTag === next.customTag) return;
      setFilters(previous => ({ ...previous, search: next.search, customTag: next.customTag }));
      setPagination({ key: '', cursors: [] });
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, customTagText, filters.search, filters.customTag]);

  useEffect(() => {
    let current = true;
    const client = new RestApiClient();
    void Promise.allSettled([
      loadConversationCatalog(client, 'supportChannels'),
      loadConversationCatalog(client, 'supportTypes'),
      loadConversationCatalog(client, 'supportCategories'),
    ]).then(([channels, types, categories]) => {
      if (!current) return;
      setCatalogs({
        channels: channels.status === 'fulfilled' ? channels.value : [],
        types: types.status === 'fulfilled' ? types.value : [],
        categories: categories.status === 'fulfilled' ? categories.value : [],
      });
      setCatalogProblem([channels, types, categories].some(item => item.status === 'rejected'));
    });
    void loadConversationViews(client).then(items => {
      if (!current) return;
      setViews(items);
      setViewsError(false);
    }).catch(() => {
      if (!current) return;
      setViews(previous => previous ?? []);
      setViewsError(true);
    });
    return () => { current = false; };
  }, [loadVersion]);

  useEffect(() => {
    if (!linkedViewId) {
      if (!appliedLink) return;
      setAppliedLink(null);
      setLinkNotice('');
      return;
    }
    if (!views || linkedViewId === appliedLink) return;
    const target = views.find(item => item.id === linkedViewId);
    changeView(target);
    setLinkNotice(target ? '' : 'La vista del enlace ya no está disponible o tu rol no permite consultarla.');
    setAppliedLink(linkedViewId);
  }, [views, linkedViewId, appliedLink]);

  useEffect(() => {
    if (waitingForView) return;
    let current = true;
    const requestFilters = JSON.parse(filterKey) as ConversationFilters;
    void loadConversationPage(new RestApiClient(), requestFilters, cursor).then(data => {
      if (current) setResult({ key: requestKey, data });
    }).catch(reason => {
      if (current) setResult({ key: requestKey, error: listError(reason) });
    });
    return () => { current = false; };
  }, [filterKey, cursor, requestKey, waitingForView]);

  function changeView(item?: ConversationView) {
    setFilters(item?.filters ?? blankFilters);
    setSearch(item?.filters.search ?? '');
    setCustomTagText(item?.filters.customTag ?? '');
    setViewId(item?.id ?? null);
    setPagination({ key: '', cursors: [] });
    setSelected(null);
    setEditor(null);
    setMenuName(null);
    setAction(null);
    setSharedLink('');
  }

  function clearFilters() {
    setSearch('');
    setCustomTagText('');
    setFilters(blankFilters);
    setPagination({ key: '', cursors: [] });
    setSelected(null);
  }

  function changeFilter<K extends keyof ConversationFilters>(key: K, value: ConversationFilters[K]) {
    if (key === 'customTag') setCustomTagText(String(value ?? ''));
    setFilters(previous => normalizeConversationFilters({ ...previous, [key]: value,
      ...(key === 'channel' ? { channelInstanceId: undefined } : {}),
    }));
    setPagination({ key: '', cursors: [] });
    setSelected(null);
  }

  function sendViewToLocation(id: string | null) {
    const pageLayoutId = pathname.startsWith('/page/') ? pathname.slice('/page/'.length) : null;
    if (!isRecordUuid(pageLayoutId) || id === linkedViewId) return;
    void navigate(AppPath.PageLayoutPage, { pageLayoutId }, id ? { [CONVERSATION_VIEW_PARAM]: id } : undefined).catch(() => {
      // The in-page selection still works. A saved URL is always available via Copy link.
    });
  }

  function selectView(id: string) {
    changeView(views?.find(item => item.id === id));
    setLinkNotice('');
    sendViewToLocation(id || null);
  }

  async function submitView(event: FormEvent) {
    event.preventDefault();
    if (!editor?.name.trim() || working) return;
    setWorking('save');
    setAction(null);
    try {
      const item = await saveConversationView(new RestApiClient(), editor.name, { ...filters, search, customTag: customTagText }, editor.id);
      setViews(current => [...(current ?? []).filter(view => view.id !== item.id), item]
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })));
      setViewId(item.id);
      setEditor(null);
      setSharedLink('');
      setAction({ level: 'success', text: 'Vista guardada.' });
    } catch {
      setAction({ level: 'error', text: 'No se pudo guardar la vista. Comprueba los permisos del objeto Vistas de conversaciones.' });
    } finally {
      setWorking(null);
    }
  }

  async function copyView() {
    if (!currentView) return;
    const link = conversationViewLink(pathname, currentView.id);
    if (!link) return;
    setSharedLink('');
    try {
      await copyToClipboard(location?.origin ? new URL(link, location.origin).href : link);
      setAction({ level: 'success', text: 'Enlace de la vista copiado.' });
    } catch {
      setSharedLink(link);
      setAction({ level: 'error', text: 'Selecciona el enlace de la vista para copiarlo.' });
    }
  }

  async function addViewToMenu(event: FormEvent) {
    event.preventDefault();
    if (!currentView || working || !menuName?.trim()) return;
    setWorking('menu');
    setAction(null);
    try {
      const publication = await publishConversationViewLink(pathname, currentView, undefined, menuName);
      setMenuName(null);
      setAction({ level: 'success', text: publication === 'created' ? 'Vista añadida al menú del workspace.' : 'La vista ya tiene un acceso. Puedes renombrarlo desde Administración → Accesos.' });
    } catch {
      setAction({ level: 'error', text: 'No se pudo añadir al menú. Comprueba si tienes permiso de Diseños o copia el enlace para añadirlo desde el menú de Twenty.' });
    } finally {
      setWorking(null);
    }
  }

  function refresh() {
    setLoadVersion(n => n + 1);
    setListVersion(n => n + 1);
  }

  const availableAccounts = catalogs.channels.filter(item => !filters.channel || item.channelType === filters.channel);
  const accountLabel = filters.channel === 'EMAIL' ? 'Buzón' : filters.channel === 'PHONE' ? 'Línea' : 'Cuenta o número';
  const searchHint = filters.channel === 'EMAIL' ? 'Buscar por asunto o correo' : filters.channel === 'PHONE'
    ? 'Buscar por teléfono o resumen' : 'Buscar por asunto, correo o teléfono';
  const shareAvailable = currentView ? Boolean(conversationViewLink(pathname, currentView.id)) : false;
  const hasUnsavedFilters = currentView && JSON.stringify(normalizeConversationFilters({ ...filters, search, customTag: customTagText })) !== JSON.stringify(currentView.filters);
  const tagOptions = new Map(Object.entries(conversationTagLabels));
  for (const tag of stringTags([...(page?.rows.flatMap(row => row.tags ?? []) ?? []), filters.tag])) {
    if (!tagOptions.has(tag)) tagOptions.set(tag, tag);
  }
  const visibleCustomTags = stringTags(result && 'data' in result ? result.data.rows.flatMap(row => row.customTags ?? []) : [])
    .sort((a, b) => a.localeCompare(b, 'es'));
  const selectedCustomTag = visibleCustomTags.find(tag => tagKey(tag) === tagKey(customTagText.trim())) ?? '';
  const pageStart = cursors.length * CONVERSATION_PAGE_SIZE + 1;
  const pageEnd = pageStart + (page?.rows.length ?? 0) - 1;

  return <section className="omni-inbox" data-theme={theme}>
    <ConversationInboxStyles />
    <div className="omni-inbox__list-controls" data-detail-open={Boolean(selected)}>
      <header className="omni-inbox__heading">
        <h1>Conversaciones</h1>
        <button className="omni-inbox__control" type="button" onClick={refresh} disabled={loading}>
          <InboxIcon name="refresh" />Actualizar
        </button>
      </header>

      <div className="omni-inbox__toolbar" aria-label="Vistas de conversaciones">
        <InboxSelect label="Vista" value={viewId ?? ''} allLabel="Todas las conversaciones" options={(views ?? []).map(view => [view.id, view.name])}
          disabled={views === null || working !== null} onChange={selectView} />
        <div className="omni-inbox__actions">
          {hasUnsavedFilters && <span className="omni-inbox__note">Filtros sin guardar</span>}
          {currentView && <button type="button" className="omni-inbox__control" disabled={working !== null} onClick={() => { setMenuName(null); setEditor({ id: currentView.id, name: currentView.name }); }}>Editar vista</button>}
          {currentView && <button type="button" className="omni-inbox__control" disabled={!shareAvailable || working !== null} onClick={() => void copyView()}>Copiar enlace</button>}
          {currentView && <button type="button" className="omni-inbox__control" disabled={!shareAvailable || working !== null}
            onClick={() => { setEditor(null); setAction(null); setMenuName(currentView.name); }}>Añadir al menú</button>}
          <button type="button" className="omni-inbox__control" data-primary="true" disabled={views === null || viewsError || working !== null}
            onClick={() => { setAction(null); setMenuName(null); setEditor({ name: '' }); }}>Guardar vista</button>
        </div>
      </div>

      {editor && <form className="omni-inbox__view-editor" onSubmit={event => void submitView(event)}>
        <label className="omni-inbox__field"><span>Nombre de la vista</span>
          <input className="omni-inbox__input" value={editor.name} maxLength={CONVERSATION_VIEW_NAME_LIMIT}
            placeholder="Por ejemplo, correo en curso" onChange={event => setEditor({ ...editor, name: event.target.value })} required disabled={working === 'save'} />
        </label>
        <button type="submit" className="omni-inbox__control" data-primary="true" disabled={!editor.name.trim() || working !== null}>{working === 'save' ? 'Guardando…' : 'Guardar filtros'}</button>
        <button type="button" className="omni-inbox__control" disabled={working === 'save'} onClick={() => setEditor(null)}>Cancelar</button>
      </form>}
      {menuName !== null && <form className="omni-inbox__view-editor" onSubmit={event => void addViewToMenu(event)}>
        <label className="omni-inbox__field"><span>Nombre en el menú</span>
          <input className="omni-inbox__input" value={menuName} maxLength={CONVERSATION_VIEW_NAME_LIMIT}
            onChange={event => setMenuName(event.target.value)} required disabled={working === 'menu'} />
        </label>
        <button type="submit" className="omni-inbox__control" data-primary="true"
          disabled={menuName.trim().length < 2 || working !== null}>{working === 'menu' ? 'Añadiendo…' : 'Crear acceso'}</button>
        <button type="button" className="omni-inbox__control" disabled={working === 'menu'} onClick={() => setMenuName(null)}>Cancelar</button>
      </form>}
      {action && <p className={action.level === 'error' ? 'omni-inbox__alert' : 'omni-inbox__notice'} role={action.level === 'error' ? 'alert' : 'status'}>{action.text}</p>}
      {sharedLink && <label className="omni-inbox__field" style={{ marginBottom: 12 }}><span>Enlace de la vista</span><input className="omni-inbox__input" readOnly value={sharedLink} /></label>}
      {viewsError && <p className="omni-inbox__alert" role="status">Las vistas guardadas no están disponibles. Puedes seguir usando los filtros de esta bandeja.</p>}
      {linkNotice && <p className="omni-inbox__alert" role="status">{linkNotice}</p>}

      <section className="omni-inbox__filterbar" aria-label="Filtrar conversaciones">
        <div className="omni-inbox__controls">
          <label className="omni-inbox__search"><InboxIcon name="search" />
            <input className="omni-inbox__input" type="search" aria-label="Buscar por asunto, correo, teléfono o resumen" placeholder={searchHint}
              value={search} onChange={event => { setSearch(event.target.value); setSelected(null); }} maxLength={CONVERSATION_SEARCH_LIMIT} />
          </label>
          <label className="omni-inbox__visually-hidden" htmlFor="omni-inbox-order">Orden de actividad</label>
          <select className="omni-inbox__select" id="omni-inbox-order" value={filters.sort ?? 'recent'} onChange={event => changeFilter('sort', event.target.value as ConversationFilters['sort'])}>
            <option value="recent">Más recientes</option><option value="oldest">Más antiguas</option>
          </select>
          {hasFilters && <button type="button" className="omni-inbox__control" onClick={clearFilters}>Limpiar filtros</button>}
        </div>
        <div className="omni-inbox__filters">
          <InboxSelect label="Canal" value={filters.channel ?? ''} allLabel="Todos" options={channelOptions} onChange={value => changeFilter('channel', value as ConversationFilters['channel'])} />
          <InboxSelect label={accountLabel} value={filters.channelInstanceId ?? ''} allLabel="Todas" options={catalogOptions(availableAccounts, filters.channelInstanceId)} onChange={value => changeFilter('channelInstanceId', value)} />
          <InboxSelect label="Tipo" value={filters.caseTypeId ?? ''} allLabel="Todos" options={catalogOptions(catalogs.types, filters.caseTypeId)} onChange={value => changeFilter('caseTypeId', value)} />
          <InboxSelect label="Estado" value={filters.status ?? ''} allLabel="Todos" options={statusOptions} onChange={value => changeFilter('status', value as ConversationFilters['status'])} />
          <InboxSelect label="Categoría" value={filters.categoryId ?? ''} allLabel="Todas" options={catalogOptions(catalogs.categories, filters.categoryId)} onChange={value => changeFilter('categoryId', value)} />
          <InboxSelect label="Seguimiento" value={filters.followUp ?? ''} allLabel="Todos" options={followUpOptions} onChange={value => changeFilter('followUp', value as ConversationFilters['followUp'])} />
          <InboxSelect label="Etiqueta" value={filters.tag ?? ''} allLabel="Todas" options={[...tagOptions]} onChange={value => changeFilter('tag', value)} />
          <label className="omni-inbox__field"><span>Etiqueta propia</span>
            <input className="omni-inbox__input" value={customTagText} maxLength={120} placeholder="Nombre exacto"
              onChange={event => { setCustomTagText(event.target.value); setSelected(null); }} />
          </label>
          {visibleCustomTags.length > 0 && <InboxSelect label="Etiquetas propias visibles" value={selectedCustomTag}
            allLabel="Seleccionar etiqueta" options={visibleCustomTags.map(tag => [tag, tag])} onChange={value => changeFilter('customTag', value)} />}
        </div>
        {catalogProblem && <p role="status" className="omni-inbox__note" style={{ marginTop: 8 }}>Algunos filtros de catálogo no están disponibles para tu rol.</p>}
      </section>
    </div>

    <div className="omni-inbox__workspace" data-has-detail={Boolean(selected)}>
      {selected && <ConversationPanel key={selected.id} row={selected} catalogs={catalogs} onClose={() => setSelected(null)}
        onStatusChange={status => {
          setSelected(current => current?.id === selected.id ? { ...current, status } : current);
          setListVersion(n => n + 1);
        }} />}
      <section className="omni-inbox__list" aria-label="Resultados de conversaciones">
        {(loading || Boolean(page?.rows.length)) && <ConversationTable rows={page?.rows ?? []} loading={loading} catalogs={catalogs}
          onSelect={setSelected} onFilterTag={changeFilter} selectedId={selected?.id ?? null} />}
        {error && <InboxState title="No se pudieron cargar las conversaciones">
          <p className="omni-inbox__note">{error}</p><button type="button" className="omni-inbox__control" onClick={() => setListVersion(n => n + 1)}>Reintentar</button>
        </InboxState>}
        {page && page.rows.length === 0 && <InboxState title={page.nextCursor ? 'Sin coincidencias en este tramo' : hasFilters ? 'Ninguna conversación coincide' : 'Todavía no hay conversaciones'}>
          {page.nextCursor && <p className="omni-inbox__note">Usa Siguiente para seguir buscando en las conversaciones restantes.</p>}
          {hasFilters && <button type="button" className="omni-inbox__control" onClick={clearFilters}>Limpiar filtros</button>}
        </InboxState>}
        {page && (page.rows.length > 0 || cursors.length > 0 || page.nextCursor) && <footer className="omni-inbox__pager">
          <span role="status">{hasTagFilters ? `${page.rows.length} ${page.rows.length === 1 ? 'coincidencia' : 'coincidencias'} en esta página` :
            page.rows.length > 0 ? `${pageStart}–${pageEnd}${page.totalCount === null ? '' : ` de ${page.totalCount}`}` : `Página ${cursors.length + 1}`}</span>
          <div className="omni-inbox__actions">
            <button type="button" className="omni-inbox__control" disabled={!cursors.length} onClick={() => setPagination({ key: filterKey, cursors: cursors.slice(0, -1) })}><InboxIcon name="left" />Anterior</button>
            <button type="button" className="omni-inbox__control" disabled={!page.nextCursor || cursors.includes(page.nextCursor)} onClick={() => {
              if (page.nextCursor) setPagination({ key: filterKey, cursors: [...cursors, page.nextCursor] });
            }}>Siguiente<InboxIcon name="right" /></button>
          </div>
        </footer>}
      </section>
    </div>
  </section>;
}
