import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_SETTINGS, name: 'Configuracion', icon: 'IconSettings', position: 8,
  type: NavigationMenuItemType.OBJECT, targetObjectUniversalIdentifier: IDS.SETTING_OBJECT,
  folderUniversalIdentifier: IDS.MENU_FOLDER,
});
