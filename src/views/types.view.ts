import { defineView } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineView({
  universalIdentifier: IDS.VIEW_TYPES,
  name: 'Tipos configurables',
  objectUniversalIdentifier: IDS.TYPE_OBJECT,
  icon: 'IconTable',
  position: 1,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_TYPES_CODE, fieldMetadataUniversalIdentifier: IDS.TYPE_CODE, position: 0, isVisible: true, size: 180 },
    { universalIdentifier: IDS.VIEWCOL_TYPES_ENABLED, fieldMetadataUniversalIdentifier: IDS.TYPE_ENABLED, position: 1, isVisible: true, size: 110 },
  ],
});
