import { defineApplication } from 'twenty-sdk/define';
import { IDS } from './constants/ids.ts';

export default defineApplication({
  universalIdentifier: IDS.APPLICATION,
  displayName: 'Omnichannel Support',
  description: 'Customer support cases, conversations, FAQs and channel management inside Twenty CRM.',
  defaultRoleUniversalIdentifier: IDS.ROLE,
  author: 'Just For Fun 360, S.L.',
  category: 'Communication',
  logo: 'public/logo.png',
  websiteUrl: 'https://github.com/mikiguillamon/twenty-omnichannel-support',
  issueReportUrl: 'https://github.com/mikiguillamon/twenty-omnichannel-support/issues',
});
