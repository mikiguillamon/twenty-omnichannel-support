import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineObject({
  universalIdentifier: IDS.EXT_IDENTITY_OBJECT,
  nameSingular: 'supportExternalIdentity',
  namePlural: 'supportExternalIdentities',
  labelSingular: 'Identidad externa',
  labelPlural: 'Identidades externas',
  description: 'Identificadores de un interlocutor por proveedor y cuenta, vinculables a Personas de Twenty.',
  icon: 'IconFingerprint',
  fields: [
    { universalIdentifier: IDS.EXT_IDENTITY_EXTERNALKEY, name: 'externalKey', label: 'Clave única', type: FieldType.TEXT, icon: 'IconHash', description: 'Clave estable: tipo:proveedor:cuenta:idUsuario. No insertar tokens.' },
    { universalIdentifier: IDS.EXT_IDENTITY_PROVIDER, name: 'provider', label: 'Proveedor', type: FieldType.TEXT, icon: 'IconPlug' },
    { universalIdentifier: IDS.EXT_IDENTITY_USERID, name: 'externalUserId', label: 'Identificador de usuario', type: FieldType.TEXT, icon: 'IconAt', description: 'WhatsApp JID/LID, Instagram scoped ID, Telegram user ID o email normalizado.' },
    { universalIdentifier: IDS.EXT_IDENTITY_ACCOUNTID, name: 'externalAccountId', label: 'Cuenta de origen', type: FieldType.TEXT, icon: 'IconAddressBook', description: 'Identificador del buzón, número, bot o cuenta; evita colisiones entre proveedores.' },
    { universalIdentifier: IDS.EXT_IDENTITY_DISPLAYNAME, name: 'displayName', label: 'Nombre visible', type: FieldType.TEXT, icon: 'IconUser' },
    { universalIdentifier: IDS.EXT_IDENTITY_VERIFIED, name: 'verified', label: 'Vinculación verificada', type: FieldType.BOOLEAN, icon: 'IconShieldCheck', defaultValue: false },
    { universalIdentifier: IDS.EXT_IDENTITY_LASTSEEN, name: 'lastSeenAt', label: 'Última actividad', type: FieldType.DATE_TIME, icon: 'IconClock' },
  ],
});
