import { defineView } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({
  universalIdentifier: IDS.VIEW_CATEGORIES,
  name: 'Categorias configurables',
  objectUniversalIdentifier: IDS.CATEGORY_OBJECT,
  icon: 'IconTable',
  position: 1,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_CATEGORIES_CODE, fieldMetadataUniversalIdentifier: IDS.CATEGORY_CODE, position: 0, isVisible: true, size: 180 },
    { universalIdentifier: IDS.VIEWCOL_CATEGORIES_ENABLED, fieldMetadataUniversalIdentifier: IDS.CATEGORY_ENABLED, position: 1, isVisible: true, size: 110 },
  ],
});
