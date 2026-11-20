import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default definePageLayout({
  universalIdentifier: IDS.LAYOUT_ADMIN_FULL,
  name: 'Administración Omnichannel',
  type: 'STANDALONE_PAGE',
  tabs: [{
    universalIdentifier: IDS.LAYOUT_ADMIN_FULL_TAB,
    title: 'Administración',
    icon: 'IconSettings',
    position: 0,
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets: [{
      universalIdentifier: IDS.LAYOUT_ADMIN_FULL_WIDGET,
      title: 'Administración Omnichannel',
      type: 'FRONT_COMPONENT',
      heightBehavior: 'TAB_VIEWPORT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: IDS.FRONT_ADMIN_FULL,
      },
    }],
  }],
});
