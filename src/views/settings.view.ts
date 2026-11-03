import { defineView } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({
  universalIdentifier: IDS.VIEW_SETTINGS, name: 'Configuracion por cliente',
  objectUniversalIdentifier: IDS.SETTING_OBJECT, icon: 'IconTable', position: 1,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_SETTING_KEY, fieldMetadataUniversalIdentifier: IDS.SETTING_KEY, position: 0, isVisible: true, size: 250 },
    { universalIdentifier: IDS.VIEWCOL_SETTING_VALUE_TYPE, fieldMetadataUniversalIdentifier: IDS.SETTING_VALUE_TYPE, position: 1, isVisible: true, size: 140 },
    { universalIdentifier: IDS.VIEWCOL_SETTING_ENABLED, fieldMetadataUniversalIdentifier: IDS.SETTING_ENABLED, position: 2, isVisible: true, size: 100 },
  ],
});
