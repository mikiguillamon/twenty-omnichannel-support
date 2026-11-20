import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_CHANNELS,
  name: 'Canales',
  icon: 'IconPlug',
  position: 2,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: IDS.LAYOUT_CHANNEL_SETUP,
  folderUniversalIdentifier: IDS.MENU_FOLDER,
});
