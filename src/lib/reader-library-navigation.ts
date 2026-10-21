export type ReaderTab='sach'|'tra-don'|'hoat-dong'|'review'|'tuyen';
export type BookPanel='detail'|'reserve'|'reviews'|'write'|'bookmark';
export function readerLocation(url:URL):{tab:ReaderTab;bookId:string;panel:BookPanel}{
  const tab=url.searchParams.get('tab'),action=url.searchParams.get('action');
  return {tab:url.hash.startsWith('#token=')?'tra-don':(['tra-don','hoat-dong','review','tuyen'].includes(tab||'')?tab as ReaderTab:'sach'),
    bookId:url.searchParams.get('sach')||'',panel:tab==='dat-sach'?'reserve':(['reserve','reviews','write','bookmark'].includes(action||'')?action as BookPanel:'detail')};
}
export function bookIntent(panel:BookPanel,bookId:string){
  const query=new URLSearchParams({tab:'sach',sach:bookId});
  if(panel!=='detail') query.set('action',panel);
  return '/sach/?'+query;
}
