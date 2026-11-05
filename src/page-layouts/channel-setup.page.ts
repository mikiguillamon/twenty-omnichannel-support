import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default definePageLayout({
  universalIdentifier:IDS.LAYOUT_CHANNEL_SETUP,
  name:'Configuración de canales',
  type:'STANDALONE_PAGE',
  tabs:[{
    universalIdentifier:IDS.LAYOUT_CHANNEL_SETUP_TAB,
    title:'Canales',
    position:0,
    icon:'IconPlug',
    layoutMode:PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets:[
      {universalIdentifier:IDS.LAYOUT_CHANNEL_SETUP_WIDGET_FORM,title:'Alta y activación',type:'FRONT_COMPONENT',heightBehavior:'FIT_CONTENT',
        configuration:{configurationType:'FRONT_COMPONENT',frontComponentUniversalIdentifier:IDS.FRONT_CHANNEL_SETUP}},
      {universalIdentifier:IDS.LAYOUT_CHANNEL_SETUP_WIDGET_TABLE,title:'Tabla de canales',type:'RECORD_TABLE',heightBehavior:'FIT_CONTENT',
        configuration:{configurationType:'RECORD_TABLE',viewUniversalIdentifier:IDS.VIEW_CHANNELS,recordLimit:25,isUIEditable:true}},
    ],
  },{
    universalIdentifier: IDS.LAYOUT_CHANNEL_POLICIES_TAB,
    title: 'Gestión de consultas', position: 1, icon: 'IconMessages',
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets: [{
      universalIdentifier: IDS.LAYOUT_CHANNEL_POLICIES_WIDGET,
      title: 'Reglas por canal', type: 'FRONT_COMPONENT', heightBehavior: 'FIT_CONTENT',
      configuration: {configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: IDS.FRONT_CHANNEL_POLICIES},
    }],
  }],
});
