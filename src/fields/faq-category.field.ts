import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.FAQ_CATEGORY_RELATION,
  objectUniversalIdentifier: IDS.FAQ_OBJECT,
  name: 'category', label: 'Categoria', type: FieldType.RELATION, icon: 'IconCategory',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CATEGORY_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CATEGORY_FAQS,
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'categoryId' },
});
