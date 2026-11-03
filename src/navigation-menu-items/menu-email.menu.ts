import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_EMAIL, name: "Email", icon: 'IconMail', position: 2,
  type: NavigationMenuItemType.VIEW, viewUniversalIdentifier: IDS.VIEW_CASE_EMAIL, folderUniversalIdentifier: IDS.MENU_FOLDER,
});
