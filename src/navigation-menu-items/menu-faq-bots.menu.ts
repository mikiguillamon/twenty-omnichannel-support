import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineNavigationMenuItem({
  universalIdentifier: IDS.MENU_FAQ_BOTS,
  name: 'Bots de FAQs', icon: 'IconRobot', position: 8,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: IDS.FAQ_BOT_OBJECT,
  folderUniversalIdentifier: IDS.MENU_FOLDER,
});
