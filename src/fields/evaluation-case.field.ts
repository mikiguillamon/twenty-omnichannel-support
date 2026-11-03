import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.EVALUATION_CASE, objectUniversalIdentifier: IDS.EVALUATION_OBJECT,
  name: 'supportCase', label: 'Consulta evaluada', type: FieldType.RELATION, icon: 'IconInbox',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CASE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CASE_EVALUATIONS,
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'supportCaseId' },
});
