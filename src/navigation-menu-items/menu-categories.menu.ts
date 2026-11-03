import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_CATEGORIES, name: 'Categorias', icon: 'IconCategory', position: 5,
  type: NavigationMenuItemType.OBJECT, targetObjectUniversalIdentifier: IDS.CATEGORY_OBJECT,
  folderUniversalIdentifier: IDS.MENU_FOLDER,
});
