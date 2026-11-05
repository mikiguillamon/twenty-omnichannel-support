import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.PERSON_EXTERNAL_IDENTITIES,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'supportExternalIdentities', label: 'Identidades de soporte', type: FieldType.RELATION, icon: 'IconFingerprint',
  relationTargetObjectMetadataUniversalIdentifier: IDS.EXT_IDENTITY_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.EXT_IDENTITY_PERSON,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
