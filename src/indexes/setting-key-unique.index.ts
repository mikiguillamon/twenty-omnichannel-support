import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineIndex({
  universalIdentifier: IDS.SETTING_KEY_INDEX, objectUniversalIdentifier: IDS.SETTING_OBJECT, isUnique: true,
  fields: [{ universalIdentifier: IDS.SETTING_KEY_INDEX_FIELD, fieldUniversalIdentifier: IDS.SETTING_KEY }],
});
