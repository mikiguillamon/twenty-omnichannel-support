import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier:IDS.TASK_EVALUATIONS, objectUniversalIdentifier:STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  name:'supportEvaluations', label:'Evaluaciones de soporte', type:FieldType.RELATION,icon:'IconClipboardCheck',
  relationTargetObjectMetadataUniversalIdentifier:IDS.EVALUATION_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier:IDS.EVALUATION_TASK,
  universalSettings:{relationType:RelationType.ONE_TO_MANY},
});
