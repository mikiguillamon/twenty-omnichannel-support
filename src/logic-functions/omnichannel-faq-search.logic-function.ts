import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { IDS } from '../constants/ids.ts';
import { FaqSearchError, parseFaqSearchRequest, searchFaqs } from '../lib/faq-search.ts';
import { TwentyFaqSearchStore } from '../lib/faq-search-rest-store.ts';

const handler=async(request:RoutePayload)=>{
  // Never log questions, API tokens, customer content, or bot secrets.
  try {
    if(request.rawBody && Buffer.byteLength(request.rawBody,'utf8')>8192)
      throw new FaqSearchError('PAYLOAD_TOO_LARGE','Search request is too large.',413);
    const input=parseFaqSearchRequest(request.body);
    const secret=request.headers?.['x-omnichannel-bot-secret'];
    const result=await searchFaqs(input,secret,new TwentyFaqSearchStore());
    return new Response(result,{status:200,headers:{'cache-control':'no-store'}});
  }catch(error){
    if(error instanceof FaqSearchError)
      return new Response({ok:false,error:{code:error.code,message:error.message}},
        {status:error.status,headers:{'cache-control':'no-store'}});
    console.error('[omnichannel-faq-search] Request failed',error instanceof Error?error.name:'UnknownError');
    return new Response({ok:false,error:{code:'FAQ_SEARCH_UNAVAILABLE',message:'FAQ search is temporarily unavailable.'}},
      {status:502,headers:{'cache-control':'no-store'}});
  }
};
export default defineLogicFunction({
  universalIdentifier:IDS.FAQ_SEARCH_LOGIC_FUNCTION,
  name:'omnichannel-faq-search',
  timeoutSeconds:30,
  handler,
  httpRouteTriggerSettings:{
    path:'/omnichannel/v1/faqs/search',
    httpMethod:'POST',
    isAuthRequired:true,
    forwardedRequestHeaders:['x-omnichannel-bot-secret'],
  },
});
