import { defineView, ViewFilterOperand } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({
  universalIdentifier:IDS.VIEW_EVALUATIONS_INCORRECT, name:'Respuestas incorrectas', objectUniversalIdentifier:IDS.EVALUATION_OBJECT,
  icon:'IconAlertTriangle', position:1,
  fields:[
    {universalIdentifier:IDS.VIEWCOL_EVAL_BAD_VERDICT,fieldMetadataUniversalIdentifier:IDS.EVALUATION_VERDICT,position:0,isVisible:true,size:170},
    {universalIdentifier:IDS.VIEWCOL_EVAL_BAD_COMMENT,fieldMetadataUniversalIdentifier:IDS.EVALUATION_COMMENT,position:1,isVisible:true,size:300},
    {universalIdentifier:IDS.VIEWCOL_EVAL_BAD_REVIEWEDAT,fieldMetadataUniversalIdentifier:IDS.EVALUATION_REVIEWEDAT,position:2,isVisible:true,size:180},
  ],
  filters:[{universalIdentifier:IDS.FILTER_EVALUATION_INCORRECT,fieldMetadataUniversalIdentifier:IDS.EVALUATION_VERDICT,operand:ViewFilterOperand.IS,value:['INCORRECT']}],
});
