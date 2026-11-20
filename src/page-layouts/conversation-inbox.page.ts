import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default definePageLayout({
  universalIdentifier: IDS.LAYOUT_CONVERSATION_INBOX,
  name: 'Conversaciones Omnichannel',
  type: 'STANDALONE_PAGE',
  tabs: [{
    universalIdentifier: IDS.LAYOUT_CONVERSATION_INBOX_TAB,
    title: 'Conversaciones',
    icon: 'IconInbox',
    position: 0,
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets: [{
      universalIdentifier: IDS.LAYOUT_CONVERSATION_INBOX_WIDGET,
      title: 'Conversaciones',
      type: 'FRONT_COMPONENT',
      heightBehavior: 'TAB_VIEWPORT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: IDS.FRONT_CONVERSATION_INBOX,
      },
    }],
  }],
});
