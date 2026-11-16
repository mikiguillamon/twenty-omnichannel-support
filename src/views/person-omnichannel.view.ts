import { defineView, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

/** Available as an extra view of the native Personas table in each workspace. */
export default defineView({
  universalIdentifier: IDS.VIEW_PERSON_OMNICHANNEL,
  name: 'Omnichannel',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  icon: 'IconMessages',
  position: 95,
  fields: [
    { universalIdentifier: IDS.VIEWCOL_PERSON_OMNI_NAME, fieldMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.fields.name.universalIdentifier, position: 0, isVisible: true, size: 240 },
    { universalIdentifier: IDS.VIEWCOL_PERSON_OMNI_CASES, fieldMetadataUniversalIdentifier: IDS.PERSON_CASES, position: 1, isVisible: true, size: 220 },
    { universalIdentifier: IDS.VIEWCOL_PERSON_OMNI_IDENTITIES, fieldMetadataUniversalIdentifier: IDS.PERSON_EXTERNAL_IDENTITIES, position: 2, isVisible: true, size: 220 },
  ],
});
