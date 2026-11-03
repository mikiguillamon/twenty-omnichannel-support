import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_HUMAN, name: "Pendientes agente", icon: 'IconUserExclamation', position: 4,
  type: NavigationMenuItemType.VIEW, viewUniversalIdentifier: IDS.VIEW_CASE_HUMAN, folderUniversalIdentifier: IDS.MENU_FOLDER,
});
