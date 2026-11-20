import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

// Dashboard definitions are ordinary workspace records. This keeps the
// operational read permission independent of administrative supportSettings.
export default defineObject({
  universalIdentifier: IDS.DASHBOARD_OBJECT,
  nameSingular: 'supportDashboard',
  namePlural: 'supportDashboards',
  labelSingular: 'Dashboard de soporte',
  labelPlural: 'Dashboards de soporte',
  description: 'Definiciones de dashboards Omnichannel por workspace.',
  icon: 'IconLayoutDashboard',
  fields: [
    {
      universalIdentifier: IDS.DASHBOARD_KEY,
      name: 'dashboardKey',
      label: 'Identificador de dashboard',
      type: FieldType.TEXT,
      icon: 'IconKey',
      description: 'Clave estable omnichannel.dashboard.v2.<id>, usada para migraciones idempotentes.',
    },
    {
      universalIdentifier: IDS.DASHBOARD_DATA,
      name: 'configJson',
      label: 'Configuración JSON',
      type: FieldType.TEXT,
      icon: 'IconCode',
      description: 'Configuración validada del dashboard y sus widgets. No contiene secretos.',
    },
    {
      universalIdentifier: IDS.DASHBOARD_ENABLED,
      name: 'enabled',
      label: 'Activo',
      type: FieldType.BOOLEAN,
      icon: 'IconToggleRight',
    },
  ],
});
