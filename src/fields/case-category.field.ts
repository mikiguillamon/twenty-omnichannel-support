import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.CASE_CATEGORY_RELATION,
  objectUniversalIdentifier: IDS.CASE_OBJECT,
  name: 'category', label: 'Categoria', type: FieldType.RELATION, icon: 'IconCategory',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CATEGORY_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CATEGORY_CASES,
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'categoryId' },
});
