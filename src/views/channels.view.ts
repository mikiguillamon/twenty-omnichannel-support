import { defineView } from 'twenty-sdk/define';
import { IDS } from '../constants/ids.ts';
export default defineView({
  universalIdentifier:IDS.VIEW_CHANNELS, name:'Estado de canales', objectUniversalIdentifier:IDS.CHANNEL_OBJECT,
  icon:'IconActivity', position:0,
  fields:[
    {universalIdentifier:IDS.VIEWCOL_CHANNEL_CODE,fieldMetadataUniversalIdentifier:IDS.CHANNEL_CODE,position:0,isVisible:true,size:180},
    {universalIdentifier:IDS.VIEWCOL_CHANNEL_TYPE,fieldMetadataUniversalIdentifier:IDS.CHANNEL_TYPE,position:1,isVisible:true,size:130},
    {universalIdentifier:IDS.VIEWCOL_CHANNEL_STATUS,fieldMetadataUniversalIdentifier:IDS.CHANNEL_STATUS,position:2,isVisible:true,size:130},
    {universalIdentifier:IDS.VIEWCOL_CHANNEL_HEALTH,fieldMetadataUniversalIdentifier:IDS.CHANNEL_HEALTH,position:3,isVisible:true,size:140},
    {universalIdentifier:IDS.VIEWCOL_CHANNEL_LASTEVENT,fieldMetadataUniversalIdentifier:IDS.CHANNEL_LASTEVENTAT,position:4,isVisible:true,size:180},
  ],
});
