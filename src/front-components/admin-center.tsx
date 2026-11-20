import { useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  AppPath, navigate, useColorScheme, useSelectedObjectMetadata,
} from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { Dashboards } from '../ui/dashboard-page.tsx';
import { FaqManagerEntry } from '../ui/faq-manager-page.tsx';
import { ChannelSetup } from '../ui/channel-setup-page.tsx';
import { ChannelPolicies } from '../ui/channel-policies-page.tsx';
import { NavigationPreflight } from '../ui/navigation-preflight.tsx';

/**
 * The app settings area is the permission-controlled administrative entry
 * point available to Twenty SDK 2.50. It does NOT substitute for a sidebar
 * folder filtered by role. Keep the latter a release blocker until Twenty
 * exposes role-scoped navigation in the app manifest.
 */
type Section = 'dashboards'|'faqs'|'channels'|'policies'|'catalogs';
const sections: {key:Section;label:string;description:string}[] = [
  {key:'dashboards',label:'Dashboards',description:'Paneles de indicadores y su configuración.'},
  {key:'faqs',label:'FAQs',description:'Preguntas, respuestas, publicaciones y alcances.'},
  {key:'channels',label:'Canales',description:'Instancias conectadas y su estado.'},
  {key:'policies',label:'Políticas por canal',description:'Continuidad, agrupación y reapertura.'},
  {key:'catalogs',label:'Datos y ajustes',description:'Objetos, evaluaciones e identidades.'},
];

const nativeObjects = [
  {label:'Conversaciones',plural:'supportCases',description:'Consultas, estados y seguimiento'},
  {label:'Mensajes',plural:'supportMessages',description:'Historial completo por canal'},
  {label:'Canales (tabla)',plural:'supportChannels',description:'Vista nativa y registros de canales'},
  {label:'FAQs (tabla)',plural:'supportFaqs',description:'Vista nativa de registros'},
  {label:'Categorías',plural:'supportCategories',description:'Clasificación de consultas'},
  {label:'Tipos de conversación',plural:'supportTypes',description:'Catálogo de tipos'},
  {label:'Evaluaciones',plural:'supportEvaluations',description:'Revisión humana y calidad'},
  {label:'Identidades externas',plural:'supportExternalIdentities',description:'Identidades por proveedor'},
  {label:'Alias de identidad',plural:'supportIdentityAliases',description:'PN, LID y otros identificadores'},
  {label:'Ajustes de soporte',plural:'supportSettings',description:'Configuración técnica sin secretos'},
] as const;

