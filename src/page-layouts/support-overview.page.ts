import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default definePageLayout({
  universalIdentifier:IDS.LAYOUT_SUPPORT_HOME,
  name:'Dashboards Omnichannel',type:'STANDALONE_PAGE',
  tabs:[{universalIdentifier:IDS.LAYOUT_SUPPORT_HOME_TAB,title:'Dashboards',icon:'IconLayoutDashboard',position:0,
    layoutMode:PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets:[
      {universalIdentifier:IDS.LAYOUT_SUPPORT_HOME_WIDGET_KPIS,title:'Dashboards',type:'FRONT_COMPONENT',heightBehavior:'TAB_VIEWPORT',
       configuration:{configurationType:'FRONT_COMPONENT',frontComponentUniversalIdentifier:IDS.FRONT_SUPPORT_OVERVIEW}}
    ]
  }],
});
