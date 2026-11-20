/** Stable, workspace-specific dashboard deep links; no additional routes or permissions. */
export const DASHBOARD_QUERY_KEY = 'omniDashboard';
const validId = (value:string) => /^[a-zA-Z0-9-]{4,70}$/.test(value);

export function readDashboardFromSearch(search:string):string|null {
  const id=new URLSearchParams(search.startsWith('?')?search.slice(1):search).get(DASHBOARD_QUERY_KEY);
  return id&&validId(id)?id:null;
}

export function getDashboardLink(location:{origin:string;pathname:string;search:string}|null,id:string):string|null {
  if(!location||!validId(id))return null;
  try{
    const url=new URL(location.pathname+location.search,location.origin);
    if(!/^https?:$/.test(url.protocol)||url.origin!==location.origin)return null;
    url.searchParams.set(DASHBOARD_QUERY_KEY,id);
    url.hash='';
    // Native LINK items in Twenty recognize safe /paths as in-app routes.\n    return url.pathname+url.search;
  }catch{return null;}
}
