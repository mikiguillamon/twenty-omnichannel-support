import { defineFrontComponent } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
import { ConversationInbox } from '../ui/conversation-inbox-page.tsx';

export default defineFrontComponent({
  universalIdentifier: IDS.FRONT_CONVERSATION_INBOX,
  name: 'omnichannel-conversations',
  description: 'Bandeja de conversaciones con filtros, vistas compartidas e historial por canal.',
  component: ConversationInbox,
});
