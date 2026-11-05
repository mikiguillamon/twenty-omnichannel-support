import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineField({
  universalIdentifier: IDS.IDENTITY_ALIASES,
  objectUniversalIdentifier: IDS.EXT_IDENTITY_OBJECT,
  name: 'aliases', label: 'Identificadores asociados', type: FieldType.RELATION, icon: 'IconLink',
  relationTargetObjectMetadataUniversalIdentifier: IDS.ID_ALIAS_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: IDS.ID_ALIAS_IDENTITY,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
