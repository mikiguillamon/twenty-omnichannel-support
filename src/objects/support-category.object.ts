import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

// Categories are RECORDS, not SELECT options: each workspace manages its own categories.
export default defineObject({
  universalIdentifier: IDS.CATEGORY_OBJECT,
  nameSingular: 'supportCategory',
  namePlural: 'supportCategories',
  labelSingular: 'Categoria',
  labelPlural: 'Categorias',
  description: 'Editable categories for FAQs and cases in this workspace.',
  icon: 'IconCategory',
  fields: [
    { universalIdentifier: IDS.CATEGORY_CODE, name: 'code', label: 'Codigo', type: FieldType.TEXT, icon: 'IconHash', description: 'Stable internal code, for example FACTURACION' },
    { universalIdentifier: IDS.CATEGORY_ENABLED, name: 'enabled', label: 'Activa', type: FieldType.BOOLEAN, icon: 'IconCircleCheck', description: 'Only active categories should be used for new cases' },
    { universalIdentifier: IDS.CATEGORY_DESCRIPTION, name: 'description', label: 'Descripcion', type: FieldType.TEXT, icon: 'IconNotes' },
  ],
});