export function OmnichannelAdminCenter() {
  const dark=useColorScheme()==='dark';
  const selectedObject=useSelectedObjectMetadata();
  const [section,setSection]=useState<Section>('dashboards');
  const [navigationError,setNavigationError]=useState('');
  const [showNavigationGuide,setShowNavigationGuide]=useState(false);
  const surface=dark?'#252D38':'#FFFFFF';
  const bg=dark?'#1D232C':'#F8FAFC';
  const border=dark?'#455164':'#E1E6ED';
  const text=dark?'#F4F6FA':'#20252D';
  const muted=dark?'#AAB6C6':'#657385';
  const accent='#5363E9';

  // The visual FAQ editor opens the current front component in a native side
  // panel. When it is hosted here, retain that exact editing behaviour.
  if(selectedObject?.nameSingular==='supportFaq')return <FaqManagerEntry/>;

  async function openObject(objectNamePlural:string) {
    setNavigationError('');
    try {
      await navigate(AppPath.RecordIndexPage,{objectNamePlural});
    } catch {
      setNavigationError('No se pudo abrir la vista. Comprueba los permisos y que el objeto esté instalado.');
    }
  }

  return <div style={{background:bg,color:text,minHeight:'100%',width:'100%',fontFamily:'inherit',padding:'clamp(12px, 2vw, 28px)',boxSizing:'border-box',display:'flex',flexDirection:'column',gap:16}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:12,flexWrap:'wrap'}}>
      <div>
        <h1 style={{margin:0,fontSize:24,fontWeight:650,letterSpacing:'-0.02em'}}>Administración Omnichannel</h1>
        <p style={{fontSize:13,color:muted,margin:'7px 0 0',lineHeight:1.55}}>
          Herramientas del workspace para gestionar soporte, canales y conocimiento.
        </p>
      </div>
    </header>
    <div style={{display:'flex',flexDirection:'column',gap:18,width:'100%',minWidth:0}}>
      <nav aria-label="Secciones de administración Omnichannel"
        style={{width:'100%',boxSizing:'border-box',display:'flex',flexDirection:'row',flexWrap:'wrap',gap:7,padding:7,border:'1px solid '+border,borderRadius:10,background:surface}}>
        {sections.map(item=><button key={item.key} type="button" aria-current={section===item.key?'page':undefined}
          onClick={()=>{setSection(item.key);setNavigationError('');}}
          style={{border:0,borderRadius:7,cursor:'pointer',background:section===item.key?(dark?'#334155':'#EDF0FF'):'transparent',
            color:section===item.key?accent:text,padding:'12px 16px',fontSize:13,textAlign:'center',whiteSpace:'nowrap',flex:'1 1 auto',fontWeight:section===item.key?650:500}}>
          {item.label}
        </button>)}
      </nav>
      <main style={{width:'100%',minWidth:0,display:'flex',flexDirection:'column',gap:16}}>
        <div style={{padding:'2px 1px 5px'}}>
          <h2 style={{fontSize:17,fontWeight:650,margin:0}}>{sections.find(item=>item.key===section)?.label}</h2>
          <p style={{fontSize:12,margin:'5px 0 0',color:muted}}>{sections.find(item=>item.key===section)?.description}</p>
        </div>
        {navigationError&&<p role="alert" style={{color:dark?'#F7A0A0':'#BA3E44',fontSize:12}}>{navigationError}</p>}
        {section==='dashboards'&&<><section style={{background:surface,border:'1px solid '+border,borderRadius:12,padding:16}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><strong style={{fontSize:14}}>Publicar en el menú principal</strong><p style={{fontSize:12,color:muted,lineHeight:1.6,margin:'5px 0 0'}}>Los accesos compartidos se gestionan desde el editor nativo del menú de Twenty.</p></div><button type="button" aria-expanded={showNavigationGuide} onClick={()=>setShowNavigationGuide(v=>!v)} style={{background:accent,color:'#fff',border:0,borderRadius:8,padding:'10px 14px',cursor:'pointer',fontSize:12,fontWeight:600}}>{showNavigationGuide?'Ocultar instrucciones':'Ver instrucciones'}</button></div>{showNavigationGuide&&<div style={{background:bg,borderRadius:8,padding:12,marginTop:12,fontSize:13,lineHeight:1.7}}><ol style={{margin:0,paddingLeft:22}}><li>Desde el editor de menú de Twenty, añade la página operativa Dashboards Omnichannel al workspace.</li><li>Abre esa página fuera de Ajustes, selecciona el dashboard y pulsa Copiar enlace.</li><li>Añade el enlace interno como acceso compartido en el menú principal.</li><li>Comprueba el acceso con un usuario Member y los permisos de lectura sobre los datos del dashboard.</li></ol><p style={{color:muted,margin:'10px 0 0'}}>El SDK de Twenty 2.50 no permite publicar dinámicamente estos enlaces. Este asistente no modifica el menú ni los permisos.</p></div>}</section><div style={{width:'100%',minWidth:0}}><Dashboards enableLinks={false} enableMigration/></div></>}
        {section==='faqs'&&<FaqManagerEntry/>}
        {section==='channels'&&<ChannelSetup/>}
        {section==='policies'&&<ChannelPolicies/>}
        {section==='catalogs'&&<NavigationPreflight/>}
        {section==='catalogs'&&<section style={{background:surface,border:'1px solid '+border,borderRadius:10,padding:16,display:'flex',flexDirection:'column',gap:2}}>
          {nativeObjects.map(item=><button type="button" key={item.plural}
            onClick={()=>void openObject(item.plural)}
            style={{width:'100%',textAlign:'left',display:'flex',flexDirection:'column',gap:4,cursor:'pointer',
              background:'transparent',color:text,border:0,borderBottom:'1px solid '+border,padding:'12px 8px'}}>
            <span style={{fontSize:13,fontWeight:600}}>{item.label}</span>
            <span style={{fontSize:12,color:muted}}>{item.description}</span>
          </button>)}
          <p style={{fontSize:12,color:muted,lineHeight:1.6,margin:'12px 6px 0'}}>
            Las vistas de objetos se abren en la interfaz nativa de Twenty y siempre
            respetan los permisos del usuario. No se almacenan contraseñas ni tokens en este panel.
          </p>
        </section>}
      </main>
    </div>
  </div>;
}

export default defineFrontComponent({
  universalIdentifier:IDS.FRONT_ADMIN_CENTER,
  name:'omnichannel-admin-center',
  description:'Centro de administración de Omnichannel Support, alojado en los ajustes de la aplicación.',
  component:OmnichannelAdminCenter,
});
