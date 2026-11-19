import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineIndex({
  universalIdentifier: IDS.FAQ_BOT_CODE_INDEX,
  objectUniversalIdentifier: IDS.FAQ_BOT_OBJECT,
  isUnique: true,
  fields: [{ universalIdentifier: IDS.FAQ_BOT_CODE_INDEX_FIELD,
    fieldUniversalIdentifier: IDS.FAQ_BOT_CODE }],
});
