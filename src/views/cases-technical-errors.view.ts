import { defineView, ViewFilterOperand } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({
  universalIdentifier:IDS.VIEW_CASE_TECHNICAL_ERRORS, name:'Errores técnicos', objectUniversalIdentifier:IDS.CASE_OBJECT,
  icon:'IconAlertCircle', position:5,
  fields:[
    {universalIdentifier:IDS.VIEWCOL_CASE_ERROR_SUBJECT,fieldMetadataUniversalIdentifier:IDS.CASE_SUBJECT,position:0,isVisible:true,size:300},
    {universalIdentifier:IDS.VIEWCOL_CASE_ERROR_STATUS,fieldMetadataUniversalIdentifier:IDS.CASE_STATUS,position:1,isVisible:true,size:140},
    {universalIdentifier:IDS.VIEWCOL_CASE_ERROR_TECHSTATUS,fieldMetadataUniversalIdentifier:IDS.CASE_TECHNICAL_STATUS,position:2,isVisible:true,size:170},
    {universalIdentifier:IDS.VIEWCOL_CASE_ERROR_LASTMESSAGE,fieldMetadataUniversalIdentifier:IDS.CASE_LASTMESSAGEAT,position:3,isVisible:true,size:180},
  ],
  filters:[{universalIdentifier:IDS.FILTER_CASE_TECH_ERROR,fieldMetadataUniversalIdentifier:IDS.CASE_TECHNICAL_STATUS,operand:ViewFilterOperand.IS,value:['ERROR']}],
});
