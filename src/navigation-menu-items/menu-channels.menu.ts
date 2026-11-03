import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier:IDS.MENU_CHANNELS, name:'Canales', icon:'IconPlug', position:8,
  type:NavigationMenuItemType.OBJECT, targetObjectUniversalIdentifier:IDS.CHANNEL_OBJECT, folderUniversalIdentifier:IDS.MENU_FOLDER,
});
