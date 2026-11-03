import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_CASES, name: "Consultas", icon: 'IconInbox', position: 1,
  type: NavigationMenuItemType.OBJECT, targetObjectUniversalIdentifier: IDS.CASE_OBJECT, folderUniversalIdentifier: IDS.MENU_FOLDER,
});
