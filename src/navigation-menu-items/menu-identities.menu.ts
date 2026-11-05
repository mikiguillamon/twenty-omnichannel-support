import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_IDENTITIES, name: 'Identidades externas', icon: 'IconFingerprint', position: 7,
  type: NavigationMenuItemType.OBJECT, targetObjectUniversalIdentifier: IDS.EXT_IDENTITY_OBJECT,
  folderUniversalIdentifier: IDS.MENU_FOLDER,
});
