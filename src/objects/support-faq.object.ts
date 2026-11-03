import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineObject({
  universalIdentifier: IDS.FAQ_OBJECT,
  nameSingular: 'supportFaq',
  namePlural: 'supportFaqs',
  labelSingular: 'FAQ',
  labelPlural: 'FAQs',
  description: 'Base de conocimiento que pueden leer los bots de n8n.',
  icon: 'IconBook',
  fields: [
    { universalIdentifier: IDS.FAQ_QUESTION, name: "question", label: "Pregunta", type: FieldType.TEXT, icon: "IconHelp", description: "Texto de la pregunta principal" },
    { universalIdentifier: IDS.FAQ_ANSWER, name: "answer", label: "Respuesta", type: FieldType.TEXT, icon: "IconMessage2", description: "Respuesta aprobada disponible para n8n" },
    { universalIdentifier: IDS.FAQ_VARIANTS, name: "variants", label: "Variantes de pregunta", type: FieldType.TEXT, icon: "IconList", description: "Variantes o sinónimos, una por línea" },
    { universalIdentifier: IDS.FAQ_LANGUAGE, name: "language", label: "Idioma", type: FieldType.SELECT, icon: "IconLanguage", options: [{ value: "ES", label: "Español", position: 0, color: "gray" }, { value: "CA", label: "Català", position: 1, color: "blue" }, { value: "EN", label: "English", position: 2, color: "green" }], defaultValue: "'ES'" },
    { universalIdentifier: IDS.FAQ_STATUS, name: "status", label: "Estado", type: FieldType.SELECT, icon: "IconStatusChange", options: [{ value: "DRAFT", label: "Borrador", position: 0, color: "gray" }, { value: "PUBLISHED", label: "Publicada", position: 1, color: "green" }, { value: "ARCHIVED", label: "Archivada", position: 2, color: "gray" }], defaultValue: "'DRAFT'" },
    { universalIdentifier: IDS.FAQ_TAGS, name: "tags", label: "Etiquetas", type: FieldType.MULTI_SELECT, icon: "IconTags", options: [{ value: "URGENTE", label: "Urgente", position: 0, color: "gray" }, { value: "INTERNA", label: "Interna", position: 1, color: "blue" }, { value: "FRECUENTE", label: "Frecuente", position: 2, color: "green" }, { value: "REVISAR", label: "Revisar", position: 3, color: "orange" }] },
    { universalIdentifier: IDS.FAQ_SOURCEURL, name: "sourceUrl", label: "URL de referencia", type: FieldType.TEXT, icon: "IconLink" },
    { universalIdentifier: IDS.FAQ_UPDATEDBYREFERENCE, name: "updatedByReference", label: "Revisado por", type: FieldType.TEXT, icon: "IconUser" },
    { universalIdentifier: IDS.FAQ_REVISION, name: 'revision', label: 'Revisión', type: FieldType.NUMBER, icon: 'IconVersions' },
    { universalIdentifier: IDS.FAQ_PUBLISHED_AT, name: 'publishedAt', label: 'Publicada el', type: FieldType.DATE_TIME, icon: 'IconCalendarCheck' },
    { universalIdentifier: IDS.FAQ_SYNCED_AT, name: 'lastSyncedAt', label: 'Última sincronización', type: FieldType.DATE_TIME, icon: 'IconRefresh' },
    { universalIdentifier:IDS.FAQ_CUSTOM_TAGS, name:'customTags', label:'Etiquetas propias', type:FieldType.ARRAY, icon:'IconTags', description:'Etiquetas de texto específicas del cliente.' },
  ],
});
