import { defineView, ViewFilterOperand } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({ universalIdentifier: IDS.VIEW_CASE_HUMAN, name: "Pendientes de agente", objectUniversalIdentifier: IDS.CASE_OBJECT, icon: 'IconTable', position: 4,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_CASE_HUMAN_CASE_SUBJECT, fieldMetadataUniversalIdentifier: IDS.CASE_SUBJECT, position: 0, isVisible: true, size: 270 },
    { universalIdentifier: IDS.VIEWCOL_CASE_HUMAN_CASE_STATUS, fieldMetadataUniversalIdentifier: IDS.CASE_STATUS, position: 1, isVisible: true, size: 150 },
    { universalIdentifier: IDS.VIEWCOL_CASE_HUMAN_CASE_CHANNEL, fieldMetadataUniversalIdentifier: IDS.CASE_CHANNEL, position: 2, isVisible: true, size: 120 },
    { universalIdentifier: IDS.VIEWCOL_CASE_HUMAN_CASE_LASTMESSAGEAT, fieldMetadataUniversalIdentifier: IDS.CASE_LASTMESSAGEAT, position: 3, isVisible: true, size: 160 },
  ],
  filters: [
    { universalIdentifier: IDS.FILTER_CASE_HUMAN_FILTER, fieldMetadataUniversalIdentifier: IDS.CASE_STATUS, operand: ViewFilterOperand.IS, value: ["HUMAN_REQUIRED"] },
  ],
});
