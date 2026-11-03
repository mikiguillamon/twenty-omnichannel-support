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
    ]},
    { universalIdentifier: IDS.CHANNEL_PROVIDER, name: 'provider', label: 'Proveedor', type: FieldType.TEXT, icon: 'IconPlug' },
    { universalIdentifier: IDS.CHANNEL_EXTERNALID, name: 'externalIdentifier', label: 'Identificador externo', type: FieldType.TEXT, icon: 'IconAt' },
    { universalIdentifier: IDS.CHANNEL_STATUS, name: 'status', label: 'Estado operativo', type: FieldType.SELECT, icon: 'IconCircleCheck', defaultValue:"'ACTIVE'", options: [
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
  ],
});
