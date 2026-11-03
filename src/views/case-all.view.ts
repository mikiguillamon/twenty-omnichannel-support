import { defineView, ViewFilterOperand } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({ universalIdentifier: IDS.VIEW_CASE_ALL, name: "Todas las consultas", objectUniversalIdentifier: IDS.CASE_OBJECT, icon: 'IconTable', position: 1,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_CASE_ALL_CASE_SUBJECT, fieldMetadataUniversalIdentifier: IDS.CASE_SUBJECT, position: 0, isVisible: true, size: 270 },
    { universalIdentifier: IDS.VIEWCOL_CASE_ALL_CASE_CHANNEL, fieldMetadataUniversalIdentifier: IDS.CASE_CHANNEL, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: IDS.VIEWCOL_CASE_ALL_CASE_STATUS, fieldMetadataUniversalIdentifier: IDS.CASE_STATUS, position: 2, isVisible: true, size: 150 },
    { universalIdentifier: IDS.VIEWCOL_CASE_ALL_CASE_CATEGORY, fieldMetadataUniversalIdentifier: IDS.CASE_CATEGORY_RELATION, position: 3, isVisible: true, size: 150 },
    { universalIdentifier: IDS.VIEWCOL_CASE_ALL_CASE_LASTMESSAGEAT, fieldMetadataUniversalIdentifier: IDS.CASE_LASTMESSAGEAT, position: 4, isVisible: true, size: 160 },
  ],
});
