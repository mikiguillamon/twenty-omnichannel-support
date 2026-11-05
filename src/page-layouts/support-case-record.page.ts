import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default definePageLayout({
  universalIdentifier:IDS.LAYOUT_SUPPORT_CASE,
  name:'Detalle de consulta',type:'RECORD_PAGE',objectUniversalIdentifier:IDS.CASE_OBJECT,
  tabs:[
    { universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_TAB_DETAILS,title:'Detalles',icon:'IconFileText',position:0,
      layoutMode:PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets:[
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_SUBJECT,title:'Asunto',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_SUBJECT,fieldDisplayMode:'FIELD'}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_PERSON,title:'Persona',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_PERSON,fieldDisplayMode:'CARD'}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_CHANNEL,title:'Canal',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_CHANNEL_INSTANCE,fieldDisplayMode:'CARD'}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_CATEGORY,title:'Categoría',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_CATEGORY_RELATION,fieldDisplayMode:'CARD'}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_IDENTITY,title:'Identidad externa',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_EXTERNAL_IDENTITY,fieldDisplayMode:'CARD'}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_STATUS,title:'Estado de la consulta',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_STATUS,fieldDisplayMode:'FIELD'}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_RESOLUTION,title:'Resultado operativo',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_RESOLUTION,fieldDisplayMode:'FIELD'}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_TECHNICAL,title:'Estado técnico',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_TECHNICAL_STATUS,fieldDisplayMode:'FIELD'}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_AUTOMATION,title:'Automatización',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_AUTOMATION,fieldDisplayMode:'FIELD'}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_SUMMARY,title:'Resumen',type:'FIELD',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_SUMMARY,fieldDisplayMode:'FIELD'}},
      ]},
    { universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_TAB_THREAD,title:'Conversación',icon:'IconMessages',position:1,
      layoutMode:PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets:[
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_THREAD,title:'Mensajes ordenados',type:'FRONT_COMPONENT',heightBehavior:'FIT_CONTENT',
         configuration:{configurationType:'FRONT_COMPONENT',frontComponentUniversalIdentifier:IDS.FRONT_CASE_TIMELINE}},
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_DETAIL_MESSAGES,title:'Mensajes vinculados (editar)',type:'FIELD',heightBehavior:'FIT_CONTENT',configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_MESSAGES,fieldDisplayMode:'TABLE'}},
      ]},
    { universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_TAB_EVAL,title:'Evaluaciones',icon:'IconClipboardCheck',position:2,
      layoutMode:PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets:[
        {universalIdentifier:IDS.LAYOUT_SUPPORT_CASE_WIDGET_EVAL,title:'Evaluaciones vinculadas',type:'FIELD',
         configuration:{configurationType:'FIELD',fieldMetadataId:IDS.CASE_EVALUATIONS,fieldDisplayMode:'TABLE'}},
      ]},
  ],
});
