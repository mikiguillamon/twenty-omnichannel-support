import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineIndex({
  universalIdentifier: IDS.CHANNEL_INDEX, objectUniversalIdentifier: IDS.CHANNEL_OBJECT, isUnique: true,
  fields: [{ universalIdentifier: IDS.CHANNEL_INDEX_FIELD, fieldUniversalIdentifier: IDS.CHANNEL_CODE }],
});
