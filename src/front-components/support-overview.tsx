import { defineFrontComponent } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
import { Dashboards } from '../ui/dashboard-page.tsx';

export default defineFrontComponent({
  universalIdentifier:IDS.FRONT_SUPPORT_OVERVIEW,
  name:'support-overview',
  description:'Constructor de dashboards Omnichannel con KPIs, gráficos, periodos y configuración por workspace.',
  component:Dashboards,
});
