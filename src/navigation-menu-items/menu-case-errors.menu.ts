import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier:IDS.MENU_CASE_ERRORS, name:'Errores técnicos', icon:'IconAlertCircle', position:4,
  type:NavigationMenuItemType.VIEW, viewUniversalIdentifier:IDS.VIEW_CASE_TECHNICAL_ERRORS, folderUniversalIdentifier:IDS.MENU_FOLDER,
});
