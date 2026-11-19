import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

// The visual manager needs a NEW navigation ID. Never repurpose the installed
// OBJECT menu's universalIdentifier for a different navigation type.
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_FAQS_MANAGER,
  name: 'FAQs',
  icon: 'IconBook',
  position: 3,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: IDS.LAYOUT_FAQ_MANAGER,
  folderUniversalIdentifier: IDS.MENU_FOLDER,
});
