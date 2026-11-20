import { useEffect, useRef, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { copyToClipboard, openCommandConfirmationModal, useColorScheme, useLocation } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import {
  SOURCES, WIDGET_LABELS, PERIOD_LABELS, MAX_DASHBOARDS, MAX_WIDGETS,
  createDashboard, defaultDashboard, fieldsFor, makeWidget, moveDashboardWidget, resizeDashboardWidgetTo, newId, normalizeWidget, periodFrom,
  type Source, type WidgetKind, type Dashboard, type DashboardWidget, type Period, type StoredDashboard,
} from '../lib/dashboard-model.ts';
import { loadDashboards, persistDashboard, removeDashboard, importDashboard, exportDashboard } from '../lib/dashboard-store.ts';
import { fetchDataset, type Dataset } from '../lib/dashboard-analytics.ts';
import { readDashboardFromSearch, getDashboardLink } from '../lib/dashboard-links.ts';
import { DashboardVisualization } from './dashboard-visualization.tsx';

const SOURCE_KEYS=Object.keys(SOURCES) as Source[];
const KINDS=Object.keys(WIDGET_LABELS) as WidgetKind[];
const PERIOD_KEYS=Object.keys(PERIOD_LABELS) as Period['key'][];
const NUMERIC=['sum','avg','min','max','distinct'];
const WIDTHS=[3,4,6,8,12] as const;

export function Dashboards() {
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
  const [datasets,setDatasets]=useState<Partial<Record<Source,Dataset>>>({});
  const [sourceErrors,setSourceErrors]=useState<Partial<Record<Source,string>>>({});
  const [importOpen,setImportOpen]=useState(false);
  const [importJson,setImportJson]=useState('');
  const [draggingId,setDraggingId]=useState<string|null>(null);
  const [resizingId,setResizingId]=useState<string|null>(null);
  const [dropTarget,setDropTarget]=useState<string|null>(null);
  const [linkHelp,setLinkHelp]=useState(false);
  const [addKind,setAddKind]=useState<WidgetKind>('kpi');
  const [addSource,setAddSource]=useState<Source>('supportCases');
  const [filterField,setFilterField]=useState('');
  const [filterValue,setFilterValue]=useState('');

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
  const sourceSignature=[...new Set((dashboard?.widgets??[]).filter(w=>w.kind!=='text'&&w.kind!=='shortcut').map(w=>w.source))].sort().join('|');

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

  // Resolve direct navigation from a custom link in Twenty's left sidebar.
  useEffect(()=>{
    if(!requestedDashboard||handledLink.current===requestedDashboard)return;
    if(!stored.some(row=>row.dashboard.id===requestedDashboard))return;
    handledLink.current=requestedDashboard;
    setActive(requestedDashboard);setDraft(null);setEditing(false);setEditingWidget(null);
  },[requestedDashboard,stored]);

  useEffect(()=>{
    const sources=[...new Set((dashboard?.widgets??[]).filter(w=>w.kind!=='text'&&w.kind!=='shortcut').map(w=>w.source))];
    const missing=sources.filter(source=>!datasets[source]&&!sourceErrors[source]);
    if(!missing.length)return;
    const signal={cancelled:false};
    const api=new RestApiClient();
    for(const source of missing){
      void fetchDataset(source,api,signal).then(data=>{
        if(!signal.cancelled)setDatasets(prev=>({...prev,[source]:data}));
      }).catch(()=>{
        if(!signal.cancelled)setSourceErrors(prev=>({...prev,[source]:'Error al consultar '+SOURCES[source].label+'.'}));
      });
    }
    return()=>{signal.cancelled=true;};
  },[sourceSignature,reload]);

  function startEdit(){
    if(!dashboard)return;
    setDraft(JSON.parse(JSON.stringify(dashboard)) as Dashboard);
    setEditing(true);setEditingWidget(null);setFeedback('');setError('');
  }
  function cancelEdit(){
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
    if(!dashboard)return;
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
  async function save(){
    if(!draft||busy)return;
    setBusy(true);setError('');
    try{
      const entry=stored.find(d=>d.dashboard.id===draft.id);
      const updated={...draft,updatedAt:new Date().toISOString()};
      const api=new RestApiClient();
      const id=await persistDashboard(api,updated,entry?.settingId??null);
      if(updated.isDefault){
        for(const row of stored.filter(row=>row.dashboard.isDefault&&row.dashboard.id!==updated.id&&row.settingId)){
          await persistDashboard(api,{...row.dashboard,isDefault:false},row.settingId);
        }
      }
      setStored(current=>[...current.filter(row=>row.dashboard.id!==updated.id)
        .map(row=>updated.isDefault?{...row,dashboard:{...row.dashboard,isDefault:false}}:row),{settingId:id,dashboard:updated}]);
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
      await removeDashboard(new RestApiClient(),selected.settingId);
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
    setDatasets({});setSourceErrors({});setReload(n=>n+1);
  }
  function addWidget(){
    if(!draft)return;
    if(draft.widgets.length>=MAX_WIDGETS)return setError('Máximo de 36 widgets por dashboard.');
    const next=makeWidget(addKind,addSource);
    mutate(d=>({...d,widgets:[...d.widgets,next]}));setEditingWidget(next.id);
  }
  function renderChart(w:DashboardWidget){
    return <DashboardVisualization widget={w} period={dashboard?.period??{key:'30d'}}
      data={datasets[w.source]} sourceError={sourceErrors[w.source]} dark={dark}/>;
  }

  function widgetEditor(w:DashboardWidget){
    function change<K extends keyof DashboardWidget>(name:K,value:DashboardWidget[K]) { modifyWidget(w.id,{[name]:value}); }
    const dims=fieldsFor(w.source,'dimensions');
    const numeric=fieldsFor(w.source,'numeric');
    const aggregationOptions=['count','ratio','distinct',...(numeric.length?['sum','avg','min','max']:[])];
    const option=(values:readonly string[])=>values.map(s=><option key={s} value={s}>{s}</option>);
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
        <label style={{fontSize:12}}>Fuente de datos<select style={field} value={w.source} onChange={e=>{
          const source=e.target.value as Source;
          changeWidget(w.id,previous=>({...makeWidget(previous.kind,source,previous.title),id:previous.id,width:previous.width,compare:previous.compare}));
        }}>{SOURCE_KEYS.map(s=><option key={s} value={s}>{SOURCES[s].label}</option>)}</select></label>
        <label style={{fontSize:12}}>Cálculo<select style={field} value={w.aggregation} onChange={e=>change('aggregation',e.target.value as DashboardWidget['aggregation'])}>
          {option(aggregationOptions)}</select></label>
        {NUMERIC.includes(w.aggregation)&&<label style={{fontSize:12}}>Campo del cálculo<select style={field} value={w.valueField}
          onChange={e=>change('valueField',e.target.value)}><option value="">Selecciona un campo</option>{option(w.aggregation==='distinct'?dims:numeric)}</select></label>}
        {w.aggregation==='ratio'&&<>
          <label style={{fontSize:12}}>Campo numerador<select style={field} value={w.ratioField} onChange={e=>change('ratioField',e.target.value)}>
            <option value="">Selecciona</option>{option(dims)}</select></label>
          <label style={{fontSize:12}}>Valor del numerador<input style={field} value={w.ratioValue} onChange={e=>change('ratioValue',e.target.value)}/></label>
        </>}
        {['bar','donut','table'].includes(w.kind)&&<label style={{fontSize:12}}>Agrupar por<select style={field} value={w.groupBy} onChange={e=>change('groupBy',e.target.value)}>{option(dims)}</select></label>}
        <label style={{fontSize:12}}>Fecha de referencia<select style={field} value={w.dateField}
          onChange={e=>change('dateField',e.target.value)}>{option(fieldsFor(w.source,'dates'))}</select></label>
        <label style={{fontSize:12}}>Filtro temporal<select style={field} value={w.periodOverride?.key??'inherit'} onChange={e=>change('periodOverride',e.target.value==='inherit'?null:{key:e.target.value as Period['key']})}>
          <option value="inherit">Heredar del dashboard</option>{PERIOD_KEYS.filter(k=>k!=='custom').map(k=><option key={k} value={k}>{PERIOD_LABELS[k]}</option>)}</select></label>
        <label style={{display:'flex',alignItems:'center',gap:7,fontSize:12}}>
          <input type="checkbox" checked={w.compare} onChange={e=>change('compare',e.target.checked)}/>Comparar con período anterior</label>
        <div style={{borderTop:'1px solid '+border,paddingTop:10,display:'flex',flexDirection:'column',gap:8}}>
          <strong style={{fontSize:12}}>Filtros del widget</strong>
          {w.filters.map((f,i)=><div key={i} style={{display:'flex',gap:5,alignItems:'center',fontSize:12}}>
            <span style={{flex:1,overflow:'hidden'}}>{f.field} {f.operator==='eq'?'=':'≠'} {f.value}</span>
            <button style={btn} type="button" onClick={()=>change('filters',w.filters.filter((_,j)=>j!==i))}>×</button>
          </div>)}
          {w.filters.length<5&&<div style={{display:'flex',flexDirection:'column',gap:6}}>
            <select style={field} value={filterField} onChange={e=>setFilterField(e.target.value)}>
              <option value="">Selecciona campo</option>{option(dims)}</select>
            <input style={field} value={filterValue} placeholder="Valor exacto" onChange={e=>setFilterValue(e.target.value)}/>
            <button style={btn} disabled={!dims.includes(filterField)||!filterValue.trim()} onClick={()=>{
              change('filters',[...w.filters,{field:filterField,operator:'eq',value:filterValue.trim()}]);
              setFilterField('');setFilterValue('');
            }}>Añadir filtro</button>
          </div>}
        </div>
      </>}
      <label style={{fontSize:12}}>Anchura<select style={field} value={w.width} onChange={e=>change('width',Number(e.target.value) as DashboardWidget['width'])}>
        {WIDTHS.map(n=><option key={n} value={n}>{n}/12 columnas</option>)}</select></label>
      <label style={{fontSize:12}}>Altura<select style={field} value={w.height} onChange={e=>change('height',Number(e.target.value))}>
        {Array.from({length:11},(_,i)=>i+2).map(n=><option key={n} value={n}>{n} filas</option>)}</select></label>
    </section>;
  }

  const hasDataError=Object.values(sourceErrors).length>0;
  return <div style={{...basic,background:bg,padding:'24px 26px',minHeight:'100%',display:'flex',flexDirection:'column',gap:18}}>
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
      <button style={btn} onClick={()=>void copyDashboardLink()} disabled={!dashboard||editing}>Copiar enlace</button>
      <button style={btn} onClick={()=>setLinkHelp(v=>!v)} disabled={!dashboard}>En el menú de Twenty</button>
      <button style={btn} onClick={()=>setImportOpen(v=>!v)} disabled={editing}>Importar</button>
    </div>
    {linkHelp&&dashboard&&<section style={{...card,display:'flex',flexDirection:'column',gap:8}} aria-label="Acceso directo al dashboard">
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(12,minmax(0,1fr))',gap:12,alignItems:'start'}}
          onPointerMove={e=>moveResize(e.clientX,e.clientY)}
          onPointerUp={()=>{if(resizeSource.current)endResize();else if(pointerSource.current)clearDrag();}}
          onPointerCancel={()=>{endResize();clearDrag();}}>
          {dashboard.widgets.map(w=><section key={w.id} style={{
            ...card,gridColumn:'span '+w.width,minWidth:0,
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
                  onClick={()=>{setEditingWidget(w.id);setFilterField('');setFilterValue('');}}>
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
              onPointerDown={e=>{e.stopPropagation();startResize(w.id,w.width,w.height,e.clientX,e.clientY);}}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                <path d="M12 4L4 12M12 8L8 12M12 12h-1"/>
              </svg>
            </div>}
          </section>)}
          {editing&&<section style={{...card,gridColumn:'1 / -1',background:'transparent',borderStyle:'dashed',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <select style={{...field,width:'auto'}} value={addKind} onChange={e=>setAddKind(e.target.value as WidgetKind)}>
              {KINDS.map(kind=><option key={kind} value={kind}>{WIDGET_LABELS[kind]}</option>)}</select>
            <select style={{...field,width:'auto'}} value={addSource} onChange={e=>setAddSource(e.target.value as Source)}>
              {SOURCE_KEYS.map(source=><option key={source} value={source}>{SOURCES[source].label}</option>)}</select>
            <button style={primary} onClick={addWidget}>+ Añadir widget</button>
          </section>}
        </div>
      </div>
      {editing&&widget&&<aside style={{flex:'0 1 295px',minWidth:255}}>{widgetEditor(widget)}</aside>}
    </div>}
    {hasDataError&&<p role="alert" style={{fontSize:12,color:muted}}>Algunas fuentes no pudieron consultarse. Los widgets afectados muestran el error, no un cero.</p>}
    {dashboard&&<p style={{fontSize:11,color:muted}}>Períodos calculados en la zona horaria del navegador. Los datos pertenecen al workspace actual. Hasta 3.000 registros por fuente; si se supera el límite, las métricas no se muestran como definitivas.</p>}
  </div>;
}
export default defineFrontComponent({
  universalIdentifier:IDS.FRONT_SUPPORT_OVERVIEW,
  name:'support-overview',
  description:'Constructor de dashboards Omnichannel con KPIs, gráficos, periodos y configuración por workspace.',
  component:Dashboards,
});
