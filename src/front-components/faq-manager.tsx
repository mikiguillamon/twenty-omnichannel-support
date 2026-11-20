import { defineFrontComponent } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
import { FaqManagerEntry } from '../ui/faq-manager-page.tsx';

export default defineFrontComponent({
  universalIdentifier: IDS.FRONT_FAQ_MANAGER,
  name: 'faq-manager',
  description: 'Gestión visual de preguntas frecuentes con categorías, filtros y editor.',
  component: FaqManagerEntry,
});
