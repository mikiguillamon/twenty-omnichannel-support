import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_WHATSAPP, name: "WhatsApp", icon: 'IconBrandWhatsapp', position: 3,
  type: NavigationMenuItemType.VIEW, viewUniversalIdentifier: IDS.VIEW_CASE_WHATSAPP, folderUniversalIdentifier: IDS.MENU_FOLDER,
});
