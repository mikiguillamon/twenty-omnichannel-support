import { defineFrontComponent } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
import { ChannelPolicies } from '../ui/channel-policies-page.tsx';

export default defineFrontComponent({
  universalIdentifier: IDS.FRONT_CHANNEL_POLICIES,
  name: 'channel-policies',
  description: 'Editor por canal de reglas de agrupación, reapertura y clasificación de consultas.',
  component: ChannelPolicies,
});
