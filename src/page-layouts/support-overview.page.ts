import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default definePageLayout({
  universalIdentifier:IDS.LAYOUT_SUPPORT_HOME,
  name:'Resumen de atención',type:'STANDALONE_PAGE',
  tabs:[{universalIdentifier:IDS.LAYOUT_SUPPORT_HOME_TAB,title:'Resumen',icon:'IconLayoutDashboard',position:0,
    layoutMode:PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets:[
      {universalIdentifier:IDS.LAYOUT_SUPPORT_HOME_WIDGET_KPIS,title:'Indicadores',type:'FRONT_COMPONENT',heightBehavior:'FIT_CONTENT',
       configuration:{configurationType:'FRONT_COMPONENT',frontComponentUniversalIdentifier:IDS.FRONT_SUPPORT_OVERVIEW}},
      {universalIdentifier:IDS.LAYOUT_SUPPORT_HOME_WIDGET_HUMAN,title:'Consultas que necesitan atención',type:'RECORD_TABLE',heightBehavior:'FIT_CONTENT',
       configuration:{configurationType:'RECORD_TABLE',viewUniversalIdentifier:IDS.VIEW_CASE_HUMAN,recordLimit:8,isUIEditable:false}},
      {universalIdentifier:IDS.LAYOUT_SUPPORT_HOME_WIDGET_ERRORS,title:'Errores técnicos',type:'RECORD_TABLE',heightBehavior:'FIT_CONTENT',
       configuration:{configurationType:'RECORD_TABLE',viewUniversalIdentifier:IDS.VIEW_CASE_TECHNICAL_ERRORS,recordLimit:8,isUIEditable:false}},
    ]
  }],
});
