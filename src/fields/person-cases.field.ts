import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.PERSON_CASES,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'supportCases', label: 'Consultas', type: FieldType.RELATION, icon: 'IconInbox',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CASE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CASE_PERSON,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
