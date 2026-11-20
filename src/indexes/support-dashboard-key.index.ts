import { defineIndex } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineIndex({
  universalIdentifier: IDS.DASHBOARD_KEY_INDEX,
  objectUniversalIdentifier: IDS.DASHBOARD_OBJECT,
  isUnique: true,
  fields: [{
    universalIdentifier: IDS.DASHBOARD_KEY_INDEX_FIELD,
    fieldUniversalIdentifier: IDS.DASHBOARD_KEY,
  }],
});
