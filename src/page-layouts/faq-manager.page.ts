import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default definePageLayout({
  universalIdentifier: IDS.LAYOUT_FAQ_MANAGER,
  name: 'Gestión visual de FAQs',
  type: 'STANDALONE_PAGE',
  tabs: [{
    universalIdentifier: IDS.LAYOUT_FAQ_MANAGER_TAB,
    title: 'FAQs',
    icon: 'IconBook',
    position: 0,
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets: [{
      universalIdentifier: IDS.LAYOUT_FAQ_MANAGER_WIDGET,
      title: 'Gestión de FAQs',
      type: 'FRONT_COMPONENT',
      heightBehavior: 'TAB_VIEWPORT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: IDS.FRONT_FAQ_MANAGER,
      },
    }],
  }],
});
