import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.EVALUATION_MESSAGE, objectUniversalIdentifier: IDS.EVALUATION_OBJECT,
  name: 'supportMessage', label: 'Mensaje evaluado', type: FieldType.RELATION, icon: 'IconMessage',
  relationTargetObjectMetadataUniversalIdentifier: IDS.MESSAGE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.MESSAGE_EVALUATIONS,
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'supportMessageId' },
});
