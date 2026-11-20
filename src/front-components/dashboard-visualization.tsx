import { summarize, formatMetric, metricDelta, type Dataset, type Point } from '../lib/dashboard-analytics.ts';
import { type DashboardWidget, type Period } from '../lib/dashboard-model.ts';

// The Twenty 2.50 Front Component renderer runs in a Remote DOM worker.
// Keep charts dependency-free, semantic, and restricted to supported SVG/CSS.
const PALETTE = ['#5065E9', '#159B87', '#E8A23A', '#D96B7F', '#8E72D5', '#319AB7', '#6E8E42'];
const number = (value:number) => new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(value);
const compact = (value:number) => new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:1}).format(value);
type Props = {
  widget: DashboardWidget;
  period: Period;
  data?: Dataset;
  sourceError?: string;
  dark: boolean;
};
const readable = (name:string) => name.length > 16 ? name.slice(0,14)+'…' : name;

function Empty({label, dark}:{label:string;dark:boolean}) {
  return <div role="status" style={{minHeight:150,display:'flex',justifyContent:'center',alignItems:'center',
    textAlign:'center',padding:18,fontSize:12,color:dark?'#AEBAD1':'#67758A',
    background:dark?'#293440':'#F7F9FC',borderRadius:8}}>{label}</div>;
}
function BarChart({points,kind,dark}:{points:Point[];kind:'bar'|'hour';dark:boolean}) {
  const max=Math.max(1,...points.map(point=>point.value));
  const shown=kind==='bar'?points.slice(0,12):points;
  if(!shown.some(point=>point.value!==0))return <Empty label="No hay actividad para este período" dark={dark}/>;
  const muted=dark?'#AEBAD1':'#66758A';
  if(kind==='hour')return <div style={{minWidth:350}}>
    <div role="img" aria-label="Actividad por hora, de 00:00 a 23:00"
      style={{height:156,display:'grid',gridTemplateColumns:'repeat(24,minmax(0,1fr))',
        alignItems:'end',gap:3,padding:'15px 0 0',borderBottom:'1px solid '+(dark?'#3B485B':'#E0E7F0')}}>
      {shown.map((point,i)=><div key={point.name} title={point.name+': '+number(point.value)}
        style={{position:'relative',minHeight:point.value===0?3:9,
          height:Math.max(3,point.value/max*130)+'px',
          background:point.value===0?(dark?'#3B4658':'#E5EAF3'):PALETTE[0],
          borderRadius:'4px 4px 0 0',transition:'height 180ms ease'}}/>)}
    </div>
    <div style={{display:'flex',justifyContent:'space-between',color:muted,fontSize:10,marginTop:9}}>
      <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>23:00</span>
    </div>
    <div style={{fontSize:11,color:muted,marginTop:12}}>Pico: {shown.reduce((best,p)=>p.value>best.value?p:best,shown[0]).name} · {compact(max)} registros</div>
  </div>;
  return <div style={{display:'flex',flexDirection:'column',gap:12}}>
    {shown.map((point,i)=><div key={point.name} style={{display:'grid',gridTemplateColumns:'minmax(76px,1.45fr) minmax(85px,3fr) 55px',alignItems:'center',gap:12}}>
      <span title={point.name} style={{fontSize:12,color:muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{point.name}</span>
      <div role="meter" aria-label={point.name} aria-valuemin={0} aria-valuenow={point.value} aria-valuemax={max}
        style={{height:10,background:dark?'#344152':'#EDF1F7',borderRadius:4,overflow:'hidden'}}>
        <div style={{width:(point.value/max*100)+'%',minWidth:point.value>0?3:0,height:'100%',
          background:PALETTE[i%PALETTE.length],borderRadius:4,transition:'width 180ms ease'}}/>
      </div>
      <strong style={{textAlign:'right',fontSize:12,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{number(point.value)}</strong>
    </div>)}
    {points.length>shown.length&&<div style={{fontSize:11,color:muted}}>Mostrando los {shown.length} grupos principales de {points.length}</div>}
  </div>;
}
function Donut({points,dark}:{points:Point[];dark:boolean}) {
  const total=points.reduce((acc,p)=>acc+p.value,0);
  if(total<=0)return <Empty label="No hay distribución para este período" dark={dark}/>;
  const main=points.slice(0,5);
  const other=points.slice(5).reduce((acc,p)=>acc+p.value,0);
  const parts=other>0?[...main,{name:'Otros',value:other}]:main;
  let progressed=0;
  const gradient=parts.map((point,i)=>{
    const from=progressed;progressed+=point.value/total*100;
    return PALETTE[i%PALETTE.length]+' '+from.toFixed(2)+'% '+progressed.toFixed(2)+'%';
  }).join(',');
  return <div style={{display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
    <div role="img" aria-label={'Total de '+number(total)+' registros repartidos en '+parts.length+' grupos'}
      style={{width:150,height:150,flexShrink:0,borderRadius:'50%',background:'conic-gradient('+gradient+')',
        display:'grid',placeItems:'center'}}>
      <div style={{width:105,height:105,borderRadius:'50%',background:dark?'#252D38':'white',
        display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column'}}>
        <strong style={{fontSize:25,fontWeight:650,lineHeight:1.2,fontVariantNumeric:'tabular-nums'}}>{compact(total)}</strong>
        <span style={{fontSize:10,color:dark?'#AEBAD1':'#66758A'}}>Total</span>
      </div>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:11,flex:'1 1 170px',minWidth:130}}>
      {parts.map((point,i)=><div key={point.name} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
        <span aria-hidden="true" style={{width:8,height:8,flexShrink:0,borderRadius:3,background:PALETTE[i%PALETTE.length]}}/>
        <span title={point.name} style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{point.name}</span>
        <strong style={{fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{Math.round(point.value/total*100)}%</strong>
        <span style={{fontSize:11,color:dark?'#AEBAD1':'#66758A',minWidth:20,textAlign:'right'}}>{number(point.value)}</span>
      </div>)}
    </div>
  </div>;
}
function Timeline({points,kind,dark,title}:{points:Point[];kind:'line'|'area';dark:boolean;title:string}) {
  if(!points.length || !points.some(point=>point.value!==0))return <Empty label="Sin actividad registrada en el período seleccionado" dark={dark}/>;
  const w=700,h=226,left=52,right=18,top=17,bottom=37;
  const chartW=w-left-right,chartH=h-top-bottom;
  const high=Math.max(...points.map(point=>point.value),1);
  const step=Math.pow(10,Math.floor(Math.log10(high/4)));
  const rounded=Math.max(step,Math.ceil(high/4/step)*step);
  const ceiling=rounded*4;
  const x=(i:number)=>left+(points.length<=1?chartW/2:i*chartW/(points.length-1));
  const y=(v:number)=>top+chartH*(1-v/ceiling);
  const line=points.map((point,i)=>(i===0?'M':'L')+x(i).toFixed(1)+' '+y(point.value).toFixed(1)).join(' ');
  const area=line+' L '+x(points.length-1).toFixed(1)+' '+(top+chartH)+' L '+x(0).toFixed(1)+' '+(top+chartH)+' Z';
  const muted=dark?'#AEBAD1':'#66758A',grid=dark?'#3C4A5B':'#E7EBF2',stroke=PALETTE[0];
  const markers=[...new Set([0,Math.round((points.length-1)/4),Math.round((points.length-1)/2),
    Math.round((points.length-1)*3/4),points.length-1])];
  return <div style={{width:'100%',overflowX:'auto'}}>
    <svg viewBox={'0 0 '+w+' '+h} role="img" aria-label={title+' · '+number(points.reduce((n,p)=>n+p.value,0))+' registros'}
      style={{display:'block',width:'100%',minWidth:470,height:'auto'}}>
      {Array.from({length:5},(_,i)=>{
        const v=ceiling*i/4,ty=y(v);
        return <g key={i}>
          <line x1={left} x2={w-right} y1={ty} y2={ty} stroke={grid} strokeDasharray={i===0?'0':'4 5'} />
          <text x={left-9} y={ty+4} fill={muted} fontSize="11" textAnchor="end">{compact(v)}</text>
        </g>;
      })}
      {kind==='area'&&<path d={area} fill={stroke} opacity={0.11}/>}
      <path d={line} stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
      {points.map((point,i)=>point.value>0&&(points.length<=14||i===points.length-1)?
        <circle key={i} cx={x(i)} cy={y(point.value)} r="3.3" fill={dark?'#252D38':'#FFFFFF'} stroke={stroke} strokeWidth="2">
          <title>{point.name+': '+number(point.value)}</title>
        </circle>:null)}
      {markers.map(i=><text key={i} x={x(i)} y={h-10} fontSize="11" fill={muted} textAnchor={i===0?'start':i===points.length-1?'end':'middle'}>
        {readable(points[i].name)}
      </text>)}
    </svg>
  </div>;
}

export function DashboardVisualization({widget,period,data,sourceError,dark}:Props) {
  const muted=dark?'#AEBAD1':'#66758A';
  if(widget.kind==='text')return <p style={{fontSize:13,lineHeight:1.7,color:muted,whiteSpace:'pre-wrap',margin:0}}>{widget.text||'Añade contenido a este bloque.'}</p>;
  if(widget.kind==='shortcut')return widget.url
    ?<a href={widget.url} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:PALETTE[0],textDecoration:'underline',textUnderlineOffset:3}}>
      Abrir enlace configurado
    </a>:<Empty label="Configura una URL para este acceso directo" dark={dark}/>;
  if(sourceError)return <div role="alert" style={{color:dark?'#F7A0A0':'#BA3E44',fontSize:12,lineHeight:1.6}}>{sourceError} · Prueba a actualizar los datos.</div>;
  if(!data)return <div aria-label="Cargando datos" style={{display:'flex',flexDirection:'column',gap:12,paddingTop:9}}>
    {[76,94,59].map((pct,i)=><div key={i} style={{width:pct+'%',height:i===0?23:11,borderRadius:5,background:dark?'#354151':'#EBEFF5'}}/>)}
  </div>;
  const summary=summarize(data,widget,period);
  if(!summary.complete)return <div role="alert" style={{padding:'12px 0',fontSize:12,color:dark?'#E7BC74':'#97671C'}}>
    Más de 3.000 registros en esta fuente. Las métricas se han ocultado para evitar resultados incompletos.
  </div>;
  if(widget.kind==='kpi')return <div style={{display:'flex',flexDirection:'column',gap:7,minHeight:67}}>
    <strong style={{fontSize:32,lineHeight:1.15,fontWeight:650,letterSpacing:'-0.02em',
      fontVariantNumeric:'tabular-nums'}}>{formatMetric(summary.value,widget.aggregation)}</strong>
    {widget.compare&&<span style={{fontSize:11,color:muted}}>
      {(summary.previous!==null?metricDelta(summary.value,summary.previous):null)?.concat(' respecto al período anterior') ?? 'Sin comparación disponible'}
    </span>}
  </div>;
  if(!summary.points.length)return <Empty label="No hay registros para este período" dark={dark}/>;
  if(widget.kind==='table')return <div style={{maxHeight:280,overflow:'auto'}}>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
      <thead><tr><th scope="col" style={{textAlign:'left',padding:'8px 5px',color:muted,borderBottom:'1px solid '+(dark?'#394659':'#E7EBF2')}}>Grupo</th>
        <th scope="col" style={{textAlign:'right',padding:'8px 5px',color:muted,borderBottom:'1px solid '+(dark?'#394659':'#E7EBF2')}}>Valor</th></tr></thead>
      <tbody>{summary.points.map(point=><tr key={point.name}>
        <td style={{padding:'9px 5px',borderBottom:'1px solid '+(dark?'#344052':'#F0F2F6'),overflowWrap:'anywhere'}}>{point.name}</td>
        <td style={{padding:'9px 5px',textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,borderBottom:'1px solid '+(dark?'#344052':'#F0F2F6')}}>{formatMetric(point.value,widget.aggregation)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
  if(widget.kind==='donut')return <Donut points={summary.points} dark={dark}/>;
  if(widget.kind==='line'||widget.kind==='area')return <Timeline points={summary.points} kind={widget.kind} dark={dark} title={widget.title}/>;
  return <BarChart points={summary.points} kind={widget.kind==='hour'?'hour':'bar'} dark={dark}/>;
}
