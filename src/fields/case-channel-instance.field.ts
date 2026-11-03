import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.CASE_CHANNEL_INSTANCE, objectUniversalIdentifier: IDS.CASE_OBJECT,
  name: 'channelInstance', label: 'Instancia de canal', type: FieldType.RELATION, icon: 'IconPlug',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CHANNEL_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CHANNEL_CASES,
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'channelInstanceId' },
});
