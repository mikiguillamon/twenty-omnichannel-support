import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier:IDS.MENU_OVERVIEW, name:'Resumen', icon:'IconLayoutDashboard', position:0,
  type:NavigationMenuItemType.PAGE_LAYOUT, pageLayoutUniversalIdentifier:IDS.LAYOUT_SUPPORT_HOME, folderUniversalIdentifier:IDS.MENU_FOLDER,
});
