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
    OMNICHANNEL_N8N_CREDENTIAL_FINGERPRINT: {
      universalIdentifier: IDS.N8N_CREDENTIAL_FINGERPRINT_VAR,
      label: 'Huella de la credencial Twenty de n8n',
      description: 'Copia la huella de Connection → Get Credential Fingerprint del nodo Omnichannel para autorizar propuestas y mensajes por ID.',
      value: '',
    },
    OMNICHANNEL_N8N_PROPOSAL_SECRET: {
      universalIdentifier: IDS.N8N_PROPOSAL_SECRET_VAR,
      label: 'Clave de integración de n8n',
      description: 'Secreto de la cabecera X-Omnichannel-Proposal-Key para registrar propuestas o añadir mensajes por ID de conversación.',
      isSecret: true,
    },
  },
  author: 'Just For Fun 360, S.L.',
  category: 'Communication',
  logo: 'public/logo.png',
  websiteUrl: 'https://github.com/mikiguillamon/twenty-omnichannel-support',
  issueReportUrl: 'https://github.com/mikiguillamon/twenty-omnichannel-support/issues',
});
