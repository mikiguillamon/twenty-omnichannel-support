import { defineView, ViewFilterOperand } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({ universalIdentifier: IDS.VIEW_CASE_WHATSAPP, name: "WhatsApp", objectUniversalIdentifier: IDS.CASE_OBJECT, icon: 'IconTable', position: 3,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_CASE_WHATSAPP_CASE_SUBJECT, fieldMetadataUniversalIdentifier: IDS.CASE_SUBJECT, position: 0, isVisible: true, size: 270 },
    { universalIdentifier: IDS.VIEWCOL_CASE_WHATSAPP_CASE_CHANNEL, fieldMetadataUniversalIdentifier: IDS.CASE_CHANNEL, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: IDS.VIEWCOL_CASE_WHATSAPP_CASE_STATUS, fieldMetadataUniversalIdentifier: IDS.CASE_STATUS, position: 2, isVisible: true, size: 150 },
    { universalIdentifier: IDS.VIEWCOL_CASE_WHATSAPP_CASE_LASTMESSAGEAT, fieldMetadataUniversalIdentifier: IDS.CASE_LASTMESSAGEAT, position: 3, isVisible: true, size: 160 },
  ],
  filters: [
    { universalIdentifier: IDS.FILTER_CASE_WHATSAPP_FILTER, fieldMetadataUniversalIdentifier: IDS.CASE_CHANNEL, operand: ViewFilterOperand.IS, value: ["WHATSAPP"] },
  ],
});
