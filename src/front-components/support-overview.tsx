import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { openCommandConfirmationModal, useColorScheme } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import {
  SOURCES, WIDGET_LABELS, PERIOD_LABELS, MAX_DASHBOARDS, MAX_WIDGETS,
  createDashboard, defaultDashboard, fieldsFor, makeWidget, newId, normalizeWidget, periodFrom,
  type Source, type WidgetKind, type Dashboard, type DashboardWidget, type Period, type StoredDashboard,
} from '../lib/dashboard-model.ts';
import { loadDashboards, persistDashboard, removeDashboard, importDashboard, exportDashboard } from '../lib/dashboard-store.ts';
import { fetchDataset, summarize, formatMetric, metricDelta, type Dataset } from '../lib/dashboard-analytics.ts';

const SOURCE_KEYS=Object.keys(SOURCES) as Source[];
const KINDS=Object.keys(WIDGET_LABELS) as WidgetKind[];
const PERIOD_KEYS=Object.keys(PERIOD_LABELS) as Period['key'][];
const NUMERIC=['sum','avg','min','max','distinct'];
const WIDTHS=[3,4,6,8,12] as const;

function Dashboards() {
  const dark=useColorScheme()==='dark';
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
  },[dashboard?.id,reload,editing]);

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
      const id=await persistDashboard(new RestApiClient(),updated,entry?.settingId??null);
      setStored(current=>[...current.filter(row=>row.dashboard.id!==updated.id),{settingId:id,dashboard:updated}]);
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
    void navigator.clipboard.writeText(data).then(()=>setFeedback('Configuración JSON copiada al portapapeles.'))
      .catch(()=>setError('No se pudo copiar. Comprueba los permisos del portapapeles.'));
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
    if(w.kind==='shortcut')return <a href={w.url||'#'} target="_blank" rel="noopener noreferrer"
      style={{color:accent,textDecoration:'none',fontSize:13}}>{w.url?'Abrir acceso directo ↗':'Configura una URL para este acceso directo'}</a>;
    if(w.kind==='text')return <p style={{whiteSpace:'pre-wrap',fontSize:13,color:muted,margin:0}}>{w.text||'Escribe una descripción o instrucción.'}</p>;
    if(sourceErrors[w.source])return <p role="alert" style={{color:'#D94848',fontSize:12}}>{sourceErrors[w.source]}</p>;
    const data=datasets[w.source];
    if(!data)return <div style={{fontSize:12,color:muted}}>Cargando datos…</div>;
    const summary=summarize(data,w,dashboard?.period??{key:'30d'});
    if(!summary.complete)return <div style={{padding:'6px 0',fontSize:11,color:'#B47420'}}>
      Vista incompleta: hay más de 3.000 registros. No se presenta un resultado parcial como definitivo.
    </div>;
    if(w.kind==='kpi')return <div style={{display:'flex',flexDirection:'column',gap:6}}>
      <div style={{fontSize:30,fontWeight:650,fontVariantNumeric:'tabular-nums'}}>{formatMetric(summary.value,w.aggregation)}</div>
      {w.compare&&summary.previous!==null&&<div style={{fontSize:11,color:muted}}>
        {metricDelta(summary.value,summary.previous)} frente al período anterior
      </div>}
    </div>;
    if(!summary.points.length)return <p style={{fontSize:12,color:muted,margin:0}}>Sin registros para este período.</p>;
    const points=summary.points;
    if(w.kind==='table')return <div style={{maxHeight:260,overflow:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr><th style={{textAlign:'left',padding:7,borderBottom:'1px solid '+border}}>Grupo</th>
          <th style={{textAlign:'right',padding:7,borderBottom:'1px solid '+border}}>Valor</th></tr></thead>
        <tbody>{points.map(p=><tr key={p.name}><td style={{padding:7,borderBottom:'1px solid '+border}}>{p.name}</td>
          <td style={{padding:7,textAlign:'right',borderBottom:'1px solid '+border}}>{formatMetric(p.value,w.aggregation)}</td></tr>)}</tbody>
      </table>
    </div>;
    if(w.kind==='donut'){
      const total=points.reduce((n,p)=>n+p.value,0);
      let progress=0;
      const colors=['#5363E9','#23A78B','#F1A736','#E66B73','#8B78DE','#60A5FA'];
      const gradient=points.map((p,i)=>{
        const start=progress;progress+=total?100*p.value/total:0;
        return colors[i%colors.length]+' '+start+'% '+progress+'%';
      }).join(',');
      return <div style={{display:'flex',gap:18,alignItems:'center',flexWrap:'wrap'}}>
        <div aria-label="Distribución circular" style={{width:130,height:130,borderRadius:'50%',
          background:total?'conic-gradient('+gradient+')':border,display:'grid',placeItems:'center',flexShrink:0}}>
          <div style={{width:79,height:79,borderRadius:'50%',background:surface,display:'grid',placeItems:'center',fontSize:17,fontWeight:650}}>{formatMetric(total,'count')}</div>
        </div>
        <div style={{flex:'1 1 130px',display:'flex',flexDirection:'column',gap:6}}>
          {points.slice(0,9).map((p,i)=><div key={p.name} style={{fontSize:11,display:'flex',alignItems:'center',gap:7}}>
            <span style={{width:8,height:8,borderRadius:2,background:colors[i%colors.length]}}/>
            <span style={{flex:1,wordBreak:'break-word'}}>{p.name}</span>
            <strong>{formatMetric(p.value,w.aggregation)}</strong>
          </div>)}
        </div>
      </div>;
    }
    const max=Math.max(1,...points.map(p=>Math.abs(p.value)));
    if(w.kind==='line'||w.kind==='area'){
      const coordinates=points.map((p,i)=>[18+(points.length===1?0:i*340/(points.length-1)),155-(p.value/max)*130]);
      const segments=coordinates.map(([x,y])=>x+','+y).join(' ');
      return <div>
        <svg viewBox="0 0 380 180" preserveAspectRatio="none" style={{width:'100%',height:190}} role="img" aria-label={w.title}>
          {[25,90,155].map(y=><line key={y} x1="18" x2="365" y1={y} y2={y} stroke={border} strokeDasharray="3 4"/>)}
          {w.kind==='area'&&coordinates.length>1&&<polygon points={'18,155 '+segments+' '+coordinates[coordinates.length-1][0]+',155'} fill="#5363E9" opacity=".14"/>}
          <polyline points={segments} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
          {coordinates.map(([x,y],i)=><circle key={points[i].name} cx={x} cy={y} r="3" fill={accent}><title>{points[i].name+': '+formatMetric(points[i].value,w.aggregation)}</title></circle>)}
        </svg>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:muted}}>
          <span>{points[0].name}</span><span>{points[points.length-1].name}</span>
        </div>
      </div>;
    }
    return <div style={{display:'flex',flexDirection:'column',gap:9,maxHeight:320,overflow:'auto'}}>
      {points.map(p=><div key={p.name} style={{display:'grid',gridTemplateColumns:'minmax(70px,1fr) 3fr 60px',alignItems:'center',gap:9,fontSize:11}}>
        <span title={p.name} style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
        <div style={{height:12,borderRadius:3,background:dark?'#344052':'#EEF1F7',overflow:'hidden'}}>
          <div style={{height:'100%',width:Math.max(0,Math.min(100,p.value/max*100))+'%',background:accent,borderRadius:3}}/>
        </div>
        <strong style={{textAlign:'right'}}>{formatMetric(p.value,w.aggregation)}</strong>
      </div>)}
    </div>;
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
    </section>;
  }

  const hasDataError=Object.values(sourceErrors).length>0;
  return <div style={{...basic,background:bg,padding:'24px 26px',minHeight:'100%',display:'flex',flexDirection:'column',gap:18}}>
    <header style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        <div style={{fontSize:11,color:accent,textTransform:'uppercase',letterSpacing:1.3,fontWeight:700}}>Omnichannel / Dashboards</div>
        <h1 style={{fontSize:23,margin:0,fontWeight:650}}>{dashboard?.title??'Dashboards'}</h1>
        <div style={{fontSize:12,color:muted}}>{dashboard?.description||'Indicadores personalizables de tu workspace'}</div>
      </div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        <button style={btn} onClick={resetData} disabled={editing}>Actualizar datos</button>
        {!editing&&<button style={btn} onClick={startEdit} disabled={!dashboard}>Editar</button>}
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
      <button style={btn} onClick={()=>setImportOpen(v=>!v)} disabled={editing}>Importar</button>
    </div>
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
    {dashboard&&<div style={{display:'flex',gap:15,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div style={{flex:'1 1 680px',minWidth:0}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(12,minmax(0,1fr))',gap:12}}>
          {dashboard.widgets.map((w,index)=><section key={w.id} style={{
            ...card,gridColumn:'span '+w.width, minWidth:0,
            outline:editingWidget===w.id&&editing?'2px solid '+accent:'none',
          }}>
            <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'start',marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:650,flex:1,minWidth:0}}>{w.title}</div>
              {editing&&<div style={{display:'flex',gap:3}}>
                <button style={{...btn,padding:'3px 7px'}} title="Mover antes" disabled={index===0} onClick={()=>swapWidget(w.id,-1)}>←</button>
                <button style={{...btn,padding:'3px 7px'}} title="Mover después" disabled={index===dashboard.widgets.length-1} onClick={()=>swapWidget(w.id,1)}>→</button>
                <button style={{...btn,padding:'3px 7px'}} title="Configurar" onClick={()=>{setEditingWidget(w.id);setFilterField('');setFilterValue('');}}>⚙</button>
                <button style={{...btn,padding:'3px 7px'}} title="Eliminar" onClick={()=>mutate(d=>({...d,widgets:d.widgets.filter(row=>row.id!==w.id)}))}>×</button>
              </div>}
            </div>
            {renderChart(w)}
          </section>)}
          {editing&&<section style={{...card,gridColumn:'span 12',background:'transparent',borderStyle:'dashed',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
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
