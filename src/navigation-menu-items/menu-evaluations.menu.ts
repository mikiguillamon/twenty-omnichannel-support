import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier:IDS.MENU_EVALUATIONS, name:'Evaluaciones', icon:'IconClipboardCheck', position:9,
  type:NavigationMenuItemType.OBJECT, targetObjectUniversalIdentifier:IDS.EVALUATION_OBJECT, folderUniversalIdentifier:IDS.MENU_FOLDER,
});
