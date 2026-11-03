import { defineView, ViewFilterOperand } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({ universalIdentifier: IDS.VIEW_FAQS_PUBLISHED, name: "FAQs publicadas", objectUniversalIdentifier: IDS.FAQ_OBJECT, icon: 'IconTable', position: 1,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_FAQS_PUBLISHED_FAQ_QUESTION, fieldMetadataUniversalIdentifier: IDS.FAQ_QUESTION, position: 0, isVisible: true, size: 300 },
    { universalIdentifier: IDS.VIEWCOL_FAQS_PUBLISHED_FAQ_CATEGORY, fieldMetadataUniversalIdentifier: IDS.FAQ_CATEGORY_RELATION, position: 1, isVisible: true, size: 150 },
    { universalIdentifier: IDS.VIEWCOL_FAQS_PUBLISHED_FAQ_LANGUAGE, fieldMetadataUniversalIdentifier: IDS.FAQ_LANGUAGE, position: 2, isVisible: true, size: 110 },
    { universalIdentifier: IDS.VIEWCOL_FAQS_PUBLISHED_FAQ_STATUS, fieldMetadataUniversalIdentifier: IDS.FAQ_STATUS, position: 3, isVisible: true, size: 130 },
  ],
  filters: [
    { universalIdentifier: IDS.FILTER_FAQ_PUBLISHED_STATUS, fieldMetadataUniversalIdentifier: IDS.FAQ_STATUS, operand: ViewFilterOperand.IS, value: ["PUBLISHED"] },
  ],
});
