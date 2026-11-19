import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_FAQS, name: "FAQs", icon: 'IconBook', position: 3,
  type: NavigationMenuItemType.PAGE_LAYOUT, pageLayoutUniversalIdentifier: IDS.LAYOUT_FAQ_MANAGER, folderUniversalIdentifier: IDS.MENU_FOLDER,
});
