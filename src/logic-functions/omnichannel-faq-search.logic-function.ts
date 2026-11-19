import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { IDS } from '../constants/ids.ts';
import { FaqSearchError, parseFaqSearchRequest, searchFaqs } from '../lib/faq-search.ts';
import { TwentyFaqSearchStore } from '../lib/faq-search-rest-store.ts';
import { RestApiClientError } from 'twenty-client-sdk/rest';

const handler=async(request:RoutePayload)=>{
  // Never log questions, workspace tokens or customer content.
  try {
    const payloadBytes = request.rawBody
      ? Buffer.byteLength(request.rawBody,'utf8')
      : Buffer.byteLength(JSON.stringify(request.body ?? {}),'utf8');
    if(payloadBytes>8192)
      throw new FaqSearchError('PAYLOAD_TOO_LARGE','Search request is too large.',413);
    const input=parseFaqSearchRequest(request.body);
    const result=await searchFaqs(input,new TwentyFaqSearchStore());
    return new Response(result,{status:200,headers:{'cache-control':'no-store'}});
  }catch(error){
    if(error instanceof FaqSearchError)
      return new Response({ok:false,error:{code:error.code,message:error.message}},
        {status:error.status,headers:{'cache-control':'no-store'}});
    // Never log REST URLs, query strings, request bodies, tokens, or FAQ text.
    const status = error instanceof RestApiClientError ? error.status : undefined;
    const code = status === 400 ? 'FAQ_REST_BAD_REQUEST'
      : status === 401 || status === 403 ? 'FAQ_REST_ACCESS_DENIED'
      : status === 429 ? 'FAQ_REST_RATE_LIMIT'
      : status !== undefined && status >= 500 ? 'FAQ_REST_UPSTREAM_ERROR'
      : error instanceof RestApiClientError ? 'FAQ_REST_CLIENT_FAILURE'
      : 'FAQ_SEARCH_UNAVAILABLE';
    console.error('[omnichannel-faq-search] Failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      restStatus: status ?? null,
      errorCode: code,
    });
    return new Response({ok:false,error:{code,message:'FAQ search is temporarily unavailable.'}},
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
  },
});
