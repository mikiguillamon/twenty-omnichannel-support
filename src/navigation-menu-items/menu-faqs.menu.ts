import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

// Keep the original navigation UUID and OBJECT type: Twenty 2.50 rejects type changes
// on existing navigation metadata. Renaming and reordering are allowed.
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_FAQS,
  name: 'FAQs (tabla)',
  icon: 'IconTable',
  position: 3.5,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: IDS.FAQ_OBJECT,
  folderUniversalIdentifier: IDS.MENU_FOLDER,
});
