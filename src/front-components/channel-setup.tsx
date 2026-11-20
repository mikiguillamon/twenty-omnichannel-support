import { defineFrontComponent } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
import { ChannelSetup } from '../ui/channel-setup-page.tsx';

export default defineFrontComponent({
  universalIdentifier:IDS.FRONT_CHANNEL_SETUP,
  name:'channel-setup',
  description:'Configuración por workspace de canales de atención.',
  component:ChannelSetup,
});
