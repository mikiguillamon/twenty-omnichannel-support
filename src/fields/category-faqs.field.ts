import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.CATEGORY_FAQS,
  objectUniversalIdentifier: IDS.CATEGORY_OBJECT,
  name: 'faqs', label: 'FAQs', type: FieldType.RELATION, icon: 'IconBook',
  relationTargetObjectMetadataUniversalIdentifier: IDS.FAQ_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.FAQ_CATEGORY_RELATION,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
