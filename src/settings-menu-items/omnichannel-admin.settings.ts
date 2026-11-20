import { defineSettingsMenuItem } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

// Workspace Settings > Apps is protected by Twenty's native application
// administration permissions. The SDK 2.50 sidebar cannot be role-filtered.
export default defineSettingsMenuItem({
  universalIdentifier: IDS.SETTINGS_MENU_ADMIN,
  frontComponentUniversalIdentifier: IDS.FRONT_ADMIN_CENTER,
  title: 'Administración Omnichannel',
  icon: 'IconHeadset',
  position: 1,
  slug: 'omnichannel-admin',
  scope: 'WORKSPACE',
});
