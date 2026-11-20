import { defineApplication } from 'twenty-sdk/define';
import { IDS } from './constants/ids.ts';

export default defineApplication({
  universalIdentifier: IDS.APPLICATION,
  displayName: 'Omnichannel Support',
  description: 'Customer support cases, conversations, FAQs and channel management inside Twenty CRM.',
  defaultRoleUniversalIdentifier: IDS.ROLE,
  applicationVariables: {
    OMNICHANNEL_N8N_ORIGIN: {
      universalIdentifier: IDS.N8N_WAIT_ORIGIN_VAR,
      label: 'URL base de n8n',
      description: 'URL HTTPS pública de n8n que sirve las URLs de reanudación de Wait.',
      value: '',
    },
    OMNICHANNEL_N8N_WAIT_SECRET: {
      universalIdentifier: IDS.N8N_WAIT_SECRET_VAR,
      label: 'Secreto de Wait de n8n',
      description: 'Valor opcional de la cabecera X-Omnichannel-Webhook-Secret configurada en Wait.',
      isSecret: true,
    },
    OMNICHANNEL_N8N_PROPOSAL_SECRET: {
      universalIdentifier: IDS.N8N_PROPOSAL_SECRET_VAR,
      label: 'Clave de entrada de propuestas',
      description: 'Secreto que n8n envía en la cabecera X-Omnichannel-Proposal-Key al registrar un email con propuesta.',
      isSecret: true,
    },
  },
  author: 'Just For Fun 360, S.L.',
  category: 'Communication',
  logo: 'public/logo.png',
  websiteUrl: 'https://github.com/mikiguillamon/twenty-omnichannel-support',
  issueReportUrl: 'https://github.com/mikiguillamon/twenty-omnichannel-support/issues',
});
