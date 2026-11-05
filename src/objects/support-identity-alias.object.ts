import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineObject({
  universalIdentifier: IDS.ID_ALIAS_OBJECT,
  nameSingular: 'supportIdentityAlias',
  namePlural: 'supportIdentityAliases',
  labelSingular: 'Alias de identidad',
  labelPlural: 'Alias de identidad',
  description: 'Identificadores equivalentes observados para una identidad externa en una cuenta y proveedor concretos.',
  icon: 'IconLink',
  fields: [
    { universalIdentifier: IDS.ID_ALIAS_EXTERNALKEY, name: 'externalKey', label: 'Clave única de alias', type: FieldType.TEXT, icon: 'IconHash', description: 'Tipo:proveedor:cuenta:identificador normalizado. Único dentro de cada workspace.' },
    { universalIdentifier: IDS.ID_ALIAS_VALUE, name: 'aliasValue', label: 'Identificador original', type: FieldType.TEXT, icon: 'IconAt', description: 'JID o LID de WhatsApp, u otro identificador de plataforma. No almacenar tokens.' },
    { universalIdentifier: IDS.ID_ALIAS_KIND, name: 'aliasType', label: 'Tipo de identificador', type: FieldType.SELECT, icon: 'IconFingerprint', options: [
      {value:'WHATSAPP_PN',label:'WhatsApp teléfono (PN)',position:0,color:'green'},
      {value:'WHATSAPP_LID',label:'WhatsApp LID',position:1,color:'blue'},
      {value:'PROVIDER_ID',label:'ID de proveedor',position:2,color:'gray'},
    ] },
    { universalIdentifier: IDS.ID_ALIAS_EVIDENCE, name: 'evidence', label: 'Origen de la vinculación', type: FieldType.TEXT, icon: 'IconShieldCheck', description: 'Ejemplo: evento de proveedor con remoteJid y remoteJidAlt. No equivale a identidad personal verificada.' },
    { universalIdentifier: IDS.ID_ALIAS_LASTSEEN, name: 'lastSeenAt', label: 'Última aparición', type: FieldType.DATE_TIME, icon: 'IconClock' },
  ],
});
