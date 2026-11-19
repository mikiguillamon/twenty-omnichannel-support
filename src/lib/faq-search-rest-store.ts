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
  private readonly api: RestApiClient;
  constructor(api: RestApiClient = new RestApiClient({runAs:'application'})) {
    this.api = api;
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
    // Use Twenty's opaque cursor; a raw record ID may not be a valid cursor.
    const root = response as {pageInfo?: {hasNextPage?: boolean; endCursor?: string};
      data?: {pageInfo?: {hasNextPage?: boolean; endCursor?: string}}};
    const pageInfo = root.pageInfo ?? root.data?.pageInfo;
    if (pageInfo) {
      if (typeof pageInfo.hasNextPage !== 'boolean') throw Error('Invalid REST pageInfo');
      if (pageInfo.hasNextPage && !pageInfo.endCursor) throw Error('Missing REST endCursor');
      return {records: rows, nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor! : null};
    }
    if (rows.length < limit) return {records: rows, nextCursor: null};
    throw Error('Missing REST pageInfo for full page');
  }
}
