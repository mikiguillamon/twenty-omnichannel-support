import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.CHANNEL_EXTERNAL_IDENTITIES, objectUniversalIdentifier: IDS.CHANNEL_OBJECT,
  name: 'externalIdentities', label: 'Identidades externas', type: FieldType.RELATION, icon: 'IconFingerprint',
  relationTargetObjectMetadataUniversalIdentifier: IDS.EXT_IDENTITY_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.EXT_IDENTITY_CHANNEL,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
