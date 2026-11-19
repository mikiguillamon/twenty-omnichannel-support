import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineField({
  universalIdentifier: IDS.TYPE_CASES,
  objectUniversalIdentifier: IDS.TYPE_OBJECT,
  name: 'cases', label: 'Conversaciones', type: FieldType.RELATION, icon: 'IconInbox',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CASE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CASE_TYPE_RELATION,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
