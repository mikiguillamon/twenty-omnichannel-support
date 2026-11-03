import { defineApplication } from 'twenty-sdk/define';
import { IDS } from './constants/ids.ts';

export default defineApplication({
  universalIdentifier: IDS.APPLICATION,
  displayName: 'Omnichannel Support',
  description: 'Atención multicanal, FAQs, conversaciones, calidad y métricas dentro de Twenty CRM.',
  defaultRoleUniversalIdentifier: IDS.ROLE,
  author: 'Just For Fun 360, S.L.',
  category: 'Sales',
  logo: 'public/logo.png',
  websiteUrl: 'https://github.com/mikiguillamon/twenty-omnichannel-support',
  issueReportUrl: 'https://github.com/mikiguillamon/twenty-omnichannel-support/issues',
});
