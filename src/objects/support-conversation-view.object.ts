import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineObject({
  universalIdentifier: IDS.CONVERSATION_VIEW_OBJECT,
  nameSingular: 'supportConversationView',
  namePlural: 'supportConversationViews',
  labelSingular: 'Vista de conversaciones',
  labelPlural: 'Vistas de conversaciones',
  description: 'Filtros y orden guardados para la bandeja operativa de Omnichannel.',
  icon: 'IconFilter',
  labelIdentifierFieldMetadataUniversalIdentifier: IDS.CONVERSATION_VIEW_NAME,
  fields: [
    {
      universalIdentifier: IDS.CONVERSATION_VIEW_NAME,
      name: 'viewName',
      label: 'Nombre de la vista',
      type: FieldType.TEXT,
      icon: 'IconTag',
    },
    {
      universalIdentifier: IDS.CONVERSATION_VIEW_CONFIG,
      name: 'configJson',
      label: 'Configuración de la vista',
      type: FieldType.TEXT,
      icon: 'IconFilter',
    },
  ],
});
