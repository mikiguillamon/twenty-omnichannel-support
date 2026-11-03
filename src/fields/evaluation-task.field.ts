import { defineField, FieldType, RelationType, OnDeleteAction, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier:IDS.EVALUATION_TASK, objectUniversalIdentifier:IDS.EVALUATION_OBJECT,
  name:'task', label:'Tarea vinculada', type:FieldType.RELATION,icon:'IconListCheck',
  relationTargetObjectMetadataUniversalIdentifier:STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:IDS.TASK_EVALUATIONS,
  universalSettings:{relationType:RelationType.MANY_TO_ONE,onDelete:OnDeleteAction.SET_NULL,joinColumnName:'taskId'},
});
