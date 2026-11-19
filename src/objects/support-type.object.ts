import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

// A workspace-configurable catalog, like supportCategories. Not a fixed SELECT.
export default defineObject({
  universalIdentifier: IDS.TYPE_OBJECT,
  nameSingular: 'supportType',
  namePlural: 'supportTypes',
  labelSingular: 'Tipo de conversación',
  labelPlural: 'Tipos de conversación',
  description: 'Tipos de conversación configurables por workspace, independientes de la categoría.',
  icon: 'IconAdjustments',
  fields: [
    { universalIdentifier: IDS.TYPE_CODE, name: 'code', label: 'Código', type: FieldType.TEXT, icon: 'IconHash',
      description: 'Código estable para integraciones, por ejemplo CONSULTA, RECLAMACION o RESERVA.' },
    { universalIdentifier: IDS.TYPE_ENABLED, name: 'enabled', label: 'Activo', type: FieldType.BOOLEAN, icon: 'IconCircleCheck',
      description: 'Solo los tipos activos se pueden asignar desde la API de ingestión.' },
    { universalIdentifier: IDS.TYPE_DESCRIPTION, name: 'description', label: 'Descripción', type: FieldType.TEXT, icon: 'IconNotes' },
  ],
});
