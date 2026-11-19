import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineIndex({
  universalIdentifier: IDS.TYPE_CODE_INDEX,
  objectUniversalIdentifier: IDS.TYPE_OBJECT,
  isUnique: true,
  fields: [{ universalIdentifier: IDS.TYPE_CODE_INDEX_FIELD, fieldUniversalIdentifier: IDS.TYPE_CODE }],
});
