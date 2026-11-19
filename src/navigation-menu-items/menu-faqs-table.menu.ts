import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_FAQS_TABLE,
  name: 'FAQs (tabla)',
  icon: 'IconTable',
  position: 3.5,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: IDS.FAQ_OBJECT,
  folderUniversalIdentifier: IDS.MENU_FOLDER,
});
