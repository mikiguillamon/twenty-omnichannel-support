import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineField({
  universalIdentifier: IDS.CASE_TYPE_RELATION,
  objectUniversalIdentifier: IDS.CASE_OBJECT,
  name: 'caseType', label: 'Tipo', type: FieldType.RELATION, icon: 'IconAdjustments',
  relationTargetObjectMetadataUniversalIdentifier: IDS.TYPE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.TYPE_CASES,
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'caseTypeId' },
});
