import { definePageLayoutTab, PageLayoutTabLayoutMode, STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

/** Extends the standard Person record page, without overriding Twenty's other tabs. */
export default definePageLayoutTab({
  universalIdentifier: IDS.PERSON_OMNICHANNEL_TAB,
  pageLayoutUniversalIdentifier: STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.personRecordPage.universalIdentifier,
  title: 'Omnichannel',
  icon: 'IconMessages',
  position: 90,
  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
  widgets: [
    {
      universalIdentifier: IDS.PERSON_OMNICHANNEL_WIDGET_CASES,
      title: 'Conversaciones de todos los canales',
      type: 'FIELD',
      heightBehavior: 'FIT_CONTENT',
      configuration: {
        configurationType: 'FIELD',
        fieldMetadataId: IDS.PERSON_CASES,
        fieldDisplayMode: 'TABLE',
      },
    },
    {
      universalIdentifier: IDS.PERSON_OMNICHANNEL_WIDGET_IDENTITIES,
      title: 'Canales e identidades vinculados',
      type: 'FIELD',
      heightBehavior: 'FIT_CONTENT',
      configuration: {
        configurationType: 'FIELD',
        fieldMetadataId: IDS.PERSON_EXTERNAL_IDENTITIES,
        fieldDisplayMode: 'TABLE',
      },
    },
  ],
});
