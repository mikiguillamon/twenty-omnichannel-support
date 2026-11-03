import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineIndex({
  universalIdentifier: IDS.CATEGORY_CODE_INDEX,
  objectUniversalIdentifier: IDS.CATEGORY_OBJECT,
  isUnique: true,
  fields: [{ universalIdentifier: IDS.CATEGORY_CODE_INDEX_FIELD, fieldUniversalIdentifier: IDS.CATEGORY_CODE }],
});
