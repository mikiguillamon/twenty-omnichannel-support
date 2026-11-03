import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineIndex({
  universalIdentifier: IDS.MESSAGE_EXTERNAL_INDEX,
  objectUniversalIdentifier: IDS.MESSAGE_OBJECT,
  isUnique: true,
  fields: [{ universalIdentifier: IDS.MESSAGE_EXTERNAL_INDEX_FIELD, fieldUniversalIdentifier: IDS.MESSAGE_EXTERNALKEY }],
});
