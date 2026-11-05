import { defineView } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({
  universalIdentifier: IDS.VIEW_IDENTITIES, name: 'Identidades externas',
  objectUniversalIdentifier: IDS.EXT_IDENTITY_OBJECT, icon: 'IconFingerprint', position: 0,
  fields: [
    {universalIdentifier: IDS.VIEWCOL_IDENTITY_USERID, fieldMetadataUniversalIdentifier: IDS.EXT_IDENTITY_USERID, position: 0, isVisible: true, size: 240},
    {universalIdentifier: IDS.VIEWCOL_IDENTITY_PROVIDER, fieldMetadataUniversalIdentifier: IDS.EXT_IDENTITY_PROVIDER, position: 1, isVisible: true, size: 140},
    {universalIdentifier: IDS.VIEWCOL_IDENTITY_DISPLAYNAME, fieldMetadataUniversalIdentifier: IDS.EXT_IDENTITY_DISPLAYNAME, position: 2, isVisible: true, size: 200},
    {universalIdentifier: IDS.VIEWCOL_IDENTITY_VERIFIED, fieldMetadataUniversalIdentifier: IDS.EXT_IDENTITY_VERIFIED, position: 3, isVisible: true, size: 130},
  ],
});
