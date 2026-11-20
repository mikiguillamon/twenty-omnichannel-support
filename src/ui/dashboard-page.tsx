import { useEffect, useId, useRef, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { copyToClipboard, openCommandConfirmationModal, useColorScheme, useLocation } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import {
  WIDGET_LABELS, PERIOD_LABELS, MAX_DASHBOARDS, MAX_WIDGETS, MAX_WIDGET_FILTERS,
  createDashboard, defaultDashboard, makeWidget, moveDashboardWidget, resizeDashboardWidgetTo, newId, normalizeWidget, periodFrom,
  type Source, type WidgetKind, type Dashboard, type DashboardWidget, type DashboardFilter, type Period, type StoredDashboard,
} from '../lib/dashboard-model.ts';
import { loadDashboards, persistDashboard, removeDashboard, migrateLegacyDashboards, importDashboard, exportDashboard } from '../lib/dashboard-store.ts';
import { dashboardValues, fetchWorkspaceDataset, workspaceWidgetFields, type Dataset } from '../lib/dashboard-analytics.ts';
import {
  builtinDashboardCatalog, displayDashboardValue, fieldLabel, fieldOptions, loadDashboardCatalog,
  type DashboardCatalog, type DashboardField, type DashboardSource,
} from '../lib/dashboard-metadata.ts';
import { readDashboardFromSearch, getDashboardLink } from '../lib/dashboard-links.ts';
import { DashboardVisualization } from '../front-components/dashboard-visualization.tsx';

const KINDS=Object.keys(WIDGET_LABELS) as WidgetKind[];
const PERIOD_KEYS=Object.keys(PERIOD_LABELS) as Period['key'][];
const NUMERIC=['sum','avg','min','max','distinct'];
const CALCULATIONS: Record<DashboardWidget['aggregation'], string> = {
  count: 'Contar registros', ratio: 'Porcentaje de registros', distinct: 'Valores únicos',
  sum: 'Suma', avg: 'Promedio', min: 'Mínimo', max: 'Máximo',
};
const WIDTHS=[3,4,6,8,12] as const;
type SourceResult = { signature: string; data?: Dataset; error?: string };
type FilterDraft = DashboardFilter & { index?: number };
const emptyFilter: FilterDraft = { field: '', operator: 'eq', value: '' };
const filterModes = [['eq', 'Incluir'], ['neq', 'Excluir']] as const;
const filterConditions = {
  array: { eq: 'Incluye', neq: 'No incluye' },
  scalar: { eq: 'Es igual a', neq: 'Es distinto de' },
};

function referenceDates(fields: DashboardField[], kind: WidgetKind): DashboardField[] {
  return fields.filter(field => field.kind === 'dateTime' || (kind !== 'hour' && field.kind === 'date'));
}

function usingSource(widget: DashboardWidget, source: DashboardSource): DashboardWidget {
  const fields = [...source.fields.values()];
  const dates = referenceDates(fields, widget.kind);
  const dateField = dates.find(field => field.key === widget.dateField)?.key ?? dates[0]?.key ?? '';
  const groupBy = source.fields.has(widget.groupBy) ? widget.groupBy : fields[0]?.key ?? '';
  return { ...widget, dateField, groupBy };
}

function widgetDataMessage(widget: DashboardWidget, source: DashboardSource | undefined): string | undefined {
  if (widget.kind === 'text' || widget.kind === 'shortcut') return undefined;
  if (!source || workspaceWidgetFields(widget).some(key => !source.fields.has(key))) {
    return 'El objeto o alguno de sus campos ya no está disponible para tu usuario.';
  }
  if (widget.kind === 'line' || widget.kind === 'area' || widget.kind === 'hour' || widget.dateField) {
    if (!referenceDates([...source.fields.values()], widget.kind).some(field => field.key === widget.dateField)) {
      return widget.kind === 'hour' ? 'Selecciona un campo de fecha y hora.' : 'Selecciona un campo de fecha de referencia.';
    }
  }
  if (widget.aggregation === 'ratio' && (!widget.ratioField || !widget.ratioValue)) return 'Selecciona el campo y el valor del porcentaje.';
  if (widget.aggregation === 'distinct' && !widget.valueField) return 'Selecciona un campo para contar sus valores únicos.';
  if (NUMERIC.includes(widget.aggregation) && widget.aggregation !== 'distinct' && source.fields.get(widget.valueField)?.kind !== 'number') {
    return 'Selecciona un campo numérico para este cálculo.';
  }
  return undefined;
}

const responsiveDashboardStyles = `
.omni-dashboard { container-name: omni-dashboard; container-type: inline-size; }
.omni-dashboard__widget-editor { flex: 0 1 295px; min-width: min(255px, 100%); }
.omni-dashboard__filter-editor { display: grid; gap: 12px; }
.omni-dashboard__filter-field { display: grid; gap: 5px; min-width: 0; }
.omni-dashboard__filter-mode { display: flex; gap: 6px; align-items: center; justify-content: center; }
.omni-dashboard__filter-mode input { margin: 0; }
.omni-dashboard__filter-mode:focus-within { outline: 2px solid currentColor; outline-offset: 2px; }
.omni-dashboard__filter-editor :is(button, input, select):disabled { cursor: default; opacity: .65; }
@container omni-dashboard (width <= 800px) {
  .omni-dashboard__grid { --omni-dashboard-columns: 2; }
  .omni-dashboard__widget-editor { flex-basis: 100%; }
  .omni-dashboard__widget { --omni-dashboard-responsive-span: 1; }
  .omni-dashboard__widget[data-wide='true'] { --omni-dashboard-responsive-span: 2; }
}
@container omni-dashboard (width <= 520px) {
  .omni-dashboard__grid { --omni-dashboard-columns: 1; }
  .omni-dashboard__widget[data-wide] { --omni-dashboard-responsive-span: 1; }
}
`;

export function Dashboards({ embedded = false, enableLinks = true, enableMigration = false }: {
  embedded?: boolean;
  enableLinks?: boolean;
  enableMigration?: boolean;
} = {}) {
  const dark=useColorScheme()==='dark';
  const location=useLocation();
  const requestedDashboard=readDashboardFromSearch(location?.search??'');
  const handledLink=useRef<string|null>(null);
  const pointerSource=useRef<string|null>(null);
  const resizeSource=useRef<{id:string;startX:number;startY:number;width:number;height:number}|null>(null);
  const [stored,setStored]=useState<StoredDashboard[]>([]);
  const [active,setActive]=useState('');
  const [draft,setDraft]=useState<Dashboard|null>(null);
  const [editing,setEditing]=useState(false);
  const [editingWidget,setEditingWidget]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [feedback,setFeedback]=useState('');
  const [reload,setReload]=useState(0);
  const [catalogState,setCatalogState]=useState<{ catalog: DashboardCatalog; fallback?: boolean } | null>(null);
  const [sourceResults,setSourceResults]=useState<Partial<Record<Source,SourceResult>>>({});
  const [importOpen,setImportOpen]=useState(false);
  const [importJson,setImportJson]=useState('');
  const [draggingId,setDraggingId]=useState<string|null>(null);
  const [resizingId,setResizingId]=useState<string|null>(null);
  const [dropTarget,setDropTarget]=useState<string|null>(null);
  const [linkHelp,setLinkHelp]=useState(false);
  const [addKind,setAddKind]=useState<WidgetKind>('kpi');
  const [addSource,setAddSource]=useState<Source>('supportCases');
  const [filterDraft, setFilterDraft] = useState<FilterDraft>(emptyFilter);
  const filterModeName = useId();

  const bg=dark?'#1D232C':'#F8FAFC';
  const surface=dark?'#252D38':'#FFFFFF';
  const fg=dark?'#F4F6FA':'#20252D';
  const muted=dark?'#AAB6C6':'#657385';
  const border=dark?'#455164':'#E1E6ED';
  const accent='#5363E9';
  const basic={fontFamily:'inherit',color:fg};
  const btn={...basic,background:surface,border:'1px solid '+border,borderRadius:7,padding:'8px 11px',fontSize:12,cursor:'pointer'};
  const primary={...btn,background:accent,borderColor:accent,color:'#FFFFFF'};
  const field={...btn,width:'100%',boxSizing:'border-box' as const,fontSize:13,padding:'9px 10px',cursor:'auto'};
  const card={background:surface,border:'1px solid '+border,borderRadius:10,padding:16,boxSizing:'border-box' as const};
  const selected=stored.find(d=>d.dashboard.id===active)??null;
  const dashboard=draft??selected?.dashboard??null;
  const widget=draft?.widgets.find(w=>w.id===editingWidget)??null;
  const catalog = catalogState?.catalog ?? builtinDashboardCatalog;
  const availableSources = [...catalog.values()].sort((a,b) => a.label.localeCompare(b.label, 'es'));
  const addSourceKey = catalog.has(addSource) ? addSource : availableSources[0]?.key ?? '';
  const fieldsBySource = new Map<Source, Set<string>>();
  for (const item of dashboard?.widgets ?? []) {
    if (item.kind === 'text' || item.kind === 'shortcut') continue;
    const source = catalog.get(item.source);
    const keys = workspaceWidgetFields(item);
    if (!source || keys.some(key => !source.fields.has(key))) continue;
    const fields = fieldsBySource.get(item.source) ?? new Set<string>();
    keys.forEach(key => fields.add(key));
    if (item.id === editingWidget && source.fields.has(filterDraft.field)) fields.add(filterDraft.field);
    fieldsBySource.set(item.source, fields);
  }
  const queries = [...fieldsBySource].map(([source,keys]) => {
    const fields = [...keys].sort();
    return { source, fields, signature: JSON.stringify(fields) };
  });
  const sourceSignature = JSON.stringify(queries.map(({source,signature}) => [source,signature]).sort());

  useEffect(()=>{
    let live=true;
    setLoading(true);setError('');
    void loadDashboards().then(rows=>{
      if(!live)return;
      setStored(rows);
      setActive(current=>rows.some(row=>row.dashboard.id===current)?current:rows[0]?.dashboard.id??'');
    }).catch(()=>{if(live)setError('No se pudieron cargar los dashboards. Comprueba el acceso a Ajustes de soporte.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[reload]);

  useEffect(() => {
    let live = true;
    void loadDashboardCatalog().then(next => {
      if (live) setCatalogState({ catalog: next });
    }).catch(() => {
      if (live) setCatalogState({ catalog: builtinDashboardCatalog, fallback: true });
    });
    return () => { live = false; };
  }, [reload]);

  // Resolve direct navigation from a custom link in Twenty's left sidebar.
  useEffect(()=>{
    if(!requestedDashboard||handledLink.current===requestedDashboard)return;
    if(!stored.some(row=>row.dashboard.id===requestedDashboard))return;
    handledLink.current=requestedDashboard;
    setActive(requestedDashboard);setDraft(null);setEditing(false);setEditingWidget(null);
  },[requestedDashboard,stored]);

  useEffect(()=>{
    if (!catalogState) return;
    const signal={cancelled:false};
    const api=new RestApiClient();
    for(const {source,fields,signature} of queries){
      const definition = catalogState.catalog.get(source);
      if (!definition || sourceResults[source]?.signature === signature) continue;
      void fetchWorkspaceDataset(definition,fields,api,signal).then(data=>{
        if(!signal.cancelled)setSourceResults(prev=>({...prev,[source]:{ signature,data }}));
      }).catch(()=>{
        if(!signal.cancelled)setSourceResults(prev=>({...prev,[source]:{ signature,error:'No se pudo consultar '+definition.label+'. Prueba a actualizar los datos.' }}));
      });
    }
    return()=>{signal.cancelled=true;};
  },[sourceSignature,catalogState]);

  function startEdit(){
    if(!dashboard)return;
    setDraft(JSON.parse(JSON.stringify(dashboard)) as Dashboard);
    setEditing(true);setEditingWidget(null);setFeedback('');setError('');
  }
  function cancelEdit(){
    resizeSource.current=null;pointerSource.current=null;setResizingId(null);clearDrag();
    setDraft(null);setEditing(false);setEditingWidget(null);setError('');
  }
  function mutate(updater:(d:Dashboard)=>Dashboard){
    setDraft(previous=>previous?updater(previous):previous);
  }
  function changeWidget(id:string,update:(w:DashboardWidget)=>DashboardWidget){
    mutate(d=>({...d,widgets:d.widgets.map(w=>w.id===id?normalizeWidget(update(w)):w)}));
  }
  function modifyWidget(id:string,partial:Partial<DashboardWidget>){
    changeWidget(id,w=>({...w,...partial}));
  }
  function finishDrag(targetId:string) {
    const source=pointerSource.current;
    pointerSource.current=null;
    setDraggingId(null);setDropTarget(null);
    if(source&&source!==targetId)mutate(d=>moveDashboardWidget(d,source,targetId));
  }
  function clearDrag(){
    pointerSource.current=null;setDraggingId(null);setDropTarget(null);
  }
  function startResize(id:string,width:number,height:number,x:number,y:number){
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    pointerSource.current=null;
    setDraggingId(null);setDropTarget(null);
    resizeSource.current={id,startX:x,startY:y,width,height};
    setResizingId(id);
  }
  function moveResize(x:number,y:number){
    const start=resizeSource.current;
    if(!start||!Number.isFinite(x)||!Number.isFinite(y))return;
    // The layout uses 12 columns. Discrete snapping avoids partial-card sizes
    // and works in Twenty's sandboxed Remote DOM without element measurements.
    const width=start.width+Math.round((x-start.startX)/72);
    const height=start.height+Math.round((y-start.startY)/48);
    mutate(d=>resizeDashboardWidgetTo(d,start.id,width,height));
  }
  function endResize(){
    resizeSource.current=null;
    setResizingId(null);
  }
  async function copyDashboardLink(){
    if(!dashboard||!enableLinks)return;
    const url=getDashboardLink(location,dashboard.id);
    if(!url){setError('No se pudo generar un enlace para esta página.');return;}
    try{
      await copyToClipboard(url);
      setFeedback('Enlace del dashboard copiado. Puedes añadirlo al menú de Twenty.');
      setLinkHelp(true);
    }catch{setError('No se pudo copiar. Selecciona el enlace del campo inferior.');setLinkHelp(true);}
  }
  function swapWidget(id:string,delta:number){
    mutate(d=>{
      const widgets=[...d.widgets],from=widgets.findIndex(w=>w.id===id),to=from+delta;
      if(from<0||to<0||to>=widgets.length)return d;
      [widgets[from],widgets[to]]=[widgets[to],widgets[from]];
      return {...d,widgets};
    });
  }
  async function migrateLegacy(){
    if(busy||editing)return;
    setBusy(true);setError('');setFeedback('');
    try{
      const count=await migrateLegacyDashboards(new RestApiClient());
      setFeedback(count?`${count} dashboard(s) migrados sin eliminar los originales.`:'No hay dashboards pendientes de migración.');
      setReload(n=>n+1);
    }catch{setError('No se pudieron migrar los dashboards. No se han eliminado los registros antiguos. Comprueba tus permisos e inténtalo de nuevo.');}
    finally{setBusy(false);}
  }
  async function save(){
    if(!draft||busy)return;
    setBusy(true);setError('');
    try{
      const entry=stored.find(d=>d.dashboard.id===draft.id);
      const updated={...draft,updatedAt:new Date().toISOString()};
      const api=new RestApiClient();
      const id=await persistDashboard(api,updated,entry?.storage==='dedicated'?entry.settingId:null);
      if(updated.isDefault){
        for(const row of stored.filter(row=>row.dashboard.isDefault&&row.dashboard.id!==updated.id&&row.settingId)){
          await persistDashboard(api,{...row.dashboard,isDefault:false},row.storage==='dedicated'?row.settingId:null);
        }
      }
      setStored(current=>[...current.filter(row=>row.dashboard.id!==updated.id)
        .map(row=>updated.isDefault?{...row,dashboard:{...row.dashboard,isDefault:false}}:row),{settingId:id,dashboard:updated,storage:'dedicated'}]);
      setActive(updated.id);setDraft(null);setEditing(false);setEditingWidget(null);
      setFeedback('Dashboard guardado en este workspace.');
    }catch{setError('No se pudo guardar el dashboard. Revisa los permisos y el tamaño de la configuración.');}
    finally{setBusy(false);}
  }
  async function createNew(copy=false){
    if(stored.length>=MAX_DASHBOARDS)return setError('Máximo de 30 dashboards por workspace.');
    const next=copy&&dashboard?{...dashboard,id:newId(),title:dashboard.title+' (copia)',isDefault:false,
      widgets:dashboard.widgets.map(w=>({...w,id:newId()}))}:createDashboard();
    setActive(next.id);setDraft(next);setEditing(true);setEditingWidget(null);setError('');setFeedback('');
  }
  async function archive(){
    if(!selected?.settingId||busy)return;
    const result=await openCommandConfirmationModal({
      title:'¿Archivar este dashboard?',subtitle:'Dejará de mostrarse, pero sus datos no se eliminarán.',
      confirmButtonText:'Archivar',confirmButtonAccent:'danger',
    });
    if(result!=='confirm')return;
    setBusy(true);setError('');
    try{
      const api=new RestApiClient();
      const recordId=selected.storage==='legacy'
        ?await persistDashboard(api,selected.dashboard,null):selected.settingId;
      await removeDashboard(api,recordId);
      setStored(current=>current.filter(row=>row.dashboard.id!==selected.dashboard.id));
      setActive('');setFeedback('Dashboard archivado.');
    }catch{setError('No se pudo archivar. Comprueba los permisos de Ajustes de soporte.');}
    finally{setBusy(false);}
  }
  function importConfig(){
    try{
      if(stored.length>=MAX_DASHBOARDS)throw Error('limit');
      const next=importDashboard(importJson);
      setDraft(next);setActive(next.id);setEditing(true);setEditingWidget(null);
      setImportOpen(false);setImportJson('');setError('');
    }catch{setError('Configuración inválida: se requiere una exportación de dashboard versión 2.');}
  }
  function downloadConfig(){
    if(!dashboard)return;
    const data=exportDashboard(dashboard);
    // Clipboard is supported in the app shell, unlike file-system downloads.
    void copyToClipboard(data).then(()=>setFeedback('Configuración JSON copiada al portapapeles.'))
      .catch(()=>setError('No se pudo copiar el JSON. Comprueba los permisos.'));
  }
  function resetData(){
    setSourceResults({});setCatalogState(null);setReload(n=>n+1);
  }
  function addWidget(){
    if(!draft)return;
    if(draft.widgets.length>=MAX_WIDGETS)return setError('Máximo de 36 widgets por dashboard.');
    const source = catalog.get(addSourceKey);
    const base = makeWidget(addKind,addSourceKey || 'supportCases');
    const next = source ? usingSource(base,source) : base;
    setFilterDraft(emptyFilter);
    mutate(d=>({...d,widgets:[...d.widgets,next]}));setEditingWidget(next.id);
  }
  function renderChart(w:DashboardWidget){
    const source = catalogState?.catalog.get(w.source);
    const query = queries.find(item => item.source === w.source);
    const result = sourceResults[w.source];
    const current = query && result?.signature === query.signature ? result : undefined;
    const message = catalogState ? widgetDataMessage(w, source) : undefined;
    return <DashboardVisualization widget={w} period={dashboard?.period??{key:'30d'}}
      data={current?.data} sourceError={message??current?.error} dark={dark}/>;
  }

  function widgetEditor(w:DashboardWidget){
    function change<K extends keyof DashboardWidget>(name:K,value:DashboardWidget[K]) { modifyWidget(w.id,{[name]:value}); }
    const source = catalog.get(w.source);
    const fields = [...(source?.fields.values() ?? [])];
    const selectedFilterField = source?.fields.get(filterDraft.field);
    const filterIndex = filterDraft.index;
    const showFilterEditor = filterIndex !== undefined || w.filters.length < MAX_WIDGET_FILTERS;
    const canApplyFilter = Boolean(selectedFilterField && filterDraft.value.trim() && filterDraft.value.length <= 120);
    const filterLabel = { fontSize: 12, fontWeight: 550 };
    const numeric = fields.filter(field => field.kind === 'number');
    const dates = referenceDates(fields, w.kind);
    const aggregationOptions: DashboardWidget['aggregation'][] = ['count', 'ratio', 'distinct'];
    if (numeric.length) aggregationOptions.push('sum', 'avg', 'min', 'max');
    if (!aggregationOptions.includes(w.aggregation)) aggregationOptions.push(w.aggregation);
    const optionsFor = (values: DashboardField[], selected: string) => <>
      {selected && !values.some(value => value.key === selected) && <option value={selected} disabled>{fieldLabel(source, selected)} · No disponible</option>}
      {values.map(value => <option key={value.key} value={value.key}>{value.label}</option>)}
    </>;
    function applyFilter() {
      if (!canApplyFilter) return;
      const filter = { field: filterDraft.field, operator: filterDraft.operator, value: filterDraft.value.trim() };
      const filters = filterIndex === undefined ? [...w.filters, filter] : w.filters.map((item, index) => index === filterIndex ? filter : item);
      change('filters', filters);
      setFilterDraft(emptyFilter);
    }
    function removeFilter(index: number) {
      change('filters', w.filters.filter((_, position) => position !== index));
      if (filterIndex === index) setFilterDraft(emptyFilter);
      else if (filterIndex !== undefined && filterIndex > index) setFilterDraft({ ...filterDraft, index: filterIndex - 1 });
    }
    function valueInput(key: string, value: string, onChange: (value: string) => void, placeholder: string) {
      const selectedField = source?.fields.get(key);
      const choices = fieldOptions(selectedField);
      if (choices.length) return <select style={field} value={value} onChange={e=>onChange(e.target.value)} aria-label={placeholder}>
        <option value="">{placeholder}</option>
        {value && !choices.some(choice => choice.value === value) && <option value={value}>{value}</option>}
        {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </select>;
      const inputType = selectedField?.kind === 'number' ? 'number' : selectedField?.kind === 'date' ? 'date' : 'text';
      const dataset = sourceResults[w.source]?.data;
      const sample = dataset?.complete && selectedField && inputType === 'text'
        ? [...new Set(dataset.rows.flatMap(row => dashboardValues(row[key])))].filter(value => value.length <= 120)
          .slice(0, 60).sort((a,b) => a.localeCompare(b, 'es'))
        : [];
      return <>
        <input style={field} type={inputType} step={inputType === 'number' ? 'any' : undefined} value={value}
          maxLength={120} placeholder={placeholder} aria-label={placeholder} onChange={e=>onChange(e.target.value)}/>
        {sample.length>0&&<select style={{...field,marginTop:6}} aria-label={'Valores encontrados para '+selectedField?.label}
          value={sample.includes(value)?value:''} onChange={e=>onChange(e.target.value)}>
          <option value="">Elegir un valor encontrado</option>
          {sample.map(item => <option key={item} value={item}>{item}</option>)}
        </select>}
      </>;
    }
    return <section style={{...card,background:bg,display:'flex',flexDirection:'column',gap:13}} aria-label="Configurar widget">
      <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
        <strong style={{fontSize:14}}>Configurar widget</strong>
        <button type="button" style={btn} onClick={()=>setEditingWidget(null)}>Cerrar ×</button>
      </div>
      <label style={{fontSize:12}}>Título<input style={field} value={w.title} maxLength={90}
        onChange={e=>change('title',e.target.value)}/></label>
      <label style={{fontSize:12}}>Tipo de widget<select style={field} value={w.kind}
        onChange={e=>change('kind',e.target.value as WidgetKind)}>{KINDS.map(k=><option key={k} value={k}>{WIDGET_LABELS[k]}</option>)}</select></label>
      {w.kind==='text'?<label style={{fontSize:12}}>Contenido<textarea style={{...field,minHeight:120}} value={w.text} maxLength={4000} onChange={e=>change('text',e.target.value)}/></label>:
      w.kind==='shortcut'?<label style={{fontSize:12}}>URL HTTPS o ruta interna<input style={field} value={w.url} placeholder="/objects/supportCases" onChange={e=>change('url',e.target.value)}/></label>:<>
        <label style={{fontSize:12}}>Objeto de Twenty<select style={field} value={w.source} disabled={!catalogState} onChange={e=>{
          const next = catalog.get(e.target.value);
          if (!next) return;
          setFilterDraft(emptyFilter);
          changeWidget(w.id,previous=>usingSource({...makeWidget(previous.kind,next.key,previous.title),id:previous.id,width:previous.width,height:previous.height,compare:previous.compare}, next));
        }}>
          {!source && <option value={w.source} disabled>{w.source} · No disponible</option>}
          {availableSources.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}
        </select></label>
        <label style={{fontSize:12}}>Cálculo<select style={field} value={w.aggregation} onChange={e=>change('aggregation',e.target.value as DashboardWidget['aggregation'])}>
          {aggregationOptions.map(value => <option key={value} value={value}>{CALCULATIONS[value]}</option>)}</select></label>
        {NUMERIC.includes(w.aggregation)&&<label style={{fontSize:12}}>Campo del cálculo<select style={field} value={w.valueField}
          onChange={e=>change('valueField',e.target.value)}><option value="">Selecciona un campo</option>{optionsFor(w.aggregation==='distinct'?fields:numeric,w.valueField)}</select></label>}
        {w.aggregation==='ratio'&&<>
          <label style={{fontSize:12}}>Campo del porcentaje<select style={field} value={w.ratioField}
            onChange={e=>modifyWidget(w.id,{ratioField:e.target.value,ratioValue:''})}>
            <option value="">Selecciona un campo</option>{optionsFor(fields,w.ratioField)}</select></label>
          <label style={{fontSize:12}}>Valor que debe coincidir{valueInput(w.ratioField,w.ratioValue,value=>change('ratioValue',value),'Valor del porcentaje')}</label>
        </>}
        {['bar','donut','table'].includes(w.kind)&&<label style={{fontSize:12}}>Agrupar por<select style={field} value={w.groupBy} onChange={e=>change('groupBy',e.target.value)}>
          <option value="">Sin grupos</option>{optionsFor(fields,w.groupBy)}</select></label>}
        <label style={{fontSize:12}}>Fecha de referencia<select style={field} value={w.dateField}
          onChange={e=>change('dateField',e.target.value)}><option value="">Sin fecha</option>{optionsFor(dates,w.dateField)}</select></label>
        <label style={{fontSize:12}}>Filtro temporal<select style={field} value={w.periodOverride?.key??'inherit'} onChange={e=>change('periodOverride',e.target.value==='inherit'?null:{key:e.target.value as Period['key']})}>
          <option value="inherit">Heredar del dashboard</option>{PERIOD_KEYS.filter(k=>k!=='custom').map(k=><option key={k} value={k}>{PERIOD_LABELS[k]}</option>)}</select></label>
        <label style={{display:'flex',alignItems:'center',gap:7,fontSize:12}}>
          <input type="checkbox" checked={w.compare} onChange={e=>change('compare',e.target.checked)}/>Comparar con período anterior</label>
        <section className="omni-dashboard__filter-editor" aria-label="Filtros del widget" style={{ borderBlock: '1px solid ' + border, paddingBlock: 14 }}>
          <header>
            <h3 style={{ margin: 0, fontSize: 14 }}>Filtros del widget</h3>
            {w.filters.length > 1 && <p style={{ margin: '4px 0 0', color: muted, fontSize: 12 }}>Los registros deben cumplir todos los filtros.</p>}
          </header>
          {w.filters.length > 0 && <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {w.filters.map((filter, index) => {
              const name = fieldLabel(source, filter.field);
              const definition = source?.fields.get(filter.field);
              const condition = filterConditions[definition?.kind === 'array' ? 'array' : 'scalar'][filter.operator];
              return <li key={index} style={{ display: 'grid', gap: 4, fontSize: 12, paddingBlock: 8, borderBottom: '1px solid ' + border }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{name}</strong>
                <span style={{ color: muted, overflowWrap: 'anywhere' }}>{condition} {displayDashboardValue(definition, filter.value)}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...btn, padding: '5px 9px' }} type="button" aria-label={'Editar filtro de ' + name}
                    onClick={() => setFilterDraft({ ...filter, index })}>Editar</button>
                  <button style={{ ...btn, padding: '5px 9px' }} type="button" aria-label={'Quitar filtro de ' + name}
                    onClick={() => removeFilter(index)}>Quitar</button>
                </div>
              </li>;
            })}
          </ul>}
          {showFilterEditor ? <div className="omni-dashboard__filter-editor">
            <label className="omni-dashboard__filter-field" style={filterLabel}>Campo
              <select style={field} value={filterDraft.field} aria-label="Campo del filtro"
                onChange={e => setFilterDraft({ ...filterDraft, field: e.target.value, value: '' })}>
                <option value="">Selecciona un campo</option>{optionsFor(fields, filterDraft.field)}
              </select>
            </label>
            <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
              <legend style={{ ...filterLabel, padding: 0, marginBottom: 5 }}>Condición</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                {filterModes.map(([operator, label]) => <label className="omni-dashboard__filter-mode" key={operator}
                  style={{ ...btn, borderColor: operator === filterDraft.operator ? accent : border }}>
                  <input type="radio" name={filterModeName} checked={operator === filterDraft.operator} style={{ accentColor: accent }}
                    onChange={() => setFilterDraft({ ...filterDraft, operator })} />{label}
                </label>)}
              </div>
              {filterDraft.operator === 'neq' && <p style={{ margin: '6px 0 0', color: muted, fontSize: 12 }}>Los registros con el campo vacío también se incluyen.</p>}
            </fieldset>
            <div className="omni-dashboard__filter-field">
              <span style={filterLabel}>Valor</span>
              {selectedFilterField ? valueInput(filterDraft.field, filterDraft.value,
                value => setFilterDraft({ ...filterDraft, value }), 'Valor exacto') :
                <select style={field} aria-label="Valor exacto" disabled><option>Selecciona primero un campo</option></select>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={canApplyFilter ? primary : btn} type="button" disabled={!canApplyFilter} onClick={applyFilter}>
                {filterIndex === undefined ? 'Añadir filtro' : 'Aplicar cambios'}
              </button>
              {filterIndex !== undefined && <button style={btn} type="button" onClick={() => setFilterDraft(emptyFilter)}>Cancelar</button>}
            </div>
          </div> : <p style={{ margin: 0, color: muted, fontSize: 12 }}>Puedes aplicar hasta {MAX_WIDGET_FILTERS} filtros.</p>}
        </section>
      </>}
      <label style={{fontSize:12}}>Anchura<select style={field} value={w.width} onChange={e=>change('width',Number(e.target.value) as DashboardWidget['width'])}>
        {WIDTHS.map(n=><option key={n} value={n}>{n}/12 columnas</option>)}</select></label>
      <label style={{fontSize:12}}>Altura<select style={field} value={w.height} onChange={e=>change('height',Number(e.target.value))}>
        {Array.from({length:11},(_,i)=>i+2).map(n=><option key={n} value={n}>{n} filas</option>)}</select></label>
    </section>;
  }

  return <div className="omni-dashboard" style={{ ...basic, background: bg, padding: embedded ? 0 : 'clamp(12px, 2vw, 26px)', minHeight: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
    <style>{responsiveDashboardStyles}</style>
    <header style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        <h1 style={{fontSize:23,margin:0,fontWeight:650}}>{dashboard?.title??'Dashboards'}</h1>
        <div style={{fontSize:12,color:muted}}>{dashboard?.description||'Indicadores personalizables de tu workspace'}</div>
      </div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        <button style={btn} onClick={resetData} disabled={editing}>Actualizar datos</button>
        {!editing&&<button style={btn} onClick={startEdit} disabled={!dashboard}>Editar diseño</button>}
        {!editing&&draft&&<button style={primary} onClick={()=>void save()} disabled={busy}>Guardar período</button>}
        {editing&&<><button style={btn} onClick={cancelEdit} disabled={busy}>Descartar</button><button style={primary} onClick={()=>void save()} disabled={busy}>{busy?'Guardando…':'Guardar cambios'}</button></>}
      </div>
    </header>
    {error&&<div role="alert" style={{padding:11,borderRadius:8,border:'1px solid #DC6969',color:'#D94848',fontSize:12}}>{error}</div>}
    {editing&&catalogState?.fallback&&<p role="status" style={{fontSize:12,color:muted}}>Twenty no pudo cargar el catálogo del workspace. Puedes configurar las fuentes habituales de Omnichannel.</p>}
    {feedback&&<div role="status" style={{fontSize:12,color:muted}}>{feedback}</div>}
    <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap'}}>
      <label style={{fontSize:12}}>Dashboard
        <select style={{...field,width:'auto',minWidth:170,marginLeft:8}} value={active} disabled={editing||loading}
          onChange={e=>{setActive(e.target.value);setDraft(null);setFeedback('');}}>
          {stored.map(row=><option key={row.dashboard.id} value={row.dashboard.id}>{row.dashboard.icon} {row.dashboard.title}</option>)}
          {editing&&draft&&!stored.some(row=>row.dashboard.id===draft.id)&&<option value={draft.id}>{draft.title}</option>}
        </select>
      </label>
      <button style={btn} onClick={()=>void createNew()} disabled={editing||loading}>+ Nuevo</button>
      <button style={btn} onClick={()=>void createNew(true)} disabled={editing||!dashboard}>Duplicar</button>
      <button style={btn} onClick={()=>void archive()} disabled={editing||!selected||!selected.settingId||busy}>Archivar</button>
      <button style={btn} onClick={downloadConfig} disabled={!dashboard}>Copiar JSON</button>
      {enableMigration&&<button style={btn} onClick={()=>void migrateLegacy()} disabled={busy||editing||loading}>Migrar dashboards antiguos</button>}
      {enableLinks&&<button style={btn} onClick={()=>void copyDashboardLink()} disabled={!dashboard||editing}>Copiar enlace</button>}
      {enableLinks&&<button style={btn} onClick={()=>setLinkHelp(v=>!v)} disabled={!dashboard}>En el menú de Twenty</button>}
      <button style={btn} onClick={()=>setImportOpen(v=>!v)} disabled={editing}>Importar</button>
    </div>
    {enableLinks&&linkHelp&&dashboard&&<section style={{...card,display:'flex',flexDirection:'column',gap:8}} aria-label="Acceso directo al dashboard">
      <strong style={{fontSize:13}}>Acceso directo en el menú principal</strong>
      <p style={{fontSize:12,color:muted,margin:0,lineHeight:1.6}}>
        Copia este enlace y, en la barra lateral de Twenty, utiliza Editar menú → Añadir → Enlace.
        Asigna el nombre que quieras y sitúalo en la raíz o en la carpeta que prefieras.
        Cada dashboard tiene su propio enlace y seguirá abriéndose con sus datos guardados.
      </p>
      <input aria-label="Enlace directo del dashboard" readOnly value={getDashboardLink(location,dashboard.id)??''}
        style={{...field,fontSize:11}}/>
      <div><button style={primary} onClick={()=>void copyDashboardLink()}>Copiar enlace de este dashboard</button></div>
    </section>}
    {importOpen&&<section style={card}><strong style={{fontSize:13}}>Importar dashboard</strong>
      <textarea value={importJson} onChange={e=>setImportJson(e.target.value)} style={{...field,minHeight:110,marginTop:9}} placeholder="Pega el JSON exportado"/>
      <button style={{...primary,marginTop:8}} onClick={importConfig}>Revisar y editar</button>
    </section>}
    {loading&&<p style={{fontSize:12,color:muted}}>Cargando dashboards…</p>}
    {!loading&&!dashboard&&<section style={card}>
      <h2 style={{fontSize:17,marginTop:0}}>Empieza con tu primer dashboard</h2>
      <p style={{fontSize:13,color:muted}}>Crea un panel vacío o utiliza una plantilla con métricas de conversaciones, automatización, canales y calidad.</p>
      <button type="button" style={primary} onClick={()=>{const initial=defaultDashboard();setDraft(initial);setActive(initial.id);setEditing(true);}}>
        Crear visión general
      </button>
    </section>}
    {dashboard&&<section style={{...card,padding:14,display:'flex',flexWrap:'wrap',gap:14,alignItems:'end'}}>
      <label style={{fontSize:12}}>Período
        <select style={{...field,minWidth:172,marginTop:4}} value={dashboard.period.key} onChange={e=>{
          const period=periodFrom({key:e.target.value,start:dashboard.period.start,end:dashboard.period.end});
          if(editing)mutate(d=>({...d,period}));
          else setDraft({...dashboard,period});
        }}>{PERIOD_KEYS.map(k=><option key={k} value={k}>{PERIOD_LABELS[k]}</option>)}</select>
      </label>
      {dashboard.period.key==='custom'&&<>
        <label style={{fontSize:12}}>Desde<input type="date" style={{...field,marginTop:4}} value={dashboard.period.start??''} onChange={e=>{
          const period:Period={key:'custom',start:e.target.value,end:dashboard.period.end};
          if(editing)mutate(d=>({...d,period}));else setDraft({...dashboard,period});
        }}/></label>
        <label style={{fontSize:12}}>Hasta<input type="date" style={{...field,marginTop:4}} value={dashboard.period.end??''} min={dashboard.period.start} onChange={e=>{
          const period:Period={key:'custom',start:dashboard.period.start,end:e.target.value};
          if(editing)mutate(d=>({...d,period}));else setDraft({...dashboard,period});
        }}/></label>
      </>}
      {editing&&<div style={{display:'flex',gap:8,flexWrap:'wrap',flex:'1 1 420px'}}>
        <label style={{fontSize:12,flex:'1 1 170px'}}>Título<input value={dashboard.title} maxLength={90} style={{...field,marginTop:4}} onChange={e=>mutate(d=>({...d,title:e.target.value}))}/></label>
        <label style={{fontSize:12,flex:'2 1 240px'}}>Descripción<input value={dashboard.description} maxLength={240} style={{...field,marginTop:4}} onChange={e=>mutate(d=>({...d,description:e.target.value}))}/></label>
        <label style={{fontSize:12,display:'flex',alignItems:'center',gap:7}}><input type="checkbox" checked={dashboard.isDefault} onChange={e=>mutate(d=>({...d,isDefault:e.target.checked}))}/>Panel predeterminado</label>
      </div>}
    </section>}
    {editing&&dashboard&&<div role="status" style={{fontSize:12,color:muted,margin:'-4px 0 0'}}>Arrastra las cabeceras para reordenar y la esquina inferior derecha para cambiar ancho y alto. Los tamaños también se ajustan desde Configurar. Guarda al terminar.</div>}
    {dashboard&&<div style={{display:'flex',gap:15,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div style={{flex:'1 1 680px',minWidth:0}}>
        <div className="omni-dashboard__grid"
          style={{display:'grid',gridTemplateColumns:'repeat(var(--omni-dashboard-columns, 12), minmax(0, 1fr))',gap:12,alignItems:'start'}}
          onPointerLeave={()=>{endResize();clearDrag();}}
          onPointerMove={e=>moveResize(e.clientX,e.clientY)}
          onPointerUp={()=>{if(resizeSource.current)endResize();else if(pointerSource.current)clearDrag();}}
          onPointerCancel={()=>{endResize();clearDrag();}}>
          {dashboard.widgets.map(w=><section key={w.id} className="omni-dashboard__widget" data-wide={w.width >= 8} style={{
            ...card,gridColumn:`span var(--omni-dashboard-responsive-span, ${w.width})`,minWidth:0,
            minHeight:Math.max(w.height*48,120),position:'relative',overflow:'hidden',
            outline:draggingId&&dropTarget===w.id&&draggingId!==w.id?'2px dashed '+accent:
              editingWidget===w.id&&editing?'2px solid '+accent:'none',
            opacity:draggingId===w.id?0.7:1,transition:'opacity 150ms ease',
          }} onPointerEnter={()=>{if(pointerSource.current&&pointerSource.current!==w.id)setDropTarget(w.id);}}
            onPointerUp={()=>{if(pointerSource.current)finishDrag(w.id);}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,
              cursor:editing?'grab':'default',touchAction:editing?'none':'auto'}}
              onPointerDown={e=>{if(editing&&!resizeSource.current){pointerSource.current=w.id;setDraggingId(w.id);setDropTarget(null);}}}>
              <div tabIndex={editing?0:undefined} role={editing?'button':undefined}
                aria-label={editing?'Mover '+w.title+'. Utiliza las flechas para ordenar.':undefined}
                onKeyDown={e=>{if(editing&&(e.key==='ArrowLeft'||e.key==='ArrowUp')){e.preventDefault();swapWidget(w.id,-1);}
                  if(editing&&(e.key==='ArrowRight'||e.key==='ArrowDown')){e.preventDefault();swapWidget(w.id,1);}}}
                style={{fontSize:12,fontWeight:650,flex:1,minWidth:0,overflowWrap:'anywhere'}}>{w.title}</div>
              {editing&&<div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
                <button style={{...btn,padding:'3px 7px'}} title="Configurar" aria-label={'Configurar '+w.title}
                  onPointerDown={e=>e.stopPropagation()}
                  onClick={()=>{setEditingWidget(w.id);setFilterDraft(emptyFilter);}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4V21H9v-1.6a1.7 1.7 0 0 0-1.88-.34l-.06.06L4.2 16.26l.06-.06A1.7 1.7 0 0 0 4.6 14.3H3v-4.6h1.6a1.7 1.7 0 0 0-.34-1.88L4.2 7.76 7.06 4.9l.06.06A1.7 1.7 0 0 0 9 4.6V3h6v1.6a1.7 1.7 0 0 0 1.88.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 9.7H21v4.6h-1.6z"/></svg>
                </button>
                <button style={{...btn,padding:'3px 7px'}} title="Eliminar" aria-label={'Eliminar '+w.title}
                  onPointerDown={e=>e.stopPropagation()}
                  onClick={()=>mutate(d=>({...d,widgets:d.widgets.filter(row=>row.id!==w.id)}))}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M10 11v7m4-7v7M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>
                </button>
              </div>}
            </div>
            {renderChart(w)}
            {editing&&<div title="Arrastrar para cambiar ancho y alto" role="separator"
              aria-label={'Redimensionar '+w.title+'. También disponible en Configurar.'}
              style={{position:'absolute',bottom:0,right:0,width:24,height:24,cursor:'nwse-resize',touchAction:'none',
                display:'flex',alignItems:'end',justifyContent:'end',padding:4,boxSizing:'border-box',
                color:resizingId===w.id?accent:muted}}
              onPointerDown={e=>{
                e.stopPropagation();startResize(w.id,w.width,w.height,e.clientX,e.clientY);
                // Pointer capture keeps resizing responsive when the pointer crosses
                // adjacent widgets, but older Remote DOM hosts may not support it.
                try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* fallback to grid events */}
              }}
              onPointerMove={e=>{if(resizeSource.current?.id===w.id)moveResize(e.clientX,e.clientY);}}
              onPointerUp={()=>{if(resizeSource.current?.id===w.id)endResize();}}
              onPointerCancel={()=>{endResize();clearDrag();}}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                <path d="M12 4L4 12M12 8L8 12M12 12h-1"/>
              </svg>
            </div>}
          </section>)}
          {editing&&<section style={{...card,gridColumn:'1 / -1',background:'transparent',borderStyle:'dashed',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <select style={{...field,width:'auto'}} value={addKind} aria-label="Tipo de widget" onChange={e=>setAddKind(e.target.value as WidgetKind)}>
              {KINDS.map(kind=><option key={kind} value={kind}>{WIDGET_LABELS[kind]}</option>)}</select>
            {addKind!=='text'&&addKind!=='shortcut'&&<select style={{...field,width:'auto',maxWidth:'100%'}} aria-label="Objeto de Twenty"
              value={addSourceKey} disabled={!catalogState||!availableSources.length} onChange={e=>setAddSource(e.target.value)}>
              {!catalogState||!availableSources.length?<option value={addSourceKey}>{catalogState?'Sin objetos disponibles':'Cargando objetos…'}</option>:
                availableSources.map(source=><option key={source.key} value={source.key}>{source.label}</option>)}</select>}
            <button style={primary} disabled={addKind!=='text'&&addKind!=='shortcut'&&(!catalogState||!addSourceKey)} onClick={addWidget}>+ Añadir widget</button>
          </section>}
        </div>
      </div>
      {editing&&widget&&<aside className="omni-dashboard__widget-editor">{widgetEditor(widget)}</aside>}
    </div>}
    {dashboard&&<p style={{fontSize:11,color:muted}}>Períodos calculados en la zona horaria del navegador. Los datos pertenecen al workspace actual. Hasta 3.000 registros por fuente; si se supera el límite, las métricas no se muestran como definitivas.</p>}
  </div>;
}
