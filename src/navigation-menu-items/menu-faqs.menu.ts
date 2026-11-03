import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_FAQS, name: "FAQs", icon: 'IconBook', position: 6,
  type: NavigationMenuItemType.OBJECT, targetObjectUniversalIdentifier: IDS.FAQ_OBJECT, folderUniversalIdentifier: IDS.MENU_FOLDER,
});
