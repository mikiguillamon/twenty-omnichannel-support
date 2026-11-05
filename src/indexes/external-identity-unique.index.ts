import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineIndex({
  universalIdentifier: IDS.EXT_IDENTITY_UNIQUE_INDEX,
  objectUniversalIdentifier: IDS.EXT_IDENTITY_OBJECT,
  isUnique: true,
  fields: [{ universalIdentifier: IDS.EXT_IDENTITY_UNIQUE_INDEX_FIELD, fieldUniversalIdentifier: IDS.EXT_IDENTITY_EXTERNALKEY }],
});
