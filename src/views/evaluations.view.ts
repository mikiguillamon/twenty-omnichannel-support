import { defineView } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({
  universalIdentifier:IDS.VIEW_EVALUATIONS, name:'Evaluaciones', objectUniversalIdentifier:IDS.EVALUATION_OBJECT,
  icon:'IconClipboardCheck', position:0,
  fields:[
    {universalIdentifier:IDS.VIEWCOL_EVAL_VERDICT,fieldMetadataUniversalIdentifier:IDS.EVALUATION_VERDICT,position:0,isVisible:true,size:150},
    {universalIdentifier:IDS.VIEWCOL_EVAL_TARGETSCOPE,fieldMetadataUniversalIdentifier:IDS.EVALUATION_TARGETSCOPE,position:1,isVisible:true,size:145},
    {universalIdentifier:IDS.VIEWCOL_EVAL_REVIEWER,fieldMetadataUniversalIdentifier:IDS.EVALUATION_REVIEWER,position:2,isVisible:true,size:160},
    {universalIdentifier:IDS.VIEWCOL_EVAL_COMMENT,fieldMetadataUniversalIdentifier:IDS.EVALUATION_COMMENT,position:3,isVisible:true,size:260},
    {universalIdentifier:IDS.VIEWCOL_EVAL_REVIEWEDAT,fieldMetadataUniversalIdentifier:IDS.EVALUATION_REVIEWEDAT,position:4,isVisible:true,size:180},
  ],
});
