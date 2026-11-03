import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_FOLDER, name: 'Atención al cliente', icon: 'IconHeadset', position: 0,
  type: NavigationMenuItemType.FOLDER,
});
