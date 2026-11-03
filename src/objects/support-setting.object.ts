import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

// Non-secret settings per workspace. Tokens and API credentials belong in secure integrations.
export default defineObject({
  universalIdentifier: IDS.SETTING_OBJECT,
  nameSingular: 'supportSetting', namePlural: 'supportSettings',
  labelSingular: 'Ajuste de soporte', labelPlural: 'Ajustes de soporte',
  description: 'Non-secret configuration editable in Twenty per workspace and readable by n8n.',
  icon: 'IconSettings',
  fields: [
    { universalIdentifier: IDS.SETTING_KEY, name: 'key', label: 'Clave', type: FieldType.TEXT, icon: 'IconKey', description: 'Unique stable key, e.g. email.auto_reply_enabled' },
    { universalIdentifier: IDS.SETTING_VALUE_TYPE, name: 'valueType', label: 'Tipo', type: FieldType.SELECT, icon: 'IconAdjustments', options: [
      { value: 'TEXT', label: 'Texto', position: 0, color: 'gray' },
      { value: 'NUMBER', label: 'Numero', position: 1, color: 'blue' },
      { value: 'BOOLEAN', label: 'Si/No', position: 2, color: 'green' },
    ], defaultValue: "'TEXT'" },
    { universalIdentifier: IDS.SETTING_VALUE_TEXT, name: 'valueText', label: 'Valor texto', type: FieldType.TEXT, icon: 'IconTextSize' },
    { universalIdentifier: IDS.SETTING_VALUE_NUMBER, name: 'valueNumber', label: 'Valor numero', type: FieldType.NUMBER, icon: 'Icon123' },
    { universalIdentifier: IDS.SETTING_VALUE_BOOLEAN, name: 'valueBoolean', label: 'Valor Si/No', type: FieldType.BOOLEAN, icon: 'IconToggleRight' },
    { universalIdentifier: IDS.SETTING_ENABLED, name: 'enabled', label: 'Activo', type: FieldType.BOOLEAN, icon: 'IconCircleCheck' },
    { universalIdentifier: IDS.SETTING_DESCRIPTION, name: 'description', label: 'Descripcion', type: FieldType.TEXT, icon: 'IconNotes' },
  ],
});
