import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineIndex({
  universalIdentifier: IDS.EVALUATION_INDEX, objectUniversalIdentifier: IDS.EVALUATION_OBJECT, isUnique: true,
  fields: [{ universalIdentifier: IDS.EVALUATION_INDEX_FIELD, fieldUniversalIdentifier: IDS.EVALUATION_EXTERNALKEY }],
});
