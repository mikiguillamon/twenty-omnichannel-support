import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default definePageLayout({
  universalIdentifier: IDS.LAYOUT_SUPPORT_FAQ,
  name: 'Detalle de FAQ',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: IDS.FAQ_OBJECT,
  tabs: [{
    universalIdentifier: IDS.LAYOUT_SUPPORT_FAQ_TAB, title: 'Contenido y alcance', icon: 'IconBook', position: 0,
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets: [
      { universalIdentifier: IDS.LAYOUT_SUPPORT_FAQ_WIDGET_QUESTION, title: 'Pregunta', type: 'FIELD',
        configuration: { configurationType: 'FIELD', fieldMetadataId: IDS.FAQ_QUESTION, fieldDisplayMode: 'FIELD' } },
      { universalIdentifier: IDS.LAYOUT_SUPPORT_FAQ_WIDGET_ANSWER, title: 'Respuesta', type: 'FIELD',
        configuration: { configurationType: 'FIELD', fieldMetadataId: IDS.FAQ_ANSWER, fieldDisplayMode: 'FIELD' } },
      { universalIdentifier: IDS.LAYOUT_SUPPORT_FAQ_WIDGET_CATEGORY, title: 'Categoría', type: 'FIELD',
        configuration: { configurationType: 'FIELD', fieldMetadataId: IDS.FAQ_CATEGORY_RELATION, fieldDisplayMode: 'CARD' } },
      { universalIdentifier: IDS.LAYOUT_SUPPORT_FAQ_WIDGET_STATUS, title: 'Estado', type: 'FIELD',
        configuration: { configurationType: 'FIELD', fieldMetadataId: IDS.FAQ_STATUS, fieldDisplayMode: 'FIELD' } },
      { universalIdentifier: IDS.LAYOUT_SUPPORT_FAQ_WIDGET_LANGUAGE, title: 'Idioma', type: 'FIELD',
        configuration: { configurationType: 'FIELD', fieldMetadataId: IDS.FAQ_LANGUAGE, fieldDisplayMode: 'FIELD' } },
      { universalIdentifier: IDS.LAYOUT_SUPPORT_FAQ_WIDGET_SCOPE_EDITOR, title: 'Alcance', type: 'FRONT_COMPONENT',
        heightBehavior: 'FIT_CONTENT',
        configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: IDS.FRONT_FAQ_SCOPE_EDITOR } },
    ],
  }],
});
