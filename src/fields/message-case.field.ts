import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.MESSAGE_CASE,
  objectUniversalIdentifier: IDS.MESSAGE_OBJECT,
  name: 'supportCase', label: 'Consulta', type: FieldType.RELATION, icon: 'IconInbox',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CASE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CASE_MESSAGES,
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.CASCADE, joinColumnName: 'supportCaseId' },
});
