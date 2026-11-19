import { defineView } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineView({
  universalIdentifier: IDS.VIEW_FAQ_BOTS,
  name: 'Permisos de bots',
  objectUniversalIdentifier: IDS.FAQ_BOT_OBJECT,
  icon: 'IconTable', position: 1,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_FAQ_BOTS_CODE,
      fieldMetadataUniversalIdentifier: IDS.FAQ_BOT_CODE,
      position: 0, isVisible: true, size: 220 },
    { universalIdentifier: IDS.VIEWCOL_FAQ_BOTS_ENABLED,
      fieldMetadataUniversalIdentifier: IDS.FAQ_BOT_ENABLED,
      position: 1, isVisible: true, size: 120 },
    { universalIdentifier: IDS.VIEWCOL_FAQ_BOTS_SCOPES,
      fieldMetadataUniversalIdentifier: IDS.FAQ_BOT_SCOPES,
      position: 2, isVisible: true, size: 260 },
  ],
});
