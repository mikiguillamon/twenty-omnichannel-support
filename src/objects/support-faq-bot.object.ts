import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

/**
 * Workspace-owned bot configuration. Only a SHA-256 verifier is stored here;
 * the 256-bit API secret itself belongs in the calling integration's vault.
 * Twenty roles must restrict who may create or modify these records.
 */
export default defineObject({
  universalIdentifier: IDS.FAQ_BOT_OBJECT,
  nameSingular: 'supportFaqBot',
  namePlural: 'supportFaqBots',
  labelSingular: 'Bot de FAQs',
  labelPlural: 'Bots de FAQs',
  description: 'Permisos de alcance por bot. Editar solo desde un rol administrador del workspace.',
  icon: 'IconRobot',
  fields: [
    { universalIdentifier: IDS.FAQ_BOT_CODE, name: 'code', label: 'Código', type: FieldType.TEXT,
      icon: 'IconHash', description: 'Identificador estable: EGORA_EMAIL.' },
    { universalIdentifier: IDS.FAQ_BOT_SCOPES, name: 'allowedScopes', label: 'Alcances permitidos',
      type: FieldType.ARRAY, icon: 'IconTags',
      description: 'Códigos de alcance autorizados, p. ej. ["VERANO"]. GENERAL se incluye al buscar.' },
    { universalIdentifier: IDS.FAQ_BOT_SECRET_HASH, name: 'secretHash',
      label: 'Verificador SHA-256 (hex)', type: FieldType.TEXT, icon: 'IconKey',
      description: 'SHA-256 en hexadecimal de una clave aleatoria de 32 bytes. No introducir la clave en claro.' },
    { universalIdentifier: IDS.FAQ_BOT_ENABLED, name: 'enabled', label: 'Activo',
      type: FieldType.BOOLEAN, icon: 'IconCircleCheck' },
    { universalIdentifier: IDS.FAQ_BOT_DESCRIPTION, name: 'description', label: 'Descripción',
      type: FieldType.TEXT, icon: 'IconNotes' },
  ],
});
