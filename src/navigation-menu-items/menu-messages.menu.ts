import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_MESSAGES, name: "Mensajes", icon: 'IconMessages', position: 7,
  type: NavigationMenuItemType.OBJECT, targetObjectUniversalIdentifier: IDS.MESSAGE_OBJECT, folderUniversalIdentifier: IDS.MENU_FOLDER,
});
