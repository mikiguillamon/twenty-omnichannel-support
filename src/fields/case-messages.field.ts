import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.CASE_MESSAGES,
  objectUniversalIdentifier: IDS.CASE_OBJECT,
  name: 'supportMessages', label: 'Mensajes', type: FieldType.RELATION, icon: 'IconMessages',
  relationTargetObjectMetadataUniversalIdentifier: IDS.MESSAGE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.MESSAGE_CASE,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
