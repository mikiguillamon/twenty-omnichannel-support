import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.CASE_EVALUATIONS, objectUniversalIdentifier: IDS.CASE_OBJECT,
  name: 'evaluations', label: 'Evaluaciones', type: FieldType.RELATION, icon: 'IconClipboardCheck',
  relationTargetObjectMetadataUniversalIdentifier: IDS.EVALUATION_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.EVALUATION_CASE,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
