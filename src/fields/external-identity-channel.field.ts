import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.EXT_IDENTITY_CHANNEL, objectUniversalIdentifier: IDS.EXT_IDENTITY_OBJECT,
  name: 'channelInstance', label: 'Canal', type: FieldType.RELATION, icon: 'IconPlug',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CHANNEL_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CHANNEL_EXTERNAL_IDENTITIES,
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'channelInstanceId' },
});
