import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_TYPES, name: 'Tipos', icon: 'IconAdjustments', position: 4.5,
  type: NavigationMenuItemType.OBJECT, targetObjectUniversalIdentifier: IDS.TYPE_OBJECT,
  folderUniversalIdentifier: IDS.MENU_FOLDER,
});
