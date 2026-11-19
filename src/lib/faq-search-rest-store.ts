import { RestApiClient } from 'twenty-client-sdk/rest';
import type { FaqSearchStore, FaqRecord } from './faq-search.ts';

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
  async searchCandidates(filter:string,limit:number,cursor:string|null)
  :Promise<{records:FaqRecord[];nextCursor:string|null}> {
    const query:Record<string,string|number>={
      filter,fields:'id,question,answer,variants,language,status,scopeTags',
      limit,depth:0,order_by:'id[AscNullsLast]',
    };
    if(cursor)query.starting_after=cursor;
    const response:unknown=await this.api.get('/rest/supportFaqs',{query});
    const rows=collection(response,'supportFaqs') as FaqRecord[];
    // Twenty REST pageInfo is top-level. Use its endCursor rather than assuming
    // that the last record ID is always a valid cursor.
    const pageInfo = (response as {pageInfo?: {hasNextPage?: boolean; endCursor?: string}}).pageInfo;
    if (pageInfo) {
      if (pageInfo.hasNextPage && !pageInfo.endCursor) throw Error('Missing REST endCursor');
      return {records: rows, nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor ?? null : null};
    }
    // Legacy REST responses can omit pageInfo. Probe only if a full page came back.
    return {records: rows, nextCursor: rows.length === limit ? rows.at(-1)?.id ?? null : null};
  }
}
