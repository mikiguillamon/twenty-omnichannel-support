import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineIndex({
  universalIdentifier: IDS.ID_ALIAS_UNIQUE_INDEX,
  objectUniversalIdentifier: IDS.ID_ALIAS_OBJECT,
  isUnique: true,
  fields: [{ universalIdentifier: IDS.ID_ALIAS_UNIQUE_INDEX_FIELD, fieldUniversalIdentifier: IDS.ID_ALIAS_EXTERNALKEY }],
});
