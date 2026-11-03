import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.CATEGORY_CASES,
  objectUniversalIdentifier: IDS.CATEGORY_OBJECT,
  name: 'cases', label: 'Consultas', type: FieldType.RELATION, icon: 'IconInbox',
  relationTargetObjectMetadataUniversalIdentifier: IDS.CASE_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.CASE_CATEGORY_RELATION,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
