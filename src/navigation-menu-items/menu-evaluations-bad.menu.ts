import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier:IDS.MENU_EVALUATIONS_BAD, name:'Respuestas incorrectas', icon:'IconAlertTriangle', position:10,
  type:NavigationMenuItemType.VIEW, viewUniversalIdentifier:IDS.VIEW_EVALUATIONS_INCORRECT, folderUniversalIdentifier:IDS.MENU_FOLDER,
});
