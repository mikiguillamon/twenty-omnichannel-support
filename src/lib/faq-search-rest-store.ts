import { RestApiClient } from 'twenty-client-sdk/rest';
import type { FaqSearchStore, FaqRecord, FaqBotRecord } from './faq-search.ts';
import { FaqSearchError } from './faq-search.ts';

const collection=(response:unknown,key:string): unknown[]=>{
  if(!response||typeof response!=='object')throw new Error('Invalid REST response');
  const root=response as Record<string,unknown>;
  const data=root.data&&typeof root.data==='object'?root.data as Record<string,unknown>:root;
  const items=data[key];
  if(!Array.isArray(items))throw new Error('Invalid REST collection');
  return items;
};
export class TwentyFaqSearchStore implements FaqSearchStore {
  private readonly api = new RestApiClient({runAs:'application'});
  async lookupBot(code:string):Promise<FaqBotRecord|null>{
    const response:unknown=await this.api.get('/rest/supportFaqBots',{
      query:{filter:'code[eq]:'+JSON.stringify(code),fields:'id,code,secretHash,enabled,allowedScopes',limit:2,depth:0},
    });
    const rows=collection(response,'supportFaqBots');
    if(rows.length>1)throw new FaqSearchError('BOT_NOT_AUTHORIZED','Bot is not configured uniquely.',403);
    return (rows[0] as FaqBotRecord | undefined)??null;
  }
  async searchCandidates(filter:string,limit:number,cursor:string|null)
  :Promise<{records:FaqRecord[];nextCursor:string|null}> {
    const query:Record<string,string|number>={
      filter,fields:'id,question,answer,variants,language,status,scopeTags',
      limit,depth:0,order_by:'id[AscNullsLast]',
    };
    if(cursor)query.starting_after=cursor;
    const response:unknown=await this.api.get('/rest/supportFaqs',{query});
    const rows=collection(response,'supportFaqs') as FaqRecord[];
    // Probe for another page only when page is full; fail safely if API pagination rejects it.
    return {records:rows,nextCursor:rows.length===limit ? rows.at(-1)?.id??null:null};
  }
}
