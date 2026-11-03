import { defineView, ViewFilterOperand } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({ universalIdentifier: IDS.VIEW_CASE_EMAIL, name: "Email", objectUniversalIdentifier: IDS.CASE_OBJECT, icon: 'IconTable', position: 2,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_CASE_EMAIL_CASE_SUBJECT, fieldMetadataUniversalIdentifier: IDS.CASE_SUBJECT, position: 0, isVisible: true, size: 270 },
    { universalIdentifier: IDS.VIEWCOL_CASE_EMAIL_CASE_CHANNEL, fieldMetadataUniversalIdentifier: IDS.CASE_CHANNEL, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: IDS.VIEWCOL_CASE_EMAIL_CASE_STATUS, fieldMetadataUniversalIdentifier: IDS.CASE_STATUS, position: 2, isVisible: true, size: 150 },
    { universalIdentifier: IDS.VIEWCOL_CASE_EMAIL_CASE_LASTMESSAGEAT, fieldMetadataUniversalIdentifier: IDS.CASE_LASTMESSAGEAT, position: 3, isVisible: true, size: 160 },
  ],
  filters: [
    { universalIdentifier: IDS.FILTER_CASE_EMAIL_FILTER, fieldMetadataUniversalIdentifier: IDS.CASE_CHANNEL, operand: ViewFilterOperand.IS, value: ["EMAIL"] },
  ],
});
