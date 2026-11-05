import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineObject({
  universalIdentifier: IDS.CHANNEL_OBJECT,
  nameSingular: 'supportChannel', namePlural: 'supportChannels',
  labelSingular: 'Canal', labelPlural: 'Canales',
  description: 'Instancia de atención (buzón, número de WhatsApp u otro canal). Los datos operativos se actualizan por la API.',
  icon: 'IconPlug',
  fields: [
    { universalIdentifier: IDS.CHANNEL_CODE, name: 'code', label: 'Código', type: FieldType.TEXT, icon: 'IconHash', description: 'Identificador estable y único, por ejemplo email-informacion' },
    { universalIdentifier: IDS.CHANNEL_TYPE, name: 'channelType', label: 'Tipo', type: FieldType.SELECT, icon: 'IconMessages', options: [
      {value:'EMAIL',label:'Email',position:0,color:'blue'},
      {value:'WHATSAPP',label:'WhatsApp',position:1,color:'green'},
      {value:'INSTAGRAM',label:'Instagram',position:2,color:'purple'},
      {value:'TELEGRAM',label:'Telegram',position:3,color:'blue'},
    ]},
    { universalIdentifier: IDS.CHANNEL_PROVIDER, name: 'provider', label: 'Proveedor', type: FieldType.TEXT, icon: 'IconPlug' },
    { universalIdentifier: IDS.CHANNEL_EXTERNALID, name: 'externalIdentifier', label: 'Identificador externo', type: FieldType.TEXT, icon: 'IconAt' },
    { universalIdentifier: IDS.CHANNEL_STATUS, name: 'status', label: 'Estado operativo', type: FieldType.SELECT, icon: 'IconCircleCheck', defaultValue:"'DISABLED'", options: [
      {value:'ACTIVE',label:'Activo',position:0,color:'green'},
      {value:'PAUSED',label:'En pausa',position:1,color:'orange'},
      {value:'DISABLED',label:'Desactivado',position:2,color:'gray'},
    ]},
    { universalIdentifier: IDS.CHANNEL_HEALTH, name: 'health', label: 'Salud técnica', type: FieldType.SELECT, icon: 'IconHeartbeat', defaultValue:"'UNKNOWN'", options: [
      {value:'UNKNOWN',label:'Sin información',position:0,color:'gray'},
      {value:'HEALTHY',label:'Correcto',position:1,color:'green'},
      {value:'WARNING',label:'Advertencia',position:2,color:'orange'},
      {value:'CRITICAL',label:'Crítico',position:3,color:'red'},
    ]},
    { universalIdentifier: IDS.CHANNEL_LASTEVENTAT, name: 'lastEventAt', label: 'Último evento recibido', type: FieldType.DATE_TIME, icon: 'IconCalendarTime' },
    { universalIdentifier: IDS.CHANNEL_LASTHEARTBEATAT, name: 'lastHeartbeatAt', label: 'Última comprobación', type: FieldType.DATE_TIME, icon: 'IconHeartbeat' },
    { universalIdentifier: IDS.CHANNEL_LASTERRORAT, name: 'lastErrorAt', label: 'Último error', type: FieldType.DATE_TIME, icon: 'IconCalendarTime' },
    { universalIdentifier: IDS.CHANNEL_ERROR_SUMMARY, name: 'errorSummary', label: 'Resumen de error (sin secretos)', type: FieldType.TEXT, icon: 'IconAlertTriangle' },
    { universalIdentifier: IDS.CHANNEL_STALEAFTER, name: 'staleAfterMinutes', label: 'Umbral de inactividad en minutos', type: FieldType.NUMBER, icon: 'IconClock' },
    { universalIdentifier: IDS.CHANNEL_GROUPING_MODE, name: 'groupingMode', label: 'Agrupación de consultas', type: FieldType.SELECT, icon: 'IconMessages', description: 'THREAD agrupa por hilo de proveedor, MESSAGE por mensaje entrante, HYBRID considera tema y actividad, SESSION por inactividad, MANUAL requiere revisión.', options: [
      {value:'THREAD',label:'Por hilo',position:0,color:'blue'},
      {value:'MESSAGE',label:'Por mensaje entrante',position:1,color:'gray'},
      {value:'HYBRID',label:'Inteligente',position:2,color:'green'},
      {value:'SESSION',label:'Por inactividad',position:3,color:'orange'},
      {value:'MANUAL',label:'Revisión manual',position:4,color:'gray'},
    ] },
    { universalIdentifier: IDS.CHANNEL_CONTINUATION_HOURS, name: 'continuationHours', label: 'Continuidad (horas)', type: FieldType.NUMBER, icon: 'IconClock', description: 'Umbral de actividad reciente para chats; no determina por sí solo que el tema sea idéntico.' },
    { universalIdentifier: IDS.CHANNEL_REOPEN_HOURS, name: 'reopenHours', label: 'Reapertura (horas)', type: FieldType.NUMBER, icon: 'IconRefresh', description: 'Ventana para reabrir un caso resuelto si el nuevo mensaje pertenece al mismo asunto.' },
    { universalIdentifier: IDS.CHANNEL_SEMANTIC_CLASSIFICATION, name: 'semanticClassification', label: 'Clasificación semántica', type: FieldType.BOOLEAN, icon: 'IconBrain', description: 'Autoriza a n8n a solicitar clasificación cuando existe ambigüedad. La app no llama a ninguna IA.' },
    { universalIdentifier: IDS.CHANNEL_MIN_CONFIDENCE, name: 'minClassificationConfidence', label: 'Confianza mínima (0-1)', type: FieldType.NUMBER, icon: 'IconGauge', description: 'Umbral que debe aplicar el clasificador de n8n antes de vincular automáticamente un mensaje.' },
    { universalIdentifier: IDS.CHANNEL_AMBIGUOUS_ACTION, name: 'ambiguousAction', label: 'Si hay dudas', type: FieldType.SELECT, icon: 'IconHelp', description: 'REVIEW es el modo seguro; n8n no debe adjuntar arbitrariamente un mensaje a otra consulta.', options: [
      {value:'REVIEW',label:'Solicitar revisión',position:0,color:'orange'},
      {value:'NEW',label:'Crear consulta nueva',position:1,color:'blue'},
    ] },
    { universalIdentifier: IDS.CHANNEL_AUTO_CLOSE_ENABLED, name: 'autoCloseEnabled', label: 'Cierre por inactividad', type: FieldType.BOOLEAN, icon: 'IconCircleCheck', description: 'Solo si un workflow externo lo implementa; debe excluir consultas con atención humana pendiente.' },
    { universalIdentifier: IDS.CHANNEL_AUTO_CLOSE_DAYS, name: 'autoCloseDays', label: 'Días sin actividad antes de cerrar', type: FieldType.NUMBER, icon: 'IconCalendar', description: 'Usado únicamente cuando autoCloseEnabled está activado.' },
  ],
});
