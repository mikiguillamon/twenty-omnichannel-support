import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.EXT_IDENTITY_CASES, objectUniversalIdentifier: IDS.EXT_IDENTITY_OBJECT,
  name: 'cases', label: 'Consultas', type: FieldType.RELATION, icon: 'IconInbox',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CASE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CASE_EXTERNAL_IDENTITY,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
