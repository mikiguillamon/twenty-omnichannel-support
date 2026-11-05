import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.CASE_EXTERNAL_IDENTITY, objectUniversalIdentifier: IDS.CASE_OBJECT,
  name: 'externalIdentity', label: 'Identidad externa', type: FieldType.RELATION, icon: 'IconFingerprint',
  relationTargetObjectMetadataUniversalIdentifier: IDS.EXT_IDENTITY_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.EXT_IDENTITY_CASES,
  universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'externalIdentityId' },
});
