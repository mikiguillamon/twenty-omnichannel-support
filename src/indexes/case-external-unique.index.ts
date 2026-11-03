import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineIndex({
  universalIdentifier: IDS.CASE_EXTERNAL_INDEX,
  objectUniversalIdentifier: IDS.CASE_OBJECT,
  isUnique: true,
  fields: [{ universalIdentifier: IDS.CASE_EXTERNAL_INDEX_FIELD, fieldUniversalIdentifier: IDS.CASE_EXTERNALKEY }],
});
