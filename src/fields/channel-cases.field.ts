import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.CHANNEL_CASES, objectUniversalIdentifier: IDS.CHANNEL_OBJECT,
  name: 'cases', label: 'Consultas', type: FieldType.RELATION, icon: 'IconInbox',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CASE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CASE_CHANNEL_INSTANCE,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
