import { defineObject, FieldType } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';

export default defineObject({
  universalIdentifier: IDS.EVALUATION_OBJECT,
  nameSingular: 'supportEvaluation', namePlural: 'supportEvaluations',
  labelSingular: 'Evaluación', labelPlural: 'Evaluaciones',
  description: 'Revisión humana de una consulta o un mensaje específico, con seguimiento y respuesta sugerida.',
  icon: 'IconClipboardCheck',
  fields: [
    {universalIdentifier:IDS.EVALUATION_EXTERNALKEY,name:'externalKey',label:'Clave externa',type:FieldType.TEXT,icon:'IconHash',description:'Opcional. Clave única para importaciones desde sistemas externos.'},
    {universalIdentifier:IDS.EVALUATION_TARGETSCOPE,name:'targetScope',label:'Alcance',type:FieldType.SELECT,icon:'IconListCheck',options:[
      {value:'CASE',label:'Consulta completa',position:0,color:'blue'},
      {value:'MESSAGE',label:'Mensaje concreto',position:1,color:'green'},
    ]},
    {universalIdentifier:IDS.EVALUATION_VERDICT,name:'verdict',label:'Resultado de la evaluación',type:FieldType.SELECT,icon:'IconScale',defaultValue:"'PENDING'",options:[
      {value:'PENDING',label:'Pendiente de revisión',position:0,color:'gray'},
      {value:'CORRECT',label:'Correcto',position:1,color:'green'},
      {value:'INCORRECT',label:'Incorrecto',position:2,color:'red'},
      {value:'PARTIAL',label:'Parcial',position:3,color:'orange'},
    ]},
    {universalIdentifier:IDS.EVALUATION_SCORE,name:'score',label:'Puntuación opcional (1-5)',type:FieldType.NUMBER,icon:'IconStar'},
    {universalIdentifier:IDS.EVALUATION_COMMENT,name:'comment',label:'Comentario',type:FieldType.TEXT,icon:'IconNotes'},
    {universalIdentifier:IDS.EVALUATION_CORRECTION,name:'proposedCorrection',label:'Corrección propuesta',type:FieldType.TEXT,icon:'IconPencil'},
    {universalIdentifier:IDS.EVALUATION_REVIEWER,name:'reviewer',label:'Evaluado por',type:FieldType.TEXT,icon:'IconUser'},
    {universalIdentifier:IDS.EVALUATION_REVIEWEDAT,name:'reviewedAt',label:'Fecha de evaluación',type:FieldType.DATE_TIME,icon:'IconCalendarCheck'},
    {universalIdentifier:IDS.EVALUATION_FOLLOWUP,name:'followupStatus',label:'Seguimiento',type:FieldType.SELECT,icon:'IconListCheck',defaultValue:"'NOT_REQUIRED'",options:[
      {value:'NOT_REQUIRED',label:'No es necesario',position:0,color:'gray'},
      {value:'PENDING',label:'Pendiente',position:1,color:'orange'},
      {value:'IN_PROGRESS',label:'En curso',position:2,color:'blue'},
      {value:'DONE',label:'Completado',position:3,color:'green'},
    ]},
    {universalIdentifier:IDS.EVALUATION_LINKED_TASK,name:'linkedTaskId',label:'ID de tarea Twenty',type:FieldType.TEXT,icon:'IconListCheck',description:'Referencia opcional a una tarea nativa; se comprueba y enlaza desde la integración.'},
  ],
});
